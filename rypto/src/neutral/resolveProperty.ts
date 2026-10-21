function resolveSplitProperty(
  object: unknown,
  remaining: string[]
): { found: boolean; value: unknown } {
  if (remaining.length === 0) {
    return { found: true, value: object };
  }
  if (object === null || typeof object !== 'object') {
    return { found: false, value: undefined };
  }
  for (let i = remaining.length; i > 0; i--) {
    const key = remaining.slice(0, i).join('.');
    if (!Object.hasOwn(object, key)) continue;
    const result = resolveSplitProperty(
      object[key as keyof typeof object],
      remaining.slice(i)
    );
    if (result.found) return result;
  }
  return { found: false, value: undefined };
}

export function resolveProperty(
  root: Record<string, unknown>,
  property: string
): unknown | undefined {
  const result = resolveSplitProperty(root, property.split('.'));
  return result.found ? result.value : undefined;
}
