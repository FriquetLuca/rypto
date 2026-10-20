export function splitRoute(pathname: string): string[] {
  const out: string[] = [];
  for (let i = 0, start = 0; i <= pathname.length; i++) {
    if (i === pathname.length || pathname.charCodeAt(i) === 47 /* '/' */) {
      if (i > start) {
        out.push(pathname.slice(start, i));
      }
      start = i + 1;
    }
  }
  return out;
}
