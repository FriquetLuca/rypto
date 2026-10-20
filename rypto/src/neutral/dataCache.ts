export class DataCache<T> {
  private readonly entries = new Map<string, T>();
  constructor() {}
  get(dataName: string, loader: (dataName: string) => T): T | undefined {
    const cached = this.entries.get(dataName);
    if (cached) {
      return cached;
    }
    let data: T;
    try {
      data = loader(dataName);
    } catch {
      return undefined;
    }
    this.entries.set(dataName, data);
    return data;
  }
  async getAsync(
    dataName: string,
    loader: (dataName: string) => Promise<T>
  ): Promise<T | undefined> {
    const cached = this.entries.get(dataName);
    if (cached) {
      return cached;
    }
    let data: T;
    try {
      data = await loader(dataName);
    } catch {
      return undefined;
    }
    this.entries.set(dataName, data);
    return data;
  }
  clear(): void {
    this.entries.clear();
  }
}
