import { buildEntries, type Index } from './buildEntries.js';
import { createEntry, type Entry } from './createEntry.js';
import { matchRoute } from './matchRoute.js';

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

export class Router<T> {
  #entries: Entry<T>[] = [];
  #index: Index<T> | undefined;

  /** Register a pattern (or a file path such as `/blog/[slug]/index`). */
  add(pattern: string, value: T): this {
    this.#entries.push(createEntry(pattern, value));
    this.#index = undefined; // rebuilt on the next match, not on every add
    return this;
  }

  /** Match `path`, `path?query` or `path?query#hash`. Only the path takes part in matching. */
  match(url: string): Match<T> | null {
    const index = (this.#index ??= buildEntries(this.#entries));
    return matchRoute(url, index);
  }
}
