# Quark Baseline Performance Results

**Date:** 29.10.2025, 20:53:58
**Runtime:** Bun 1.3.0
**Platform:** win32 (x64)

## Summary

- **Total Operations:** 5 570 000
- **Total Time:** 633.91ms
- **Average Performance:** 8 786,74 ops/ms

## Detailed Results

### Creation

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Create empty quark | 100 000 | 7.15 | 13 982,69 |
| Create with value | 100 000 | 13.11 | 7 627,71 |
| Create with options | 100 000 | 3.49 | 28 628,69 |
| Create with realm | 100 000 | 5.90 | 16 950,59 |
| Create with all options | 100 000 | 6.38 | 15 667,35 |

### Get/Set

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Get value | 1 000 000 | 2.87 | 348 153,05 |
| Set value (no listeners) | 1 000 000 | 5.65 | 176 950,44 |
| Set value (1 listener) | 100 000 | 2.92 | 34 228,99 |
| Set value (5 listeners) | 100 000 | 6.28 | 15 921,79 |
| Set value (10 listeners) | 100 000 | 9.53 | 10 491,42 |

### Listeners

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set value (no listeners) | 1 000 000 | 5.65 | 176 950,44 |
| Set value (1 listener) | 100 000 | 2.92 | 34 228,99 |
| Set value (5 listeners) | 100 000 | 6.28 | 15 921,79 |
| Set value (10 listeners) | 100 000 | 9.53 | 10 491,42 |
| Add listener | 100 000 | 9.64 | 10 374,63 |
| Remove listener | 100 000 | 6.66 | 15 021,56 |
| Notify 1 listener | 100 000 | 3.48 | 28 709,23 |
| Notify 5 listeners | 100 000 | 6.35 | 15 741,09 |
| Notify 10 listeners | 100 000 | 12.16 | 8 224,23 |
| Add event listener | 50 000 | 6.15 | 8 127,04 |
| Remove event listener | 50 000 | 5.58 | 8 958 |
| Emit with wildcard listener | 50 000 | 5.79 | 8 633,34 |

### Events

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Add event listener | 50 000 | 6.15 | 8 127,04 |
| Remove event listener | 50 000 | 5.58 | 8 958 |
| Emit local event | 50 000 | 2.80 | 17 842,49 |
| Emit realm event | 50 000 | 4.18 | 11 962,58 |
| Emit with wildcard listener | 50 000 | 5.79 | 8 633,34 |

### Special Modes

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set with dedup (same value) | 100 000 | 1.81 | 55 129,83 |
| Set with dedup (different value) | 100 000 | 3.33 | 29 985,91 |
| Set with stateless | 100 000 | 4.11 | 24 336,82 |
| Set with pipe transform | 100 000 | 2.41 | 41 488,61 |
| Set with pipe reject | 100 000 | 2.50 | 39 988,8 |

### Combined Operations

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Full workflow (create + subscribe + set) | 50 000 | 11.77 | 4 248,56 |
| Realm communication | 10 000 | 430.48 | 23,23 |
| Complex quark lifecycle | 10 000 | 9.53 | 1 049,46 |

## Key Findings

### Fastest Operations
- **Get value**: 348 153,05 ops/ms
- **Set value (no listeners)**: 176 950,44 ops/ms
- **Set with dedup (same value)**: 55 129,83 ops/ms
- **Set with pipe transform**: 41 488,61 ops/ms
- **Set with pipe reject**: 39 988,8 ops/ms

### Slowest Operations
- **Realm communication**: 23,23 ops/ms
- **Complex quark lifecycle**: 1 049,46 ops/ms
- **Full workflow (create + subscribe + set)**: 4 248,56 ops/ms
- **Create with value**: 7 627,71 ops/ms
- **Add event listener**: 8 127,04 ops/ms

## Notes

This is the baseline performance measurement before applying optimizations from PERFORMANCE.md.
Future benchmarks should be compared against these results to measure improvement.

Target improvements:
- Creation: +30-40%
- Get/Set: +25-35%
- Events: +20-30%
- Memory: -40-50% allocations
