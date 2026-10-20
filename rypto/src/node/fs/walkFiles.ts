import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export async function walkFiles(dirPath: string): Promise<string[]> {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  const childPaths: string[] = [];
  const directories: string[] = [];
  for (const entry of entries) {
    const currPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      directories.push(currPath);
    } else if (entry.isFile()) {
      childPaths.push(currPath);
    }
  }
  const nestedChilds = await Promise.all(
    directories.map((childPath) => walkFiles(childPath))
  );
  for (const directories of nestedChilds) {
    for (const directory of directories) {
      childPaths.push(directory);
    }
  }
  return childPaths;
}

export function walkFilesSync(dirPath: string, acc: string[] = []): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFilesSync(entryPath, acc);
    } else if (entry.isFile()) {
      acc.push(entryPath);
    }
  }
  return acc;
}
