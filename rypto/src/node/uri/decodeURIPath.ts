export function decodeURIPath(encodedURI: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(encodedURI);
  } catch {
    return undefined;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return undefined;
  }
  return decoded;
}
