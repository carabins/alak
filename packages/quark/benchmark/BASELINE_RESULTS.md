# Quark Baseline Performance Results

**Date:** 01.11.2025, 15:15:04
**Runtime:** Bun 1.3.0
**Platform:** win32 (x64)

## Summary

- **Total Operations:** 5 570 000
- **Total Time:** 745.42ms
- **Average Performance:** 7 472,3 ops/ms

## Detailed Results

### Creation

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Create empty quark | 100 000 | 28.64 | 3 492,01 |
| Create with value | 100 000 | 28.02 | 3 568,62 |
| Create with options | 100 000 | 21.62 | 4 626,14 |
| Create with realm | 100 000 | 26.00 | 3 846,15 |
| Create with all options | 100 000 | 25.66 | 3 896,68 |

### Get/Set

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Get value | 1 000 000 | 2.15 | 464 662,42 |
| Set value (no listeners) | 1 000 000 | 4.74 | 211 104,07 |
| Set value (1 listener) | 100 000 | 1.20 | 83 430,67 |
| Set value (5 listeners) | 100 000 | 1.74 | 57 392,1 |
| Set value (10 listeners) | 100 000 | 2.30 | 43 504,74 |

### Listeners

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set value (no listeners) | 1 000 000 | 4.74 | 211 104,07 |
| Set value (1 listener) | 100 000 | 1.20 | 83 430,67 |
| Set value (5 listeners) | 100 000 | 1.74 | 57 392,1 |
| Set value (10 listeners) | 100 000 | 2.30 | 43 504,74 |
| Add listener | 100 000 | 26.39 | 3 788,63 |
| Remove listener | 100 000 | 28.07 | 3 561,98 |
| Notify 1 listener | 100 000 | 1.32 | 75 889,81 |
| Notify 5 listeners | 100 000 | 2.04 | 49 000,39 |
| Notify 10 listeners | 100 000 | 3.28 | 30 497,1 |
| Add event listener | 50 000 | 19.72 | 2 535,87 |
| Remove event listener | 50 000 | 16.60 | 3 012,79 |
| Emit with wildcard listener | 50 000 | 5.93 | 8 429,86 |

### Events

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Add event listener | 50 000 | 19.72 | 2 535,87 |
| Remove event listener | 50 000 | 16.60 | 3 012,79 |
| Emit local event | 50 000 | 3.49 | 14 338,15 |
| Emit realm event | 50 000 | 3.30 | 15 160,24 |
| Emit with wildcard listener | 50 000 | 5.93 | 8 429,86 |

### Special Modes

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set with dedup (same value) | 100 000 | 1.08 | 92 455,62 |
| Set with dedup (different value) | 100 000 | 2.57 | 38 845,51 |
| Set with stateless | 100 000 | 1.47 | 68 222,13 |
| Set with pipe transform | 100 000 | 2.00 | 49 977,51 |
| Set with pipe reject | 100 000 | 1.30 | 77 053,48 |

### Combined Operations

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Full workflow (create + subscribe + set) | 50 000 | 14.35 | 3 485,29 |
| Realm communication | 10 000 | 407.74 | 24,53 |
| Complex quark lifecycle | 10 000 | 10.47 | 955,33 |

## Key Findings

### Fastest Operations
- **Get value**: 464 662,42 ops/ms
- **Set value (no listeners)**: 211 104,07 ops/ms
- **Set with dedup (same value)**: 92 455,62 ops/ms
- **Set value (1 listener)**: 83 430,67 ops/ms
- **Set with pipe reject**: 77 053,48 ops/ms

### Slowest Operations
- **Realm communication**: 24,53 ops/ms
- **Complex quark lifecycle**: 955,33 ops/ms
- **Add event listener**: 2 535,87 ops/ms
- **Remove event listener**: 3 012,79 ops/ms
- **Full workflow (create + subscribe + set)**: 3 485,29 ops/ms

## Notes

This is the baseline performance measurement before applying optimizations from PERFORMANCE.md.
Future benchmarks should be compared against these results to measure improvement.

Target improvements:
- Creation: +30-40%
- Get/Set: +25-35%
- Events: +20-30%
- Memory: -40-50% allocations
