import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function getPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name)) {
    return name.text;
  }

  if (ts.isStringLiteral(name)) {
    return name.text;
  }

  if (ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function getScriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }

  if (file.endsWith('.jsx')) {
    return ts.ScriptKind.JSX;
  }

  if (file.endsWith('.ts')) {
    return ts.ScriptKind.TS;
  }

  return ts.ScriptKind.JS;
}

export interface ReadScriptMetadataOptions {
  /**
   * Overrides for module resolution (e.g. `baseUrl` / `paths` from your
   * tsconfig). Merged over sensible bundler-style defaults.
   */
  compilerOptions?: ts.CompilerOptions;
}

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, // requires TypeScript >= 5.0
  allowJs: true,
};

/** Maximum nesting of function calls while evaluating. */
const MAX_CALL_DEPTH = 200;
/** Maximum number of function calls while evaluating one requested property. */
const MAX_TOTAL_CALLS = 50_000;
/** Maximum number of loop iterations while evaluating one requested property. */
const MAX_LOOP_ITERATIONS = 100_000;

type FunctionNode =
  ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;

type ImportBinding =
  | { kind: 'named'; specifier: string; imported: string } // imported === 'default' for default imports
  | { kind: 'namespace'; specifier: string };

type ExportBinding =
  | { kind: 'local'; name: string }
  | { kind: 'expression'; expression: ts.Expression } // export default <expr>
  | { kind: 'function'; node: ts.FunctionDeclaration } // export default function () {}
  | { kind: 'reexport'; specifier: string; imported: string };

interface ModuleInfo {
  file: string;
  /** Top-level `const` initializers, by local name (exported or not). */
  declarations: Map<string, ts.Expression>;
  /** Top-level function declarations, by local name (hoisted). */
  functions: Map<string, ts.FunctionDeclaration>;
  /** Import bindings, by local name. */
  imports: Map<string, ImportBinding>;
  /** Export bindings, by exported name. */
  exports: Map<string, ExportBinding>;
  /** Specifiers of `export * from '...'`. */
  starExports: string[];
}

/** A lexical scope created by a function call or a block inside one. */
interface Scope {
  vars: Map<string, unknown>;
  /** Names declared with `const` (not assignable). */
  constants: Set<string>;
  parent?: Scope;
}

interface Session {
  modules: Map<string, ModuleInfo | null>;
  values: Map<string, unknown>;
  resolving: Set<string>;
  compilerOptions: ts.CompilerOptions;
  depth: number;
  calls: number;
  iterations: number;
}

interface EvalContext {
  module: ModuleInfo;
  session: Session;
  /** Innermost local scope; undefined at module level. */
  scope?: Scope;
}

/**
 * Internal representation of a function value (a closure). It is never part of
 * the returned metadata; it only exists so that calls can be evaluated.
 */
class FunctionRef {
  constructor(
    readonly node: FunctionNode,
    readonly module: ModuleInfo,
    readonly scope: Scope | undefined
  ) {}
}

type Primitive = string | number | boolean | null;

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/** Functions cannot be represented as metadata, so they read as "unresolved". */
function toPlainValue(value: unknown): unknown {
  return value instanceof FunctionRef ? undefined : value;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false)
  );
}

// ---------------------------------------------------------------------------
// Module loading
// ---------------------------------------------------------------------------

