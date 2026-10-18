import { joinRoute } from '../src/router/joinRoute.js';
import { removeLastSplitIndex } from '../src/router/removeLastSplitIndex.js';
import { splitRoute } from '../src/router/splitRoute.js';

/*
 * Pattern syntax (one pattern segment between two '/'):
 *
 *   about            static text
 *   [name]           one required segment            -> string
 *   [[name]]         one optional segment (last)     -> string | undefined
 *   [...name]        one or more segments (last)     -> string[]
 *   [[...name]]      zero or more segments (last)    -> string[]
 *
 * `[name]` may be mixed with static text inside a segment (`[year]-[month]`,
 * `file.[ext]`), but two params must be separated by something.
 * Optional params and wildcards must fill a whole segment and be the last one.
 */

export type Part =
  { kind: 'text'; value: string } | { kind: 'param'; name: string };

export type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; parts: Part[]; regex: RegExp }
  | { type: 'optional'; name: string }
  | { type: 'wildcard'; name: string }
  | { type: 'optionalWildcard'; name: string };

export type Params = Record<string, string | string[]>;

export interface Match<T> {
  value: T;
  /** Params captured from the route pattern (`[slug]`, `[...rest]`, ...). */
  params: Params;
  /** The pattern that matched, as it was registered. */
  pattern: string;
  /** Path part of the URL, without query or hash. */
  pathname: string;
  /** Raw query string including the leading '?', or '' when empty. */
  search: string;
  /** Parsed query string; repeated keys are available through `getAll`. */
  searchParams: URLSearchParams;
  /** Raw fragment including the leading '#', or '' when empty. */
  hash: string;
}

export interface ParsedUrl {
  pathname: string;
  search: string;
  hash: string;
}

/** Split `path?query#hash`. The hash comes first, so a '?' inside it stays in the hash. */
export function parseUrl(url: string): ParsedUrl {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const rest = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const searchIndex = rest.indexOf('?');
  const search = searchIndex === -1 ? '' : rest.slice(searchIndex);
  const pathname = searchIndex === -1 ? rest : rest.slice(0, searchIndex);
  // like URL: a bare '?' or '#' is the same as nothing
  return {
    pathname,
    search: search === '?' ? '' : search,
    hash: hash === '#' ? '' : hash,
  };
}

export class RouteSyntaxError extends Error {
  constructor(pattern: string, message: string) {
    super(`Invalid route '${pattern}': ${message}`);
    this.name = 'RouteSyntaxError';
  }
}

const NAME = '[A-Za-z_$][\\w$]*';
const OPTIONAL_WILDCARD = new RegExp(`^\\[\\[\\.\\.\\.(${NAME})\\]\\]$`);
const WILDCARD = new RegExp(`^\\[\\.\\.\\.(${NAME})\\]$`);
const OPTIONAL = new RegExp(`^\\[\\[(${NAME})\\]\\]$`);
const PARAM = new RegExp(`\\[(${NAME})\\]`, 'g');

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseSegment(raw: string, pattern: string): Segment {
  let m: RegExpExecArray | null;
  if ((m = OPTIONAL_WILDCARD.exec(raw)))
    return { type: 'optionalWildcard', name: m[1] };
  if ((m = WILDCARD.exec(raw))) return { type: 'wildcard', name: m[1] };
  if ((m = OPTIONAL.exec(raw))) return { type: 'optional', name: m[1] };

  const parts: Part[] = [];
  let last = 0;
  for (const match of raw.matchAll(PARAM)) {
    const text = raw.slice(last, match.index);
    if (text) parts.push({ kind: 'text', value: text });
    else if (parts.length > 0) {
      throw new RouteSyntaxError(
        pattern,
        `params must be separated by something in '${raw}'`
      );
    }
    parts.push({ kind: 'param', name: match[1] });
    last = match.index! + match[0].length;
  }
  const tail = raw.slice(last);
  if (tail) parts.push({ kind: 'text', value: tail });

  if (parts.some((p) => p.kind === 'text' && /[[\]]/.test(p.value))) {
    throw new RouteSyntaxError(
      pattern,
      `bad bracket syntax in '${raw}' (optional params and wildcards must fill a whole segment)`
    );
  }
  if (!parts.some((p) => p.kind === 'param'))
    return { type: 'static', value: raw };

  const source = parts
    .map((p) => (p.kind === 'text' ? escapeRegex(p.value) : '(.+?)'))
    .join('');
  return { type: 'dynamic', parts, regex: new RegExp(`^${source}$`) };
}

