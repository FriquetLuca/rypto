function deepCopySymbolMap<K, V>(original: Map<K, V>): Map<K, V> {
  const newMap = new Map<K, V>();
  for (const [key, value] of original) {
    const clonedValue = Array.isArray(value)
      ? [...value]
      : typeof value === 'object' && value !== null
        ? { ...value }
        : value;
    newMap.set(key, clonedValue as V);
  }
  return newMap;
}

export class Scope<T> {
  private symbols = new Map<string, T>();
  public readonly parent: Scope<T> | null = null;
  constructor(parent: Scope<T> | null = null) {
    this.parent = parent;
  }
  public copy(): Scope<T> {
    const newScope = new Scope(this.parent);
    newScope.symbols = deepCopySymbolMap(this.symbols);
    return newScope;
  }
  public define(name: string, value: T): void {
    this.symbols.set(name, value);
  }
  public resolve(name: string): T | null {
    if (this.symbols.has(name)) {
      return this.symbols.get(name)!;
    }
    if (this.parent) {
      return this.parent.resolve(name);
    }
    return null;
  }
  public existsInCurrentScope(name: string): boolean {
    return this.symbols.has(name);
  }
}
