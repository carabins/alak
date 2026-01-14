import OriginalIndexedVertexMap from '../src/IndexedVertexMap';
import OptimizedIndexedVertexMap from '../src/IndexedVertexMap/index.optimized';
import UltraOptimizedIndexedVertexMap from '../src/IndexedVertexMap/index.ultra-optimized';
import SimpleIndexedVertexMap from '../src/IndexedVertexMap/index.simple';
import fs from 'fs';
import path from 'path';

// Function to generate a unique filename for each benchmark run
function generateBenchmarkFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
  const filename = `IndexedVertexMap_benchmark_${timestamp}.json`;
  return path.join(__dirname, 'results', filename);
}

// Helper function to measure execution time of a function
function measureTime<T>(fn: () => T): { result: T, time: number } {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const time = Number(end - start) / 1000000; // Convert to milliseconds
  return { result, time };
}

// Benchmark function for a specific implementation
function runBenchmarkForImplementation(name: string, createInstance: () => any) {
  console.log(`\nRunning benchmark for ${name} implementation...`);
  const ivm = createInstance();
  const iterations = 100000;

  // Test push operation
  const pushResult = measureTime(() => {
    for (let i = 0; i < iterations; i++) {
      const key = `key_${i % 10}`; // Use 10 different keys
      ivm.push(key, { id: i, data: `data_${i}` });
    }
  });

  // Test get operation
  const getResult = measureTime(() => {
    for (let i = 0; i < 10; i++) { // Test with 10 different keys
      const key = `key_${i}`;
      const result = ivm.get(key);
    }
  });

  // Test forEach operation
  const forEachResult = measureTime(() => {
    for (let i = 0; i < 10; i++) { // Test with 10 different keys
      const key = `key_${i}`;
      ivm.forEach(key, (value: any, index: string) => {
        // Do nothing, just iterate
      });
    }
  });

  // Test size operation
  const sizeResult = measureTime(() => {
    for (let i = 0; i < 10; i++) { // Test with 10 different keys
      const key = `key_${i}`;
      const size = ivm.size(key);
    }
  });

  // Test remove operation
  const removeResult = measureTime(() => {
    for (let i = 0; i < 1000; i++) { // Remove 1000 items
      const key = `key_${i % 10}`;
      // For simple version, we'll remove first element
      const arr = ivm.get(key);
      if (arr && arr.length > 0) {
        ivm.remove(key, '0');
      }
    }
  });

  console.log(`${name} Results:`);
  console.log(`  Push time: ${pushResult.time}ms`);
  console.log(`  Get time: ${getResult.time}ms`);
  console.log(`  ForEach time: ${forEachResult.time}ms`);
  console.log(`  Size time: ${sizeResult.time}ms`);
  console.log(`  Remove time: ${removeResult.time}ms`);

  return {
    push: pushResult.time,
    get: getResult.time,
    forEach: forEachResult.time,
    size: sizeResult.time,
    remove: removeResult.time
  };
}

// Main benchmark function
function runBenchmark() {
  console.log(`Running benchmark with ${100000} operations...`);

  const originalResults = runBenchmarkForImplementation('Original', () => OriginalIndexedVertexMap());
  const optimizedResults = runBenchmarkForImplementation('Optimized', () => OptimizedIndexedVertexMap());
  const ultraOptimizedResults = runBenchmarkForImplementation('Ultra-Optimized', () => UltraOptimizedIndexedVertexMap());
  const simpleResults = runBenchmarkForImplementation('Simple (No Indexes)', () => SimpleIndexedVertexMap());

  // Calculate performance improvements compared to original
  const improvementsOptimized = {
    push: ((originalResults.push - optimizedResults.push) / originalResults.push) * 100,
    get: ((originalResults.get - optimizedResults.get) / originalResults.get) * 100,
    forEach: ((originalResults.forEach - optimizedResults.forEach) / originalResults.forEach) * 100,
    size: ((originalResults.size - optimizedResults.size) / originalResults.size) * 100,
    remove: ((originalResults.remove - optimizedResults.remove) / originalResults.remove) * 100
  };

  const improvementsUltraOptimized = {
    push: ((originalResults.push - ultraOptimizedResults.push) / originalResults.push) * 100,
    get: ((originalResults.get - ultraOptimizedResults.get) / originalResults.get) * 100,
    forEach: ((originalResults.forEach - ultraOptimizedResults.forEach) / originalResults.forEach) * 100,
    size: ((originalResults.size - ultraOptimizedResults.size) / originalResults.size) * 100,
    remove: ((originalResults.remove - ultraOptimizedResults.remove) / originalResults.remove) * 100
  };

  const improvementsSimple = {
    push: ((originalResults.push - simpleResults.push) / originalResults.push) * 100,
    get: ((originalResults.get - simpleResults.get) / originalResults.get) * 100,
    forEach: ((originalResults.forEach - simpleResults.forEach) / originalResults.forEach) * 100,
    size: ((originalResults.size - simpleResults.size) / originalResults.size) * 100,
    remove: ((originalResults.remove - simpleResults.remove) / originalResults.remove) * 100
  };

  console.log('\nPerformance Improvements (%):');
  console.log('Compared to Original:');
  console.log(`  Optimized Push: ${improvementsOptimized.push.toFixed(2)}%`);
  console.log(`  Optimized Get: ${improvementsOptimized.get.toFixed(2)}%`);
  console.log(`  Optimized ForEach: ${improvementsOptimized.forEach.toFixed(2)}%`);
  console.log(`  Optimized Size: ${improvementsOptimized.size.toFixed(2)}%`);
  console.log(`  Optimized Remove: ${improvementsOptimized.remove.toFixed(2)}%`);
  console.log(`\n  Ultra-Optimized Push: ${improvementsUltraOptimized.push.toFixed(2)}%`);
  console.log(`  Ultra-Optimized Get: ${improvementsUltraOptimized.get.toFixed(2)}%`);
  console.log(`  Ultra-Optimized ForEach: ${improvementsUltraOptimized.forEach.toFixed(2)}%`);
  console.log(`  Ultra-Optimized Size: ${improvementsUltraOptimized.size.toFixed(2)}%`);
  console.log(`  Ultra-Optimized Remove: ${improvementsUltraOptimized.remove.toFixed(2)}%`);
  console.log(`\n  Simple (No Indexes) Push: ${improvementsSimple.push.toFixed(2)}%`);
  console.log(`  Simple (No Indexes) Get: ${improvementsSimple.get.toFixed(2)}%`);
  console.log(`  Simple (No Indexes) ForEach: ${improvementsSimple.forEach.toFixed(2)}%`);
  console.log(`  Simple (No Indexes) Size: ${improvementsSimple.size.toFixed(2)}%`);
  console.log(`  Simple (No Indexes) Remove: ${improvementsSimple.remove.toFixed(2)}%`);

  // Create results object
  const benchmarkResults = {
    timestamp: new Date().toISOString(),
    iterations: 100000,
    original: originalResults,
    optimized: optimizedResults,
    ultraOptimized: ultraOptimizedResults,
    simple: simpleResults,
    improvementsOptimized: improvementsOptimized,
    improvementsUltraOptimized: improvementsUltraOptimized,
    improvementsSimple: improvementsSimple
  };

  // Save results to a file
  const filename = generateBenchmarkFilename();
  
  // Ensure results directory exists
  const resultsDir = path.dirname(filename);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(filename, JSON.stringify(benchmarkResults, null, 2));
  console.log(`\nDetailed benchmark results saved to: ${filename}`);

  return benchmarkResults;
}

// Run the benchmark
runBenchmark();