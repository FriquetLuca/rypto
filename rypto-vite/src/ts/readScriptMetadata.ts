import fs from 'node:fs';
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

interface EvalContext {
  /** Top-level `const` initializers, by name (exported or not). */
  declarations: Map<string, ts.Expression>;
  /** Already-resolved values (undefined = could not be resolved). */
  cache: Map<string, unknown>;
  /** Names currently being resolved, to break cycles (const A = B; const B = A). */
  resolving: Set<string>;
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

function resolveIdentifier(name: string, ctx: EvalContext): unknown {
  if (ctx.cache.has(name)) {
    return ctx.cache.get(name);
  }
  const initializer = ctx.declarations.get(name);
  if (!initializer || ctx.resolving.has(name)) {
    return undefined;
  }
  ctx.resolving.add(name);
  const value = getExportValue(initializer, ctx);
  ctx.resolving.delete(name);
  ctx.cache.set(name, value);
  return value;
}

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
    case ts.SyntaxKind.QuestionQuestionToken:
      return left ?? right;
    case ts.SyntaxKind.BarBarToken:
      return left || right;
    case ts.SyntaxKind.AmpersandAmpersandToken:
      return left && right;
  }

  if (typeof left !== 'number' || typeof right !== 'number') {
    return undefined;
  }
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
  }
  return undefined;
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
    return resolveIdentifier(initializer.text, ctx);
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
    const left = getExportValue(initializer.left, ctx);
    const right = getExportValue(initializer.right, ctx);
    if (left === undefined || right === undefined) {
      return undefined;
    }
    return evaluateBinary(initializer.operatorToken.kind, left, right);
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
    return initializer.elements.map((element) => getExportValue(element, ctx));
  }

  if (ts.isObjectLiteralExpression(initializer)) {
    const object: Record<string, unknown> = {};
    for (const property of initializer.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = getPropertyName(property.name);
        if (!name) {
          continue;
        }
        const value = getExportValue(property.initializer, ctx);
        if (value !== undefined) {
          object[name] = value;
        }
      } else if (ts.isShorthandPropertyAssignment(property)) {
        // { A } -> look up const A
        const value = resolveIdentifier(property.name.text, ctx);
        if (value !== undefined) {
          object[property.name.text] = value;
        }
      }
    }
    return object;
  }

  return undefined;
}

export function readScriptMetadata(
  file: string,
  allowProperties: string[]
): Record<string, unknown> {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(file)
  );

  // Pass 1: collect every top-level `const` (exported or not) so that
  // identifiers can be resolved regardless of declaration order.
  const ctx: EvalContext = {
    declarations: new Map(),
    cache: new Map(),
    resolving: new Set(),
  };
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    if (!(statement.declarationList.flags & ts.NodeFlags.Const)) {
      continue; // let/var can be reassigned, so they aren't safe to inline
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        ctx.declarations.set(declaration.name.text, declaration.initializer);
      }
    }
  }

  // Pass 2: evaluate the exported, allow-listed ones.
  const metadata: Record<string, unknown> = {};
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    );
    if (!isExported) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        continue;
      }
      const name = declaration.name.text;
      if (!allowProperties.includes(name)) {
        continue;
      }
      const value = resolveIdentifier(name, ctx);
      if (value !== undefined) {
        metadata[name] = value;
      }
    }
  }
  return metadata;
}
