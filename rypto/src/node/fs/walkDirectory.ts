import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export async function walkDirectory(dirPath: string): Promise<string[]> {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  const childPaths: string[] = [];
  const directories: string[] = [];
  for (const entry of entries) {
    const currPath = path.join(dirPath, entry.name);
    const isDir = entry.isDirectory();
    if (entry.isFile() || isDir) {
      childPaths.push(currPath);
      if (isDir) directories.push(currPath);
    }
  }
  const nestedChilds = await Promise.all(
    directories.map((childPath) => walkDirectory(childPath))
  );
  for (const directories of nestedChilds) {
    for (const directory of directories) {
      childPaths.push(directory);
    }
  }
  return childPaths;
}

export function walkDirectorySync(
  dirPath: string,
  acc: string[] = []
): string[] {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    const isDir = entry.isDirectory();
    if (entry.isFile() || isDir) {
      acc.push(entryPath);
      if (isDir) walkDirectorySync(entryPath, acc);
    }
  }
  return acc;
}
