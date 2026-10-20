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
  return {
    pathname: searchIndex === -1 ? rest : rest.slice(0, searchIndex),
    search: search === '?' ? '' : search,
    hash: hash === '#' ? '' : hash,
  };
}
