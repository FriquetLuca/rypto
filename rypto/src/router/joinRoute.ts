export const joinRoute = (splitRoute: string[]): string =>
  `/${splitRoute.join('/')}`;