function parseModule(file: string, source: string): ModuleInfo {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(file)
  );

  const info: ModuleInfo = {
    file,
    declarations: new Map(),
    functions: new Map(),
    imports: new Map(),
    exports: new Map(),
    starExports: [],
  };

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      const isConst =
        (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
      const isExported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        const name = declaration.name.text;
        // let/var can be reassigned, so they are never inlined.
        if (isConst && declaration.initializer) {
          info.declarations.set(name, declaration.initializer);
        }
        if (isExported) {
          info.exports.set(name, { kind: 'local', name });
        }
      }
      continue;
    }

    if (ts.isFunctionDeclaration(statement)) {
      if (!statement.body) {
        continue; // overload signature or `declare function`
      }
      const isExported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
      const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
      if (statement.name) {
        const name = statement.name.text;
        info.functions.set(name, statement);
        if (isExported) {
          info.exports.set(isDefault ? 'default' : name, {
            kind: 'local',
            name,
          });
        }
      } else if (isExported && isDefault) {
        info.exports.set('default', { kind: 'function', node: statement });
      }
      continue;
    }

    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (
        !clause ||
        clause.isTypeOnly ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const specifier = statement.moduleSpecifier.text;
      if (clause.name) {
        info.imports.set(clause.name.text, {
          kind: 'named',
          specifier,
          imported: 'default',
        });
      }
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) {
        info.imports.set(bindings.name.text, { kind: 'namespace', specifier });
      } else if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (element.isTypeOnly) {
            continue;
          }
          info.imports.set(element.name.text, {
            kind: 'named',
            specifier,
            imported: (element.propertyName ?? element.name).text,
          });
        }
      }
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) {
        continue;
      }
      const specifier =
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : undefined;

      if (!statement.exportClause) {
        // export * from './x'
        if (specifier) {
          info.starExports.push(specifier);
        }
        continue;
      }
      if (!ts.isNamedExports(statement.exportClause)) {
        continue; // export * as ns from './x' is not supported
      }
      for (const element of statement.exportClause.elements) {
        if (element.isTypeOnly) {
          continue;
        }
        const imported = (element.propertyName ?? element.name).text;
        info.exports.set(
          element.name.text,
          specifier
            ? { kind: 'reexport', specifier, imported }
            : { kind: 'local', name: imported }
        );
      }
      continue;
    }

    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      info.exports.set('default', {
        kind: 'expression',
        expression: statement.expression,
      });
    }
  }

  return info;
}

function loadModule(
  fromFile: string,
  specifier: string,
  session: Session
): ModuleInfo | undefined {
  const resolved = ts.resolveModuleName(
    specifier,
    fromFile,
    session.compilerOptions,
    ts.sys
  ).resolvedModule;

  if (
    !resolved ||
    resolved.isExternalLibraryImport ||
    resolved.extension === ts.Extension.Dts ||
    resolved.extension === ts.Extension.Json
  ) {
    return undefined;
  }

  const file = path.resolve(resolved.resolvedFileName);
  if (session.modules.has(file)) {
    return session.modules.get(file) ?? undefined;
  }

  let info: ModuleInfo | null = null;
  try {
    info = parseModule(file, fs.readFileSync(file, 'utf8'));
  } catch {
    info = null;
  }
  session.modules.set(file, info);
  return info ?? undefined;
}

// ---------------------------------------------------------------------------
// Binding resolution
// ---------------------------------------------------------------------------

function findScope(name: string, scope: Scope | undefined): Scope | undefined {
  for (let current = scope; current; current = current.parent) {
    if (current.vars.has(name)) {
      return current;
    }
  }
  return undefined;
}

/** Looks a name up in the local scopes first, then at module level. */
function lookup(name: string, ctx: EvalContext): unknown {
  const scope = findScope(name, ctx.scope);
  if (scope) {
    return scope.vars.get(name);
  }
  return resolveLocal(ctx.module, name, ctx.session);
}

/** Resolves a name as seen from inside `module` (a const, function or import). */
function resolveLocal(
  module: ModuleInfo,
  name: string,
  session: Session
): unknown {
  const key = `L\0${module.file}\0${name}`;
  if (session.values.has(key)) {
    return session.values.get(key);
  }
  if (session.resolving.has(key)) {
    return undefined; // cycle
  }

  session.resolving.add(key);
  let value: unknown;
  try {
    const initializer = module.declarations.get(name);
    const declaredFunction = module.functions.get(name);
    const binding = module.imports.get(name);
    if (initializer) {
      value = getExportValue(initializer, { module, session });
    } else if (declaredFunction) {
      value = new FunctionRef(declaredFunction, module, undefined);
    } else if (binding?.kind === 'named') {
      const target = loadModule(module.file, binding.specifier, session);
      value = target
        ? resolveExport(target, binding.imported, session)
        : undefined;
    }
  } finally {
    session.resolving.delete(key);
  }
  session.values.set(key, value);
  return value;
}

