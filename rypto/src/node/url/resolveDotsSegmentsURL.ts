export function resolveDotsSegmentsURL(url: string): string {
  const segments: string[] = [];
  for (const segment of url.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join('/')}`;
}
