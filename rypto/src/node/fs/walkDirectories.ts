import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export async function walkDirectories(dirPath: string): Promise<string[]> {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  const childPaths = directories.map((entry) => path.join(dirPath, entry.name));
  const nestedChilds = await Promise.all(
    childPaths.map((childPath) => walkDirectories(childPath))
  );
  for (const directories of nestedChilds) {
    for (const directory of directories) {
      childPaths.push(directory);
    }
  }
  return childPaths;
}

export function walkDirectoriesSync(
  dirPath: string,
  acc: string[] = []
): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(dirPath, entry.name);
    acc.push(entryPath);
    walkDirectoriesSync(entryPath, acc);
  }
  return acc;
}