/** Resolves a name as seen from outside `module` (its public exports). */
function resolveExport(
  module: ModuleInfo,
  exportName: string,
  session: Session
): unknown {
  const key = `E\0${module.file}\0${exportName}`;
  if (session.values.has(key)) {
    return session.values.get(key);
  }
  if (session.resolving.has(key)) {
    return undefined; // cycle
  }

  session.resolving.add(key);
  let value: unknown;
  try {
    const binding = module.exports.get(exportName);
    if (binding?.kind === 'local') {
      value = resolveLocal(module, binding.name, session);
    } else if (binding?.kind === 'expression') {
      value = getExportValue(binding.expression, { module, session });
    } else if (binding?.kind === 'function') {
      value = new FunctionRef(binding.node, module, undefined);
    } else if (binding?.kind === 'reexport') {
      const target = loadModule(module.file, binding.specifier, session);
      value = target
        ? resolveExport(target, binding.imported, session)
        : undefined;
    } else if (!binding && exportName !== 'default') {
      // `export *` never re-exports the default export.
      for (const specifier of module.starExports) {
        const target = loadModule(module.file, specifier, session);
        const candidate = target
          ? resolveExport(target, exportName, session)
          : undefined;
        if (candidate !== undefined) {
          value = candidate;
          break;
        }
      }
    }
  } finally {
    session.resolving.delete(key);
  }
  session.values.set(key, value);
  return value;
}

// ---------------------------------------------------------------------------
// Function calls and statements
// ---------------------------------------------------------------------------

type Completion =
  | { kind: 'normal' }
  | { kind: 'return'; value: unknown }
  | { kind: 'break' }
  | { kind: 'continue' }
  | { kind: 'bail' }; // hit something we cannot evaluate faithfully

interface CallResult {
  /** False when the call could not be evaluated faithfully. */
  ok: boolean;
  value?: unknown;
}

const BAIL: Completion = { kind: 'bail' };

/** Compound assignment operator -> the binary operator it applies. */
const COMPOUND_ASSIGNMENTS = new Map<ts.SyntaxKind, ts.SyntaxKind>([
  [ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.PlusToken],
  [ts.SyntaxKind.MinusEqualsToken, ts.SyntaxKind.MinusToken],
  [ts.SyntaxKind.AsteriskEqualsToken, ts.SyntaxKind.AsteriskToken],
  [ts.SyntaxKind.SlashEqualsToken, ts.SyntaxKind.SlashToken],
  [ts.SyntaxKind.PercentEqualsToken, ts.SyntaxKind.PercentToken],
  [
    ts.SyntaxKind.AsteriskAsteriskEqualsToken,
    ts.SyntaxKind.AsteriskAsteriskToken,
  ],
]);

function createScope(parent: Scope | undefined): Scope {
  return { vars: new Map(), constants: new Set(), parent };
}

/** Copy of a scope, as JS makes for every iteration of a `for (let ...)` loop. */
function copyScope(scope: Scope): Scope {
  return {
    vars: new Map(scope.vars),
    constants: new Set(scope.constants),
    parent: scope.parent,
  };
}

function skipParentheses(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}

/** Counts a loop iteration; false once the budget is used up. */
function tick(session: Session): boolean {
  session.iterations++;
  return session.iterations <= MAX_LOOP_ITERATIONS;
}

/** Declares `let` / `const` variables in the current scope. `var` is unsupported. */
function declareVariables(
  list: ts.VariableDeclarationList,
  ctx: EvalContext
): boolean {
  const isConst = (list.flags & ts.NodeFlags.Const) !== 0;
  const isLet = (list.flags & ts.NodeFlags.Let) !== 0;
  if (!isConst && !isLet) {
    return false;
  }
  const scope = ctx.scope!;
  for (const declaration of list.declarations) {
    if (!ts.isIdentifier(declaration.name)) {
      return false;
    }
    const name = declaration.name.text;
    scope.vars.set(
      name,
      declaration.initializer
        ? getExportValue(declaration.initializer, ctx)
        : undefined
    );
    if (isConst) {
      scope.constants.add(name);
    }
  }
  return true;
}

