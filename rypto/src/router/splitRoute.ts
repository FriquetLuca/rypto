export const splitRoute = (routePath: string): string[] =>
  routePath.split('/').filter(Boolean);