export function parseRoute(pattern: string): Segment[] {
  const segments = removeLastSplitIndex(splitRoute(pattern)).map((raw) =>
    parseSegment(raw, pattern)
  );

  const names = new Set<string>();
  segments.forEach((seg, i) => {
    const isLast = i === segments.length - 1;
    if (
      (seg.type === 'optional' ||
        seg.type === 'wildcard' ||
        seg.type === 'optionalWildcard') &&
      !isLast
    ) {
      throw new RouteSyntaxError(
        pattern,
        `'${seg.type}' must be the last segment`
      );
    }
    const segNames =
      seg.type === 'static'
        ? []
        : seg.type === 'dynamic'
          ? seg.parts.flatMap((p) => (p.kind === 'param' ? [p.name] : []))
          : [seg.name];
    for (const name of segNames) {
      if (names.has(name))
        throw new RouteSyntaxError(pattern, `duplicate param name '${name}'`);
      names.add(name);
    }
  });
  return segments;
}

/** Lower = more specific. */
const rank = (s: Segment): number => {
  switch (s.type) {
    case 'static':
      return 0;
    case 'dynamic':
      return s.parts.length === 1 ? 2 : 1; // `[a]` vs `[a]-[b]`
    case 'optional':
      return 3;
    case 'wildcard':
      return 4;
    case 'optionalWildcard':
      return 5;
  }
};

/** Number of static characters in a dynamic segment (`x-[b]` -> 2). */
const staticLength = (s: Segment): number =>
  s.type === 'dynamic'
    ? s.parts.reduce((n, p) => n + (p.kind === 'text' ? p.value.length : 0), 0)
    : 0;

function compare(a: Segment[], b: Segment[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = rank(a[i]) - rank(b[i]);
    if (d !== 0) return d;
    // same rank: more static text in a mixed segment is more specific
    const s = staticLength(b[i]) - staticLength(a[i]);
    if (s !== 0) return s;
  }
  return a.length - b.length;
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Split a pathname into non-empty segments, decoding only the ones that need it. */
function toSegments(pathname: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i <= pathname.length; i++) {
    if (i === pathname.length || pathname.charCodeAt(i) === 47 /* '/' */) {
      if (i > start) {
        const segment = pathname.slice(start, i);
        out.push(segment.includes('%') ? decode(segment) : segment);
      }
      start = i + 1;
    }
  }
  return out;
}

function matchSegments(segments: Segment[], path: string[]): Params | null {
  let params: Params | undefined; // allocated on the first capture, not for every attempt
  let i = 0;
  for (const seg of segments) {
    switch (seg.type) {
      case 'static':
        if (path[i] !== seg.value) return null;
        i++;
        break;
      case 'dynamic': {
        const m = i < path.length ? seg.regex.exec(path[i]) : null;
        if (!m) return null;
        params ??= {};
        let g = 1;
        for (const p of seg.parts)
          if (p.kind === 'param') params[p.name] = m[g++];
        i++;
        break;
      }
      case 'optional':
        if (i < path.length) (params ??= {})[seg.name] = path[i++];
        break;
      case 'wildcard':
        if (i >= path.length) return null;
        (params ??= {})[seg.name] = path.slice(i);
        i = path.length;
        break;
      case 'optionalWildcard':
        (params ??= {})[seg.name] = path.slice(i);
        i = path.length;
        break;
    }
  }
  return i === path.length ? (params ?? {}) : null;
}

type StaticSegment = Extract<Segment, { type: 'static' }>;

interface Entry<T> {
  pattern: string;
  segments: Segment[];
  value: T;
  /** Fewest / most path segments this route can match. */
  min: number;
  max: number;
}