/** Finds the scope that owns a *local, assignable* variable. */
function findAssignableScope(
  target: ts.Expression,
  ctx: EvalContext
): { name: string; scope: Scope } | undefined {
  const identifier = skipParentheses(target);
  if (!ts.isIdentifier(identifier)) {
    return undefined; // property / element assignments are unsupported
  }
  const scope = findScope(identifier.text, ctx.scope);
  // Not found locally means module-level state: that would be a side effect
  // outside the function, so it is never modeled.
  if (!scope || scope.constants.has(identifier.text)) {
    return undefined;
  }
  return { name: identifier.text, scope };
}

/**
 * Runs an expression in statement position. Only forms that can be modeled are
 * accepted: assignments to local variables, `++` / `--`, comma sequences and
 * calls to known functions. Everything else returns false (bail).
 */
function runExpressionStatement(
  expression: ts.Expression,
  ctx: EvalContext
): boolean {
  const expr = skipParentheses(expression);

  if (ts.isStringLiteral(expr)) {
    return true; // "use strict" and friends
  }

  if (ts.isBinaryExpression(expr)) {
    const operator = expr.operatorToken.kind;
    if (operator === ts.SyntaxKind.CommaToken) {
      return (
        runExpressionStatement(expr.left, ctx) &&
        runExpressionStatement(expr.right, ctx)
      );
    }
    const isPlainAssignment = operator === ts.SyntaxKind.EqualsToken;
    const compound = COMPOUND_ASSIGNMENTS.get(operator);
    if (!isPlainAssignment && compound === undefined) {
      return false;
    }
    const target = findAssignableScope(expr.left, ctx);
    if (!target) {
      return false;
    }
    let value = getExportValue(expr.right, ctx);
    if (compound !== undefined) {
      const current = target.scope.vars.get(target.name);
      value =
        current === undefined || value === undefined
          ? undefined
          : evaluateBinary(compound, current, value);
    }
    target.scope.vars.set(target.name, value);
    return true;
  }

  if (ts.isPrefixUnaryExpression(expr) || ts.isPostfixUnaryExpression(expr)) {
    if (
      expr.operator !== ts.SyntaxKind.PlusPlusToken &&
      expr.operator !== ts.SyntaxKind.MinusMinusToken
    ) {
      return false;
    }
    const target = findAssignableScope(expr.operand, ctx);
    if (!target) {
      return false;
    }
    const current = target.scope.vars.get(target.name);
    if (typeof current !== 'number') {
      return false;
    }
    // The value of the expression is unused in statement position.
    target.scope.vars.set(
      target.name,
      expr.operator === ts.SyntaxKind.PlusPlusToken ? current + 1 : current - 1
    );
    return true;
  }

  if (ts.isCallExpression(expr)) {
    return evaluateCall(expr, ctx).ok;
  }

  return false;
}

/** Runs one statement as the body of something (if / loop), in its own scope. */
function runNested(statement: ts.Statement, ctx: EvalContext): Completion {
  return runStatements(
    ts.isBlock(statement) ? statement.statements : [statement],
    {
      ...ctx,
      scope: createScope(ctx.scope),
    }
  );
}

