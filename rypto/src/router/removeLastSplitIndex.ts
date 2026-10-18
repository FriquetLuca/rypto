export function removeLastSplitIndex(splitRoute: string[]): string[] {
  if (splitRoute.length > 0 && splitRoute[splitRoute.length - 1] === 'index') {
    return splitRoute.slice(0, splitRoute.length - 1);
  }
  return splitRoute;
}