function bounds(segments: Segment[]): [min: number, max: number] {
  let min = 0;
  let max = 0;
  for (const s of segments) {
    if (s.type === 'optional') max++;
    else if (s.type === 'wildcard') {
      min++;
      max = Infinity;
    } else if (s.type === 'optionalWildcard') max = Infinity;
    else {
      min++;
      max++;
    }
  }
  return [min, max];
}

/**
 * Lookup structures built from the sorted routes. Each one only narrows the
 * candidates, the order of the sorted list still decides the winner:
 *
 * - `statics`: routes made only of static segments. Such a route beats every
 *   other route that matches the same URL, so an exact lookup is enough.
 * - `byFirst`: routes starting with a static segment, grouped by that segment.
 *   They all sort before the routes in `rest`, so they are tried first.
 * - `rest`: everything else (root, `[param]`, `[[optional]]`, wildcards first).
 */
interface Index<T> {
  statics: Map<string, Entry<T>>;
  byFirst: Map<string, Entry<T>[]>;
  rest: Entry<T>[];
}

function scan<T>(
  list: Entry<T>[],
  path: string[]
): { entry: Entry<T>; params: Params } | null {
  const n = path.length;
  for (const entry of list) {
    if (n < entry.min || n > entry.max) continue;
    const params = matchSegments(entry.segments, path);
    if (params) return { entry, params };
  }
  return null;
}

/** The result of a match. `searchParams` is a prototype getter, so no closure is allocated per match. */
class RouteMatch<T> implements Match<T> {
  #searchParams: URLSearchParams | undefined;

  constructor(
    readonly value: T,
    readonly params: Params,
    readonly pattern: string,
    readonly pathname: string,
    readonly search: string,
    readonly hash: string
  ) {}

  get searchParams(): URLSearchParams {
    return (this.#searchParams ??= new URLSearchParams(this.search)); // built on first access
  }
}

export class Router<T> {
  #entries: Entry<T>[] = [];
  #index: Index<T> | undefined;

  /** Register a pattern (or a file path such as `/blog/[slug]/index`). */
  add(pattern: string, value: T): this {
    const segments = parseRoute(pattern);
    const [min, max] = bounds(segments);
    this.#entries.push({ pattern, segments, value, min, max });
    this.#index = undefined; // rebuilt on the next match, not on every add
    return this;
  }

  #build(): Index<T> {
    const sorted = [...this.#entries].sort((a, b) =>
      compare(a.segments, b.segments)
    ); // stable
    const statics = new Map<string, Entry<T>>();
    const byFirst = new Map<string, Entry<T>[]>();
    const rest: Entry<T>[] = [];
    for (const entry of sorted) {
      const { segments } = entry;
      if (segments.every((s): s is StaticSegment => s.type === 'static')) {
        const key = joinRoute(segments.map((s) => s.value));
        if (!statics.has(key)) statics.set(key, entry); // first registered wins
      }
      const first = segments[0];
      if (first?.type === 'static') {
        const list = byFirst.get(first.value);
        if (list) list.push(entry);
        else byFirst.set(first.value, [entry]);
      } else {
        rest.push(entry);
      }
    }
    return { statics, byFirst, rest };
  }

  /** Match `path`, `path?query` or `path?query#hash`. Only the path takes part in matching. */
  match(url: string): Match<T> | null {
    const { statics, byFirst, rest } = (this.#index ??= this.#build());
    const { pathname, search, hash } = parseUrl(url);

    // fast path: exact static route (a '%' means decoding could change the segments)
    if (!pathname.includes('%')) {
      const trimmed =
        pathname.length > 1 && pathname.charCodeAt(pathname.length - 1) === 47
          ? pathname.slice(0, -1)
          : pathname;
      const hit = statics.get(trimmed);
      if (hit)
        return new RouteMatch(
          hit.value,
          {},
          hit.pattern,
          pathname,
          search,
          hash
        );
    }

    const path = toSegments(pathname);
    const bucket = path.length > 0 ? byFirst.get(path[0]) : undefined;
    const found = (bucket && scan(bucket, path)) || scan(rest, path);
    if (!found) return null;
    const { entry, params } = found;
    return new RouteMatch(
      entry.value,
      params,
      entry.pattern,
      pathname,
      search,
      hash
    );
  }
}