function runStatement(statement: ts.Statement, ctx: EvalContext): Completion {
  const session = ctx.session;
  const scope = ctx.scope!;

  if (ts.isReturnStatement(statement)) {
    return {
      kind: 'return',
      value: statement.expression
        ? getExportValue(statement.expression, ctx)
        : undefined,
    };
  }

  if (ts.isVariableStatement(statement)) {
    return declareVariables(statement.declarationList, ctx)
      ? { kind: 'normal' }
      : BAIL;
  }

  if (ts.isExpressionStatement(statement)) {
    return runExpressionStatement(statement.expression, ctx)
      ? { kind: 'normal' }
      : BAIL;
  }

  if (ts.isIfStatement(statement)) {
    const condition = getExportValue(statement.expression, ctx);
    if (condition === undefined) {
      return BAIL; // cannot tell which branch runs
    }
    const branch = condition
      ? statement.thenStatement
      : statement.elseStatement;
    return branch ? runNested(branch, ctx) : { kind: 'normal' };
  }

  if (ts.isBlock(statement)) {
    return runNested(statement, ctx);
  }

  if (ts.isBreakStatement(statement)) {
    return statement.label ? BAIL : { kind: 'break' };
  }
  if (ts.isContinueStatement(statement)) {
    return statement.label ? BAIL : { kind: 'continue' };
  }

  if (ts.isForStatement(statement)) {
    let current = createScope(scope);
    const initializer = statement.initializer;
    if (initializer) {
      const ok = ts.isVariableDeclarationList(initializer)
        ? declareVariables(initializer, { ...ctx, scope: current })
        : runExpressionStatement(initializer, { ...ctx, scope: current });
      if (!ok) {
        return BAIL;
      }
    }
    current = copyScope(current);
    for (;;) {
      if (!tick(session)) {
        return BAIL;
      }
      const iteration: EvalContext = { ...ctx, scope: current };
      if (statement.condition) {
        const condition = getExportValue(statement.condition, iteration);
        if (condition === undefined) {
          return BAIL;
        }
        if (!condition) {
          break;
        }
      }
      const body = runNested(statement.statement, iteration);
      if (body.kind === 'return' || body.kind === 'bail') {
        return body;
      }
      if (body.kind === 'break') {
        break;
      }
      // Each iteration gets its own copy of the loop variables (closures
      // created in the body keep seeing the values of their iteration).
      current = copyScope(current);
      if (
        statement.incrementor &&
        !runExpressionStatement(statement.incrementor, {
          ...ctx,
          scope: current,
        })
      ) {
        return BAIL;
      }
    }
    return { kind: 'normal' };
  }

  if (ts.isWhileStatement(statement) || ts.isDoStatement(statement)) {
    const isDo = ts.isDoStatement(statement);
    let first = true;
    for (;;) {
      if (!tick(session)) {
        return BAIL;
      }
      if (!(isDo && first)) {
        const condition = getExportValue(statement.expression, ctx);
        if (condition === undefined) {
          return BAIL;
        }
        if (!condition) {
          break;
        }
      }
      first = false;
      const body = runNested(statement.statement, ctx);
      if (body.kind === 'return' || body.kind === 'bail') {
        return body;
      }
      if (body.kind === 'break') {
        break;
      }
    }
    return { kind: 'normal' };
  }

  if (ts.isForOfStatement(statement)) {
    const initializer = statement.initializer;
    if (
      statement.awaitModifier ||
      !ts.isVariableDeclarationList(initializer) ||
      initializer.declarations.length !== 1 ||
      !ts.isIdentifier(initializer.declarations[0].name) ||
      !(initializer.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let))
    ) {
      return BAIL;
    }
    const name = initializer.declarations[0].name.text;
    const isConst = (initializer.flags & ts.NodeFlags.Const) !== 0;

    const iterable = getExportValue(statement.expression, ctx);
    const items = Array.isArray(iterable)
      ? iterable
      : typeof iterable === 'string'
        ? Array.from(iterable)
        : undefined;
    if (!items) {
      return BAIL;
    }

    for (const item of items) {
      if (!tick(session)) {
        return BAIL;
      }
      const iterationScope = createScope(scope);
      iterationScope.vars.set(name, item);
      if (isConst) {
        iterationScope.constants.add(name);
      }
      const body = runNested(statement.statement, {
        ...ctx,
        scope: iterationScope,
      });
      if (body.kind === 'return' || body.kind === 'bail') {
        return body;
      }
      if (body.kind === 'break') {
        break;
      }
    }
    return { kind: 'normal' };
  }

  if (ts.isEmptyStatement(statement) || ts.isFunctionDeclaration(statement)) {
    return { kind: 'normal' }; // function declarations are hoisted separately
  }

  return BAIL; // switch, try, throw, labels, for-in, with, ...
}

