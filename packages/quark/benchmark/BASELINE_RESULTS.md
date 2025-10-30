# Quark Baseline Performance Results

**Date:** 30.10.2025, 06:05:57
**Runtime:** Bun 1.3.0
**Platform:** win32 (x64)

## Summary

- **Total Operations:** 5 570 000
- **Total Time:** 514.59ms
- **Average Performance:** 10 824,15 ops/ms

## Detailed Results

### Creation

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Create empty quark | 100 000 | 6.16 | 16 227,18 |
| Create with value | 100 000 | 8.49 | 11 774,26 |
| Create with options | 100 000 | 5.75 | 17 378,31 |
| Create with realm | 100 000 | 5.31 | 18 831,33 |
| Create with all options | 100 000 | 4.78 | 20 910,88 |

### Get/Set

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Get value | 1 000 000 | 2.35 | 425 713,07 |
| Set value (no listeners) | 1 000 000 | 3.73 | 268 031,84 |
| Set value (1 listener) | 100 000 | 1.01 | 98 736,18 |
| Set value (5 listeners) | 100 000 | 1.48 | 67 344,6 |
| Set value (10 listeners) | 100 000 | 2.04 | 49 065,31 |

### Listeners

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set value (no listeners) | 1 000 000 | 3.73 | 268 031,84 |
| Set value (1 listener) | 100 000 | 1.01 | 98 736,18 |
| Set value (5 listeners) | 100 000 | 1.48 | 67 344,6 |
| Set value (10 listeners) | 100 000 | 2.04 | 49 065,31 |
| Add listener | 100 000 | 5.77 | 17 334,33 |
| Remove listener | 100 000 | 6.68 | 14 965,36 |
| Notify 1 listener | 100 000 | 1.26 | 79 327,3 |
| Notify 5 listeners | 100 000 | 1.91 | 52 375,22 |
| Notify 10 listeners | 100 000 | 3.15 | 31 777,3 |
| Add event listener | 50 000 | 5.28 | 9 470,41 |
| Remove event listener | 50 000 | 6.84 | 7 314 |
| Emit with wildcard listener | 50 000 | 4.00 | 12 513,77 |

### Events

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Add event listener | 50 000 | 5.28 | 9 470,41 |
| Remove event listener | 50 000 | 6.84 | 7 314 |
| Emit local event | 50 000 | 2.41 | 20 781,38 |
| Emit realm event | 50 000 | 4.11 | 12 155,69 |
| Emit with wildcard listener | 50 000 | 4.00 | 12 513,77 |

### Special Modes

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Set with dedup (same value) | 100 000 | 1.06 | 94 401,96 |
| Set with dedup (different value) | 100 000 | 2.41 | 41 450,78 |
| Set with stateless | 100 000 | 1.57 | 63 645,62 |
| Set with pipe transform | 100 000 | 1.86 | 53 743,21 |
| Set with pipe reject | 100 000 | 1.31 | 76 144,06 |

### Combined Operations

| Operation | Ops | Time (ms) | Ops/ms |
|-----------|----:|----------:|-------:|
| Full workflow (create + subscribe + set) | 50 000 | 4.84 | 10 334,64 |
| Realm communication | 10 000 | 386.36 | 25,88 |
| Complex quark lifecycle | 10 000 | 8.29 | 1 206,4 |

## Key Findings

### Fastest Operations
- **Get value**: 425 713,07 ops/ms
- **Set value (no listeners)**: 268 031,84 ops/ms
- **Set value (1 listener)**: 98 736,18 ops/ms
- **Set with dedup (same value)**: 94 401,96 ops/ms
- **Notify 1 listener**: 79 327,3 ops/ms

### Slowest Operations
- **Realm communication**: 25,88 ops/ms
- **Complex quark lifecycle**: 1 206,4 ops/ms
- **Remove event listener**: 7 314 ops/ms
- **Add event listener**: 9 470,41 ops/ms
- **Full workflow (create + subscribe + set)**: 10 334,64 ops/ms

## Notes

This is the baseline performance measurement before applying optimizations from PERFORMANCE.md.
Future benchmarks should be compared against these results to measure improvement.

Target improvements:
- Creation: +30-40%
- Get/Set: +25-35%
- Events: +20-30%
- Memory: -40-50% allocations
