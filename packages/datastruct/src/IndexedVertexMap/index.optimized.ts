interface IndexedVertexMap<K extends string, T> {
  map: Map<K, Map<number, T>>;
  indexes: Map<K, number>;
}

// Highly optimized IndexedVertexMap implementation
export default function IndexedVertexMap<K extends string = string, T = any>() {
  // Using object literal instead of prototype to reduce method lookup overhead
  const instance = {
    map: new Map<K, Map<number, T>>(),
    indexes: new Map<K, number>(),
    
    push(key: K, value: T): string {
      // Get or create the map for this key
      let keyMap = this.map.get(key);
      if (!keyMap) {
        keyMap = new Map<number, T>();
        this.map.set(key, keyMap);
        this.indexes.set(key, 0);
      }
      
      // Get current counter and increment
      const counter = this.indexes.get(key)!;
      const index = counter.toString();
      keyMap.set(counter, value);
      this.indexes.set(key, counter + 1);
      return index;
    },
    
    get(key: K): T[] {
      const keyMap = this.map.get(key);
      return keyMap ? [...keyMap.values()] : [];
    },
    
    clearAll(): void {
      this.map.clear();
      this.indexes.clear();
    },
    
    clearKey(key: K): void {
      this.map.delete(key);
      this.indexes.delete(key);
    },
    
    remove(key: K, index: string): void {
      const numIndex = Number(index);
      const keyMap = this.map.get(key);
      if (keyMap) {
        keyMap.delete(numIndex);
        // Clean up if map becomes empty to save memory
        if (keyMap.size === 0) {
          this.map.delete(key);
          this.indexes.delete(key);
        }
      }
    },
    
    forEach(key: K, iterator: (value: T, index: string) => void): void {
      const keyMap = this.map.get(key);
      if (keyMap) {
        keyMap.forEach((value, numIndex) => {
          iterator(value, numIndex.toString());
        });
      }
    },
    
    has(key: K): boolean {
      return this.map.has(key);
    },
    
    size(key: K): number {
      const keyMap = this.map.get(key);
      return keyMap ? keyMap.size : 0;
    }
  };
  
  return instance;
}