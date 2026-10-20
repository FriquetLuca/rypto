import type { Index } from './buildEntries.js';
import type { Entry } from './createEntry.js';
import type { Segment } from './parseRoute.js';
import { parseUrl } from './parseUrl.js';
import type { Match, Params } from './router.js';
import { splitRoute } from './splitRoute.js';

export const decode: (s: string) => string = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function matchSegments(segments: Segment[], path: string[]): Params | null {
  let params: Params | undefined;
  let i = 0;
  for (const seg of segments) {
    switch (seg.type) {
      case 'static':
        if (path[i] !== seg.value) return null;
        i++;
        break;
      case 'dynamic': {
        if (i >= path.length) return null;
        if (seg.single !== undefined) {
          (params ??= {})[seg.single] = path[i];
        } else {
          const m = seg.regex.exec(path[i]);
          if (!m) return null;
          params ??= {};
          let g = 1;
          for (const p of seg.parts)
            if (p.kind === 'param') params[p.name] = m[g++];
        }
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
    return (this.#searchParams ??= new URLSearchParams(this.search));
  }
}

export function matchRoute<T>(
  url: string,
  { statics, byFirst, rest }: Index<T>
): RouteMatch<T> | null {
  const { pathname, search, hash } = parseUrl(url);
  if (!pathname.includes('%')) {
    const trimmed =
      pathname.length > 1 && pathname.charCodeAt(pathname.length - 1) === 47
        ? pathname.slice(0, -1)
        : pathname;
    const hit = statics.get(trimmed);
    if (hit)
      return new RouteMatch(hit.value, {}, hit.pattern, pathname, search, hash);
  }
  const path = splitRoute(pathname).map((segment) =>
    segment.includes('%') ? decode(segment) : segment
  );
  const bucket = path.length > 0 ? byFirst.get(path[0]) : undefined;
  const found = (bucket && scan(bucket, path)) || scan(rest, path);
  if (!found) return null;
  return new RouteMatch(
    found.entry.value,
    found.params,
    found.entry.pattern,
    pathname,
    search,
    hash
  );
}
