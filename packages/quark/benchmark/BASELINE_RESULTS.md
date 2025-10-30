# Quark Baseline Performance Results

**Date:** 30.10.2025, 09:11:41
**Runtime:** Bun 1.3.0
**Platform:** win32 (x64)

## Summary

- **Total Operations:** 5 570 000
- **Total Time:** 515.39ms
- **Average Performance:** 10 807,35 ops/ms

## Detailed Results

### Creation

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Create empty quark | 100 000 | 6.10 | 16 393,44 |
| Create with value | 100 000 | 8.50 | 11 769 |
| Create with options | 100 000 | 4.98 | 20 083,55 |
| Create with realm | 100 000 | 5.41 | 18 480,53 |
| Create with all options | 100 000 | 4.87 | 20 521,24 |

### Get/Set

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Get value | 1 000 000 | 2.45 | 407 348,57 |
| Set value (no listeners) | 1 000 000 | 3.79 | 263 852,24 |
| Set value (1 listener) | 100 000 | 1.26 | 79 239,3 |
| Set value (5 listeners) | 100 000 | 1.57 | 63 865,12 |
| Set value (10 listeners) | 100 000 | 2.11 | 47 290,27 |

### Listeners

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set value (no listeners) | 1 000 000 | 3.79 | 263 852,24 |
| Set value (1 listener) | 100 000 | 1.26 | 79 239,3 |
| Set value (5 listeners) | 100 000 | 1.57 | 63 865,12 |
| Set value (10 listeners) | 100 000 | 2.11 | 47 290,27 |
| Add listener | 100 000 | 6.00 | 16 678,06 |
| Remove listener | 100 000 | 7.05 | 14 186,21 |
| Notify 1 listener | 100 000 | 1.28 | 78 339,21 |
| Notify 5 listeners | 100 000 | 1.96 | 50 996,99 |
| Notify 10 listeners | 100 000 | 3.20 | 31 269,54 |
| Add event listener | 50 000 | 5.22 | 9 580,75 |
| Remove event listener | 50 000 | 6.90 | 7 244,59 |
| Emit with wildcard listener | 50 000 | 4.08 | 12 256,4 |

### Events

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Add event listener | 50 000 | 5.22 | 9 580,75 |
| Remove event listener | 50 000 | 6.90 | 7 244,59 |
| Emit local event | 50 000 | 2.44 | 20 505,25 |
| Emit realm event | 50 000 | 4.36 | 11 470,78 |
| Emit with wildcard listener | 50 000 | 4.08 | 12 256,4 |

### Special Modes

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set with dedup (same value) | 100 000 | 1.03 | 96 646,37 |
| Set with dedup (different value) | 100 000 | 2.49 | 40 228,5 |
| Set with stateless | 100 000 | 1.36 | 73 730 |
| Set with pipe transform | 100 000 | 1.88 | 53 098,28 |
| Set with pipe reject | 100 000 | 1.18 | 85 012,33 |

### Combined Operations

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Full workflow (create + subscribe + set) | 50 000 | 4.97 | 10 067,86 |
| Realm communication | 10 000 | 386.43 | 25,88 |
| Complex quark lifecycle | 10 000 | 7.59 | 1 316,67 |

## Key Findings

### Fastest Operations
- **Get value**: 407 348,57 ops/ms
- **Set value (no listeners)**: 263 852,24 ops/ms
- **Set with dedup (same value)**: 96 646,37 ops/ms
- **Set with pipe reject**: 85 012,33 ops/ms
- **Set value (1 listener)**: 79 239,3 ops/ms

### Slowest Operations
- **Realm communication**: 25,88 ops/ms
- **Complex quark lifecycle**: 1 316,67 ops/ms
- **Remove event listener**: 7 244,59 ops/ms
- **Add event listener**: 9 580,75 ops/ms
- **Full workflow (create + subscribe + set)**: 10 067,86 ops/ms

## Notes

This is the baseline performance measurement before applying optimizations from PERFORMANCE.md.
Future benchmarks should be compared against these results to measure improvement.

Target improvements:
- Creation: +30-40%
- Get/Set: +25-35%
- Events: +20-30%
- Memory: -40-50% allocations
