# Quark Baseline Performance Results

**Date:** 29.10.2025, 21:05:02
**Runtime:** Bun 1.3.0
**Platform:** win32 (x64)

## Summary

- **Total Operations:** 5 570 000
- **Total Time:** 553.22ms
- **Average Performance:** 10 068,33 ops/ms

## Detailed Results

### Creation

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Create empty quark | 100 000 | 16.05 | 6 232,08 |
| Create with value | 100 000 | 6.08 | 16 450,89 |
| Create with options | 100 000 | 5.56 | 17 982,05 |
| Create with realm | 100 000 | 6.60 | 15 151,97 |
| Create with all options | 100 000 | 7.03 | 14 217,47 |

### Get/Set

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Get value | 1 000 000 | 4.57 | 218 598,35 |
| Set value (no listeners) | 1 000 000 | 6.24 | 160 379,78 |
| Set value (1 listener) | 100 000 | 1.27 | 79 020,15 |
| Set value (5 listeners) | 100 000 | 1.55 | 64 653,78 |
| Set value (10 listeners) | 100 000 | 2.15 | 46 522,45 |

### Listeners

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set value (no listeners) | 1 000 000 | 6.24 | 160 379,78 |
| Set value (1 listener) | 100 000 | 1.27 | 79 020,15 |
| Set value (5 listeners) | 100 000 | 1.55 | 64 653,78 |
| Set value (10 listeners) | 100 000 | 2.15 | 46 522,45 |
| Add listener | 100 000 | 7.73 | 12 937,78 |
| Remove listener | 100 000 | 9.82 | 10 187,45 |
| Notify 1 listener | 100 000 | 1.34 | 74 576,78 |
| Notify 5 listeners | 100 000 | 1.98 | 50 380,37 |
| Notify 10 listeners | 100 000 | 2.75 | 36 417,93 |
| Add event listener | 50 000 | 6.83 | 7 316,57 |
| Remove event listener | 50 000 | 8.11 | 6 167,97 |
| Emit with wildcard listener | 50 000 | 4.34 | 11 508,01 |

### Events

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Add event listener | 50 000 | 6.83 | 7 316,57 |
| Remove event listener | 50 000 | 8.11 | 6 167,97 |
| Emit local event | 50 000 | 2.80 | 17 855,23 |
| Emit realm event | 50 000 | 4.01 | 12 462,3 |
| Emit with wildcard listener | 50 000 | 4.34 | 11 508,01 |

### Special Modes

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set with dedup (same value) | 100 000 | 1.00 | 99 760,57 |
| Set with dedup (different value) | 100 000 | 2.02 | 49 544,19 |
| Set with stateless | 100 000 | 2.02 | 49 458,43 |
| Set with pipe transform | 100 000 | 1.13 | 88 472,09 |
| Set with pipe reject | 100 000 | 1.28 | 78 051,83 |

### Combined Operations

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Full workflow (create + subscribe + set) | 50 000 | 5.82 | 8 598,3 |
| Realm communication | 10 000 | 395.55 | 25,28 |
| Complex quark lifecycle | 10 000 | 7.10 | 1 409,42 |

## Key Findings

### Fastest Operations
- **Get value**: 218 598,35 ops/ms
- **Set value (no listeners)**: 160 379,78 ops/ms
- **Set with dedup (same value)**: 99 760,57 ops/ms
- **Set with pipe transform**: 88 472,09 ops/ms
- **Set value (1 listener)**: 79 020,15 ops/ms

### Slowest Operations
- **Realm communication**: 25,28 ops/ms
- **Complex quark lifecycle**: 1 409,42 ops/ms
- **Remove event listener**: 6 167,97 ops/ms
- **Create empty quark**: 6 232,08 ops/ms
- **Add event listener**: 7 316,57 ops/ms

## Notes

This is the baseline performance measurement before applying optimizations from PERFORMANCE.md.
Future benchmarks should be compared against these results to measure improvement.

Target improvements:
- Creation: +30-40%
- Get/Set: +25-35%
- Events: +20-30%
- Memory: -40-50% allocations
