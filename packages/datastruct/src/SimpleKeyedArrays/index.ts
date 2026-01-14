interface SimpleKeyedArrays<K extends string, T> {
  map: Map<K, T[]>;
}

// Ultra-fast key-value array structure
export default function SimpleKeyedArrays<K extends string = string, T = any>() {
  const map = new Map<K, T[]>();
  
  return {
    map,
    
    push(key: K, value: T): number {
      let array = map.get(key);
      if (!array) {
        array = [];
        map.set(key, array);
      }
      
      const index = array.length;
      array.push(value);
      return index;
    },
    
    get(key: K): T[] {
      return map.get(key) || [];
    },
    
    set(key: K, array: T[]): void {
      map.set(key, array);
    },
    
    clearAll(): void {
      map.clear();
    },
    
    clearKey(key: K): void {
      map.delete(key);
    },
    
    remove(key: K, index: number): void {
      const array = map.get(key);
      if (array) {
        if (index >= 0 && index < array.length) {
          array.splice(index, 1);
        }
      }
    },
    
    // Direct access to the array's forEach method for maximum performance
    forEach(key: K, iterator: (value: T, index: number) => void): void {
      const array = map.get(key);
      if (array) {
        array.forEach(iterator);
      }
    },
    
    has(key: K): boolean {
      return map.has(key);
    },
    
    size(key: K): number {
      const array = map.get(key);
      return array ? array.length : 0;
    },
    
    // Provide direct access to the array if needed for maximum performance
    getArray(key: K): T[] | undefined {
      return map.get(key);
    }
  };
}