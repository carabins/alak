# Nucl vs Quark Performance Comparison

**Date:** 30.10.2025, 20:41:00
**Runtime:** Bun 1.3.0
**Platform:** win32 (x64)

## Summary

| Implementation | Avg Ops/ms | Overhead |
|----------------|----------:|----------:|
| Quark (baseline) | 12 526,681 | 0% |
| Nucl (bare) | 19 962,541 | -59.36% |
| Nucl+plugins | 23 566,969 | -88.13% |
| HeavyNucl | 23 065,249 | -84.13% |

## Detailed Results

### Performance Comparison (ops/ms)

| Test | Quark | Nucl | Nucl+plugins | HeavyNucl | Overhead (Nucl) | Overhead (Plugins) | Overhead (Heavy) |
|------|------:|-----:|-------------:|----------:|----------------:|-------------------:|-----------------:|
| Create empty | 14 273,48 | 11 543,21 | 15 471,25 | 31 547,73 | 19.13% | -8.39% | -121.02% |
| Create with value | 11 300,46 | 25 126,89 | 36 034,74 | 25 738,7 | -122.35% | -218.88% | -127.77% |
| Create with object value | 28 161,08 | 22 678,82 | 32 153,31 | 25 585,26 | 19.47% | -14.18% | 9.15% |
| Get value | 13 334,99 | 31 833,75 | 31 742,2 | 28 139,92 | -138.72% | -138.04% | -111.02% |
| Set value | 11 029,27 | 28 061,2 | 26 895,17 | 27 939,05 | -154.42% | -143.85% | -153.32% |
| Set value repeatedly | 9 943,22 | 20 027,24 | 15 763,42 | 20 426,92 | -101.42% | -58.53% | -105.44% |
| Add listener | 9 998,2 | 19 333,76 | 26 178,7 | 19 162,96 | -93.37% | -161.83% | -91.66% |
| Notify 1 listener | 9 162,21 | 15 524,58 | 16 867,67 | 19 265,22 | -69.44% | -84.10% | -110.27% |
| Notify 5 listeners | 5 537,22 | 5 533,42 | 10 996,26 | 9 781,48 | 0.07% | -98.59% | -76.65% |

## Analysis

### Overhead Breakdown

1. **Nucl (bare)** - -59.36% overhead
   - Cost of plugin system infrastructure (prototype chain, hooks)
   - Minimal impact on basic operations

2. **Nucl+plugins** - -88.13% overhead
   - Includes nucleus plugin (universal + array + object methods)
   - Additional prototype properties and methods

3. **HeavyNucl** - -84.13% overhead
   - Same as Nucl+plugins (uses same implementation)
   - Convenience wrapper for full feature set

### ✅ Excellent Performance

The overhead is minimal (< 5%), making Nucl suitable for performance-critical applications.

## Recommendations

- **Hot paths / Performance-critical code**: Use bare Quark or Nucl
- **General application code**: Use Nucl+plugins or HeavyNucl
- **Developer experience**: HeavyNucl provides best DX with auto-installed features
