import SimpleKeyedArrays from '../src/SimpleKeyedArrays';
import fs from 'fs';
import path from 'path';

// Function to generate a unique filename for each benchmark run
function generateBenchmarkFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
  const filename = `SimpleKeyedArrays_benchmark_${timestamp}.json`;
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

// Benchmark function for a specific operation
function runBenchmarkForOperation(name: string, operation: () => void) {
  const result = measureTime(operation);
  console.log(`${name}: ${result.time}ms`);
  return result.time;
}

// Main benchmark function
function runBenchmark() {
  console.log('Running benchmark for SimpleKeyedArrays...');

  const skv = SimpleKeyedArrays<string, number>();
  const iterations = 100000;
  const arraySize = 100;

  // Pre-populate with data
  console.log(`Pre-populating with ${arraySize} items per key...`);
  for (let i = 0; i < arraySize; i++) {
    skv.push('key1', i);
    skv.push('key2', i * 2);
    skv.push('key3', i * 3);
  }

  // Benchmark push operation
  console.log('\nPush operation:');
  const pushTime = runBenchmarkForOperation('Push', () => {
    for (let i = 0; i < iterations; i++) {
      skv.push(`key_${i % 10}`, i);
    }
  });

  // Benchmark get operation
  console.log('\nGet operation:');
  const getTime = runBenchmarkForOperation('Get', () => {
    for (let i = 0; i < 1000; i++) {
      skv.get(`key_${i % 3}`);
    }
  });

  // Benchmark forEach operation (now directly using array's forEach)
  console.log('\nForEach operation (direct array forEach):');
  const forEachTime = runBenchmarkForOperation('ForEach', () => {
    for (let i = 0; i < 1000; i++) {
      skv.forEach(`key_${i % 3}`, (value, index) => {
        // Do something minimal
        const _ = value + index;
      });
    }
  });

  // Benchmark size operation
  console.log('\nSize operation:');
  const sizeTime = runBenchmarkForOperation('Size', () => {
    for (let i = 0; i < 1000; i++) {
      skv.size(`key_${i % 3}`);
    }
  });

  // Benchmark has operation
  console.log('\nHas operation:');
  const hasTime = runBenchmarkForOperation('Has', () => {
    for (let i = 0; i < 1000; i++) {
      skv.has(`key_${i % 3}`);
    }
  });

  // Create results object
  const benchmarkResults = {
    timestamp: new Date().toISOString(),
    iterations: iterations,
    arraySize: arraySize,
    results: {
      push: pushTime,
      get: getTime,
      forEach: forEachTime,
      size: sizeTime,
      has: hasTime
    }
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