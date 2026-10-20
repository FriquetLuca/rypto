export function discardDotsSegmentsURL(url: string): string {
  const segments: string[] = [];
  for (const segment of url.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') {
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join('/')}`;
}
