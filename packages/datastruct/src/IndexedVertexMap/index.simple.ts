interface SimpleIndexedVertexMap<K extends string, T> {
  map: Map<K, T[]>;
}

// Simplified version without index tracking - just using array push
export default function SimpleIndexedVertexMap<K extends string = string, T = any>() {
  const map = new Map<K, T[]>();
  
  return {
    map,
    
    push(key: K, value: T): string {
      let keyArray = map.get(key);
      if (!keyArray) {
        keyArray = [];
        map.set(key, keyArray);
      }
      
      const index = keyArray.length;
      keyArray.push(value);
      // Return the index as string for consistency
      return String(index);
    },
    
    get(key: K): T[] {
      return map.get(key) || [];
    },
    
    clearAll(): void {
      map.clear();
    },
    
    clearKey(key: K): void {
      map.delete(key);
    },
    
    remove(key: K, index: string): void {
      const keyArray = map.get(key);
      if (keyArray) {
        const numIndex = Number(index);
        if (numIndex >= 0 && numIndex < keyArray.length) {
          keyArray.splice(numIndex, 1);
        }
      }
    },
    
    forEach(key: K, iterator: (value: T, index: string) => void): void {
      const keyArray = map.get(key);
      if (keyArray) {
        for (let i = 0; i < keyArray.length; i++) {
          iterator(keyArray[i], String(i));
        }
      }
    },
    
    has(key: K): boolean {
      return map.has(key);
    },
    
    size(key: K): number {
      const keyArray = map.get(key);
      return keyArray ? keyArray.length : 0;
    }
  };
}