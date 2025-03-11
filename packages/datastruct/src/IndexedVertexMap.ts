interface IndexedVertexMap<K extends string, T> {
  map: Map<K, Map<number, T>>;
  indexes: Map<K, number>;
}

const proto: ThisType<IndexedVertexMap<string, any>> = {
  push(key: string, value: any): string {
    if (!this.map.has(key)) {
      this.map.set(key, new Map());
      this.indexes.set(key, 0);
    }

    const counter = this.indexes.get(key);
    if (counter === undefined) throw new Error(`Key ${key} not initialized`);
    const index = counter.toString();
    this.map.get(key)!.set(counter, value);
    this.indexes.set(key, counter + 1);
    return index;
  },

  get(key: string): any[] {
    return Array.from(this.map.get(key)?.values() || []);
  },

  clearAll() {
    this.map.clear();
    this.indexes.clear();
  },

  clearKey(key: string) {
    this.map.delete(key);
    this.indexes.delete(key);
  },

  remove(key: string, index: string) {
    const numIndex = Number(index);
    this.map.get(key)?.delete(numIndex);
  },

  forEach(key: string, iterator: (value: any, index: string) => void) {
    this.map.get(key)?.forEach((v, k) => iterator(v, k.toString()));
  },

  has(key: string): boolean {
    return this.map.has(key);
  },

  size(key: string): number {
    return this.map.get(key)?.size || 0;
  }
};


export default function IndexedVertexMap() {
  const o = Object.create(proto)
  o.map = new Map()
  o.indexes = new Map()
  return o
}
