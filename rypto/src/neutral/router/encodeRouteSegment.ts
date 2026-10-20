import { SYNTAX_TOKEN } from './utils.js';

function encodeText(text: string, staticRoute: boolean) {
  const comp = encodeURIComponent(text);
  if (staticRoute) return comp;
  return comp.replace(/%5B/g, '[').replace(/%5D/g, ']');
}

/**
 * Turn one file or folder name into a pattern segment: the text is URL-encoded, the router
 * syntax (`[name]`, `[...name]`, `[[name]]`, `[[...name]]`) is kept as is.
 *
 *   'hello world'   -> 'hello%20world'
 *   'café.[ext]'    -> 'caf%C3%A9.[ext]'
 *   '[slug]'        -> '[slug]'
 */
export function encodeRouteSegment(
  segment: string,
  staticRoute = false
): string {
  let out = '';
  let last = 0;
  for (const match of segment.matchAll(SYNTAX_TOKEN)) {
    out += encodeText(segment.slice(last, match.index), staticRoute) + match[0];
    last = match.index! + match[0].length;
  }
  return out + encodeText(segment.slice(last), staticRoute);
}