/**
 * Runs a list of statements. Local state may be freely mutated (`let`,
 * assignments, loops) because it cannot leak out of the call. Anything that
 * could touch state outside the function, or that we cannot model, makes the
 * whole call unresolvable instead of risking a wrong answer.
 */
function runStatements(
  statements: readonly ts.Statement[],
  ctx: EvalContext
): Completion {
  const scope = ctx.scope!;

  // Function declarations are hoisted.
  for (const statement of statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      statement.body
    ) {
      scope.vars.set(
        statement.name.text,
        new FunctionRef(statement, ctx.module, scope)
      );
    }
  }

  for (const statement of statements) {
    const completion = runStatement(statement, ctx);
    if (completion.kind !== 'normal') {
      return completion;
    }
  }
  return { kind: 'normal' };
}

function evaluateCall(
  expression: ts.CallExpression,
  ctx: EvalContext
): CallResult {
  const callee = getExportValue(expression.expression, ctx);
  if (!(callee instanceof FunctionRef)) {
    return { ok: false };
  }
  const args: unknown[] = [];
  for (const argument of expression.arguments) {
    if (ts.isSpreadElement(argument)) {
      const spread = getExportValue(argument.expression, ctx);
      if (!Array.isArray(spread)) {
        return { ok: false };
      }
      args.push(...spread);
    } else {
      args.push(getExportValue(argument, ctx));
    }
  }
  return invokeFunction(callee, args, ctx.session);
}

/**
 * Calls a function with already-evaluated arguments. An argument that could not
 * be resolved is `undefined`; it is passed along and makes anything that
 * depends on it unresolved.
 */
function invokeFunction(
  fn: FunctionRef,
  args: unknown[],
  session: Session
): CallResult {
  const node = fn.node;
  if (
    !node.body ||
    hasModifier(node, ts.SyntaxKind.AsyncKeyword) ||
    ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
      node.asteriskToken)
  ) {
    return { ok: false };
  }
  if (session.depth >= MAX_CALL_DEPTH || session.calls >= MAX_TOTAL_CALLS) {
    return { ok: false };
  }

  session.calls++;
  session.depth++;
  try {
    const scope = createScope(fn.scope);
    if (ts.isFunctionExpression(node) && node.name) {
      scope.vars.set(node.name.text, fn); // named function expressions can recurse
    }
    const ctx: EvalContext = { module: fn.module, session, scope };

    for (let i = 0; i < node.parameters.length; i++) {
      const parameter = node.parameters[i];
      if (!ts.isIdentifier(parameter.name)) {
        return { ok: false }; // destructured parameters are not supported
      }
      const name = parameter.name.text;

      if (parameter.dotDotDotToken) {
        scope.vars.set(name, args.slice(i));
        continue;
      }

      let value: unknown;
      if (i < args.length) {
        value = args[i];
        if (value === undefined && parameter.initializer) {
          return { ok: false }; // unknown whether the default would apply
        }
      } else if (parameter.initializer) {
        value = getExportValue(parameter.initializer, ctx);
      }
      scope.vars.set(name, value);
    }

    if (!ts.isBlock(node.body)) {
      const value = getExportValue(node.body, ctx);
      return { ok: value !== undefined, value };
    }
    const completion = runStatements(node.body.statements, ctx);
    if (completion.kind === 'return') {
      return { ok: true, value: completion.value };
    }
    return { ok: completion.kind === 'normal' };
  } finally {
    session.depth--;
  }
}

// ---------------------------------------------------------------------------
// Expression evaluation
// ---------------------------------------------------------------------------

