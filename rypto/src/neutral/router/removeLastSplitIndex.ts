export const removeLastSplitIndex = (splitRoute: string[]): string[] =>
  splitRoute.length > 0 && splitRoute[splitRoute.length - 1] === 'index'
    ? splitRoute.slice(0, splitRoute.length - 1)
    : splitRoute;
