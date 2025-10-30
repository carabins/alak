# Quark Baseline Performance Results

**Date:** 30.10.2025, 05:06:28
**Runtime:** Bun 1.3.0
**Platform:** win32 (x64)

## Summary

- **Total Operations:** 5 570 000
- **Total Time:** 516.68ms
- **Average Performance:** 10 780,37 ops/ms

## Detailed Results

### Creation

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Create empty quark | 100 000 | 14.35 | 6 967,52 |
| Create with value | 100 000 | 5.27 | 18 968,13 |
| Create with options | 100 000 | 5.19 | 19 277,11 |
| Create with realm | 100 000 | 5.55 | 18 026,14 |
| Create with all options | 100 000 | 6.19 | 16 145,44 |

### Get/Set

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Get value | 1 000 000 | 2.64 | 378 501,14 |
| Set value (no listeners) | 1 000 000 | 3.82 | 261 978,99 |
| Set value (1 listener) | 100 000 | 1.12 | 89 166,3 |
| Set value (5 listeners) | 100 000 | 1.43 | 69 876,32 |
| Set value (10 listeners) | 100 000 | 2.07 | 48 374,61 |

### Listeners

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set value (no listeners) | 1 000 000 | 3.82 | 261 978,99 |
| Set value (1 listener) | 100 000 | 1.12 | 89 166,3 |
| Set value (5 listeners) | 100 000 | 1.43 | 69 876,32 |
| Set value (10 listeners) | 100 000 | 2.07 | 48 374,61 |
| Add listener | 100 000 | 8.00 | 12 503,75 |
| Remove listener | 100 000 | 7.59 | 13 171,24 |
| Notify 1 listener | 100 000 | 1.40 | 71 418,37 |
| Notify 5 listeners | 100 000 | 1.71 | 58 366,89 |
| Notify 10 listeners | 100 000 | 2.58 | 38 738,67 |
| Add event listener | 50 000 | 6.48 | 7 715,81 |
| Remove event listener | 50 000 | 6.83 | 7 318,5 |
| Emit with wildcard listener | 50 000 | 3.99 | 12 545,48 |

### Events

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Add event listener | 50 000 | 6.48 | 7 715,81 |
| Remove event listener | 50 000 | 6.83 | 7 318,5 |
| Emit local event | 50 000 | 2.67 | 18 699,28 |
| Emit realm event | 50 000 | 3.96 | 12 639,35 |
| Emit with wildcard listener | 50 000 | 3.99 | 12 545,48 |

### Special Modes

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set with dedup (same value) | 100 000 | 0.90 | 110 692,94 |
| Set with dedup (different value) | 100 000 | 1.97 | 50 735,67 |
| Set with stateless | 100 000 | 1.99 | 50 311,93 |
| Set with pipe transform | 100 000 | 1.00 | 100 050,03 |
| Set with pipe reject | 100 000 | 1.27 | 78 814,63 |

### Combined Operations

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Full workflow (create + subscribe + set) | 50 000 | 6.20 | 8 064,65 |
| Realm communication | 10 000 | 378.73 | 26,4 |
| Complex quark lifecycle | 10 000 | 6.04 | 1 655,38 |

## Key Findings

### Fastest Operations
- **Get value**: 378 501,14 ops/ms
- **Set value (no listeners)**: 261 978,99 ops/ms
- **Set with dedup (same value)**: 110 692,94 ops/ms
- **Set with pipe transform**: 100 050,03 ops/ms
- **Set value (1 listener)**: 89 166,3 ops/ms

### Slowest Operations
- **Realm communication**: 26,4 ops/ms
- **Complex quark lifecycle**: 1 655,38 ops/ms
- **Create empty quark**: 6 967,52 ops/ms
- **Remove event listener**: 7 318,5 ops/ms
- **Add event listener**: 7 715,81 ops/ms

## Notes

This is the baseline performance measurement before applying optimizations from PERFORMANCE.md.
Future benchmarks should be compared against these results to measure improvement.

Target improvements:
- Creation: +30-40%
- Get/Set: +25-35%
- Events: +20-30%
- Memory: -40-50% allocations