function evaluateBinary(
  operator: ts.SyntaxKind,
  left: unknown,
  right: unknown
): unknown {
  switch (operator) {
    case ts.SyntaxKind.PlusToken:
      if (typeof left === 'number' && typeof right === 'number') {
        return left + right;
      }
      if (
        (typeof left === 'string' || typeof right === 'string') &&
        isPrimitive(left) &&
        isPrimitive(right)
      ) {
        return String(left) + String(right);
      }
      return undefined;
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
      return isPrimitive(left) && isPrimitive(right)
        ? left === right
        : undefined;
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      return isPrimitive(left) && isPrimitive(right)
        ? left !== right
        : undefined;
    case ts.SyntaxKind.EqualsEqualsToken:
      return isPrimitive(left) && isPrimitive(right)
        ? left == right
        : undefined;
    case ts.SyntaxKind.ExclamationEqualsToken:
      return isPrimitive(left) && isPrimitive(right)
        ? left != right
        : undefined;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    switch (operator) {
      case ts.SyntaxKind.MinusToken:
        return left - right;
      case ts.SyntaxKind.AsteriskToken:
        return left * right;
      case ts.SyntaxKind.SlashToken:
        return left / right;
      case ts.SyntaxKind.PercentToken:
        return left % right;
      case ts.SyntaxKind.AsteriskAsteriskToken:
        return left ** right;
      case ts.SyntaxKind.LessThanToken:
        return left < right;
      case ts.SyntaxKind.LessThanEqualsToken:
        return left <= right;
      case ts.SyntaxKind.GreaterThanToken:
        return left > right;
      case ts.SyntaxKind.GreaterThanEqualsToken:
        return left >= right;
    }
  } else if (typeof left === 'string' && typeof right === 'string') {
    switch (operator) {
      case ts.SyntaxKind.LessThanToken:
        return left < right;
      case ts.SyntaxKind.LessThanEqualsToken:
        return left <= right;
      case ts.SyntaxKind.GreaterThanToken:
        return left > right;
      case ts.SyntaxKind.GreaterThanEqualsToken:
        return left >= right;
    }
  }
  return undefined;
}

/** `Ns.A` / `Ns["A"]` where `Ns` is `import * as Ns from '...'`. */
function resolveNamespaceMember(
  initializer: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  ctx: EvalContext
): unknown {
  if (!ts.isIdentifier(initializer.expression)) {
    return undefined;
  }
  const objectName = initializer.expression.text;
  if (findScope(objectName, ctx.scope)) {
    return undefined; // shadowed by a local
  }
  const binding = ctx.module.imports.get(objectName);
  if (binding?.kind !== 'namespace') {
    return undefined;
  }

  let memberName: string | undefined;
  if (ts.isPropertyAccessExpression(initializer)) {
    memberName = ts.isIdentifier(initializer.name)
      ? initializer.name.text
      : undefined;
  } else if (
    ts.isStringLiteral(initializer.argumentExpression) ||
    ts.isNoSubstitutionTemplateLiteral(initializer.argumentExpression)
  ) {
    memberName = initializer.argumentExpression.text;
  }
  if (memberName === undefined) {
    return undefined;
  }

  const target = loadModule(ctx.module.file, binding.specifier, ctx.session);
  return target ? resolveExport(target, memberName, ctx.session) : undefined;
}

