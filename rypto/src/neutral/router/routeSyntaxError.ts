export class RouteSyntaxError extends Error {
  constructor(pattern: string, message: string) {
    super(`Invalid route '${pattern}': ${message}`);
    this.name = 'RouteSyntaxError';
  }
}
