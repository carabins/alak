import SimpleKeyedArrays from '../src/SimpleKeyedArrays';

// Example usage of direct array access for maximum performance
function exampleDirectAccess() {
  const skv = SimpleKeyedArrays<string, number>();
  
  // Populate with some data
  for (let i = 0; i < 100; i++) {
    skv.push('key1', i);
  }
  
  // Direct access to the array for maximum performance
  const array = skv.getArray('key1');
  if (array) {
    // Direct iteration on the array - maximum performance
    for (let i = 0; i < array.length; i++) {
      const value = array[i];
      // Do something with value
      const _ = value * 2;
    }
  }
  
  console.log('Direct access example completed');
}

exampleDirectAccess();