function getExportValue(initializer: ts.Expression, ctx: EvalContext): unknown {
  // Transparent wrappers: (x), x as const, x satisfies T, <T>x, x!
  if (
    ts.isParenthesizedExpression(initializer) ||
    ts.isAsExpression(initializer) ||
    ts.isSatisfiesExpression(initializer) ||
    ts.isTypeAssertionExpression(initializer) ||
    ts.isNonNullExpression(initializer)
  ) {
    return getExportValue(initializer.expression, ctx);
  }

  if (initializer.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (initializer.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (initializer.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  if (
    ts.isStringLiteral(initializer) ||
    ts.isNoSubstitutionTemplateLiteral(initializer)
  ) {
    return initializer.text;
  }
  if (ts.isNumericLiteral(initializer)) {
    return Number(initializer.text);
  }

  if (ts.isIdentifier(initializer)) {
    return lookup(initializer.text, ctx);
  }

  if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
    return new FunctionRef(initializer, ctx.module, ctx.scope);
  }

  if (ts.isCallExpression(initializer)) {
    return evaluateCall(initializer, ctx).value;
  }

  if (ts.isConditionalExpression(initializer)) {
    const condition = getExportValue(initializer.condition, ctx);
    if (condition === undefined) {
      return undefined;
    }
    return getExportValue(
      condition ? initializer.whenTrue : initializer.whenFalse,
      ctx
    );
  }

  if (
    ts.isPropertyAccessExpression(initializer) ||
    ts.isElementAccessExpression(initializer)
  ) {
    return resolveNamespaceMember(initializer, ctx);
  }

  if (ts.isTemplateExpression(initializer)) {
    let result = initializer.head.text;
    for (const span of initializer.templateSpans) {
      const value = getExportValue(span.expression, ctx);
      if (!isPrimitive(value)) {
        return undefined;
      }
      result += String(value) + span.literal.text;
    }
    return result;
  }

  if (ts.isBinaryExpression(initializer)) {
    const operator = initializer.operatorToken.kind;
    const left = getExportValue(initializer.left, ctx);
    if (left === undefined) {
      return undefined;
    }

    // Short-circuiting operators only evaluate the right side when needed.
    if (
      operator === ts.SyntaxKind.QuestionQuestionToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      const takeRight =
        operator === ts.SyntaxKind.QuestionQuestionToken
          ? left === null
          : operator === ts.SyntaxKind.BarBarToken
            ? !left
            : !!left;
      return takeRight ? getExportValue(initializer.right, ctx) : left;
    }

    const right = getExportValue(initializer.right, ctx);
    if (right === undefined) {
      return undefined;
    }
    return evaluateBinary(operator, left, right);
  }

  if (ts.isPrefixUnaryExpression(initializer)) {
    const value = getExportValue(initializer.operand, ctx);
    switch (initializer.operator) {
      case ts.SyntaxKind.ExclamationToken:
        return value === undefined ? undefined : !value;
      case ts.SyntaxKind.MinusToken:
        return typeof value === 'number' ? -value : undefined;
      case ts.SyntaxKind.PlusToken:
        return typeof value === 'number' ? value : undefined;
    }
    return undefined;
  }

  if (ts.isArrayLiteralExpression(initializer)) {
    return initializer.elements.map((element) =>
      toPlainValue(getExportValue(element, ctx))
    );
  }

  if (ts.isObjectLiteralExpression(initializer)) {
    const object: Record<string, unknown> = {};
    for (const property of initializer.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = getPropertyName(property.name);
        if (!name) {
          continue;
        }
        const value = toPlainValue(getExportValue(property.initializer, ctx));
        if (value !== undefined) {
          object[name] = value;
        }
      } else if (ts.isShorthandPropertyAssignment(property)) {
        // { A } -> look up A (a local, a const, or an import)
        const value = toPlainValue(lookup(property.name.text, ctx));
        if (value !== undefined) {
          object[property.name.text] = value;
        }
      }
    }
    return object;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function readScriptMetadata(
  file: string,
  allowProperties: string[],
  options: ReadScriptMetadataOptions = {}
): Record<string, unknown> {
  const session: Session = {
    modules: new Map(),
    values: new Map(),
    resolving: new Set(),
    compilerOptions: {
      ...DEFAULT_COMPILER_OPTIONS,
      ...options.compilerOptions,
    },
    depth: 0,
    calls: 0,
    iterations: 0,
  };

  const entryFile = path.resolve(file);
  const entry = parseModule(entryFile, fs.readFileSync(entryFile, 'utf8'));
  session.modules.set(entryFile, entry);

  const metadata: Record<string, unknown> = {};
  for (const name of allowProperties) {
    // Budgets are per requested property, so one runaway value cannot starve
    // the others.
    session.calls = 0;
    session.iterations = 0;
    const value = toPlainValue(resolveExport(entry, name, session));
    if (value !== undefined) {
      metadata[name] = value;
    }
  }
  return metadata;
}
