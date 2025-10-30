# Nucl vs Quark Performance Comparison

**Date:** 30.10.2025, 20:08:18
**Runtime:** Bun 1.3.0
**Platform:** win32 (x64)

## Summary

| Implementation | Avg Ops/ms | Overhead |
|----------------|----------:|----------:|
| Quark (baseline) | 13 146,978 | 0% |
| Nucl (bare) | 13 881,126 | -5.58% |
| Nucl+plugins | 16 191,351 | -23.16% |
| HeavyNucl | 16 564,512 | -25.99% |

## Detailed Results

### Performance Comparison (ops/ms)

| Test | Quark | Nucl | Nucl+plugins | HeavyNucl | Overhead (Nucl) | Overhead (Plugins) | Overhead (Heavy) |
|------|------:|-----:|-------------:|----------:|----------------:|-------------------:|-----------------:|
| Create empty | 15 861,18 | 9 426,4 | 14 923,37 | 22 104,33 | 40.57% | 5.91% | -39.36% |
| Create with value | 11 517,42 | 15 401,68 | 20 034,46 | 16 061,68 | -33.73% | -73.95% | -39.46% |
| Create with object value | 28 079,63 | 16 044,93 | 19 942,57 | 17 389,49 | 42.86% | 28.98% | 38.07% |
| Get value | 13 439,16 | 21 688,68 | 21 109,87 | 21 440,18 | -61.38% | -57.08% | -59.54% |
| Set value | 13 191,32 | 18 691,17 | 19 141,91 | 18 690,19 | -41.69% | -45.11% | -41.69% |
| Set value repeatedly | 9 594,53 | 12 029,64 | 14 922,7 | 13 186,52 | -25.38% | -55.53% | -37.44% |
| Add listener | 11 312,22 | 14 024,07 | 15 270,67 | 17 432,84 | -23.97% | -34.99% | -54.11% |
| Notify 1 listener | 9 238,47 | 11 644,56 | 13 179,05 | 13 552,16 | -26.04% | -42.65% | -46.69% |
| Notify 5 listeners | 6 088,87 | 5 979 | 7 197,56 | 9 223,22 | 1.80% | -18.21% | -51.48% |

## Analysis

### Overhead Breakdown

1. **Nucl (bare)** - -5.58% overhead
   - Cost of plugin system infrastructure (prototype chain, hooks)
   - Minimal impact on basic operations

2. **Nucl+plugins** - -23.16% overhead
   - Includes nucleus plugin (universal + array + object methods)
   - Additional prototype properties and methods

3. **HeavyNucl** - -25.99% overhead
   - Same as Nucl+plugins (uses same implementation)
   - Convenience wrapper for full feature set

### ✅ Excellent Performance

The overhead is minimal (< 5%), making Nucl suitable for performance-critical applications.

## Recommendations

- **Hot paths / Performance-critical code**: Use bare Quark or Nucl
- **General application code**: Use Nucl+plugins or HeavyNucl
- **Developer experience**: HeavyNucl provides best DX with auto-installed features
