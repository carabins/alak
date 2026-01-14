interface IndexedVertexMap<K extends string, T> {
  map: Map<K, Map<number, T>>;
  indexes: Map<K, number>;
}

// Ultra-optimized IndexedVertexMap implementation
export default function IndexedVertexMap<K extends string = string, T = any>() {
  // Using object literal with outer-scoped variables for better performance
  const map = new Map<K, Map<number, T>>();
  const indexes = new Map<K, number>();
  
  return {
    map,
    indexes,
    
    push(key: K, value: T): string {
      // Use a more direct approach with a temporary variable to avoid double lookup
      let keyMap = map.get(key);
      if (!keyMap) {
        keyMap = new Map<number, T>();
        map.set(key, keyMap);
        indexes.set(key, 0);
      }
      
      const counter = indexes.get(key)!;
      // Directly work with the counter to avoid an extra lookup
      keyMap.set(counter, value);
      indexes.set(key, counter + 1);
      // Convert to string once and reuse
      return String(counter);
    },
    
    get(key: K): T[] {
      const keyMap = map.get(key);
      return keyMap ? [...keyMap.values()] : [];
    },
    
    clearAll(): void {
      map.clear();
      indexes.clear();
    },
    
    clearKey(key: K): void {
      map.delete(key);
      indexes.delete(key);
    },
    
    remove(key: K, index: string): void {
      // Parse number once
      const numIndex = Number(index);
      const keyMap = map.get(key);
      if (keyMap) {
        keyMap.delete(numIndex);
        // Clean up if map becomes empty to save memory
        if (keyMap.size === 0) {
          map.delete(key);
          indexes.delete(key);
        }
      }
    },
    
    forEach(key: K, iterator: (value: T, index: string) => void): void {
      const keyMap = map.get(key);
      if (keyMap) {
        // Use direct iteration for better performance
        keyMap.forEach((value, numIndex) => {
          iterator(value, String(numIndex));
        });
      }
    },
    
    has(key: K): boolean {
      return map.has(key);
    },
    
    size(key: K): number {
      const keyMap = map.get(key);
      return keyMap ? keyMap.size : 0;
    }
  };
}
