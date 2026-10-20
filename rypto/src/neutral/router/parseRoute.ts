import { removeLastSplitIndex } from './removeLastSplitIndex.js';
import { splitRoute } from './splitRoute.js';
import { RouteSyntaxError } from './routeSyntaxError.js';
import { decode } from './matchRoute.js';
import { OPTIONAL, OPTIONAL_WILDCARD, PARAM, WILDCARD } from './utils.js';

export type Part =
  { kind: 'text'; value: string } | { kind: 'param'; name: string };

export type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; parts: Part[]; regex: RegExp; single?: string }
  | { type: 'optional'; name: string }
  | { type: 'wildcard'; name: string }
  | { type: 'optionalWildcard'; name: string };

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
    return { type: 'static', value: decode(raw) };
  for (const part of parts)
    if (part.kind === 'text') part.value = decode(part.value);

  const source = parts
    .map((p) => (p.kind === 'text' ? escapeRegex(p.value) : '(.+?)'))
    .join('');
  const regex = new RegExp(`^${source}$`, 's');
  const single =
    parts.length === 1 && parts[0].kind === 'param' ? parts[0].name : undefined;
  return { type: 'dynamic', parts, regex, single };
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
