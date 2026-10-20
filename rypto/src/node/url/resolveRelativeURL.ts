import path from 'node:path';

export function resolveRelativeURL(
  root: string,
  url: string
): string | undefined {
  const segments: string[] = [];
  for (const segment of url.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    segments.push(segment);
  }
  const relative = path.relative(
    root,
    path.join(root, segments.join(path.sep))
  );
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return relative;
}
