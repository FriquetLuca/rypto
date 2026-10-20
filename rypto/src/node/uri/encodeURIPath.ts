import path from 'node:path';

export function encodeURIPath(filePath: string): string | undefined {
  try {
    return filePath.split(path.sep).map(encodeURIComponent).join('/');
  } catch {
    return undefined;
  }
}
