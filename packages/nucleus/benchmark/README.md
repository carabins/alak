# Nucleus Benchmarks

Performance benchmarks for nucleus implementations.

## Running Benchmarks

```bash
# Run proxy vs prototype benchmark
bun packages/nucleus/benchmark/proxy-vs-proto.ts
```

## Available Benchmarks

### proxy-vs-proto.ts

Compares performance between:
- **Proxy-based** implementation (current)
- **Prototype-based** implementation (alternative)

Tests include:
1. Creation performance
2. Creation with initial value
3. Set value performance
4. Get value performance
5. Subscribe (up) performance
6. Notify listeners performance
7. Property access performance
8. Method call performance
9. Realistic usage scenario

## Interpreting Results

- **ops/s**: Operations per second (higher is better)
- **ms**: Total time for all iterations (lower is better)
- **µs/op**: Microseconds per operation (lower is better)

Green results indicate better performance.
