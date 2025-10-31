# Nucl vs Quark - Browser Benchmark Results

**Date:** 30.10.2025, 20:38:52
**Browser:** Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0

## Summary

| Implementation | Avg Ops/ms | vs Quark |
|----------------|----------:|----------:|
| Quark (baseline) | 20 357,143 | 0% |
| Nucl (bare) | 18 284,161 | -10.18% |
| Nucl+plugins | 19 139,61 | -5.98% |
| HeavyNucl | 18 961,039 | -6.86% |

## Detailed Results

| Test | Quark | Nucl | Nucl+plugins | HeavyNucl |
|------|------:|-----:|-------------:|----------:|
| Create empty | 25 000 | 20 000 | 33 333,33 | 25 000 |
| Create with value | 25 000 | 20 000 | 20 000 | 20 000 |
| Get value | 25 000 | 21 739,13 | 22 727,27 | 22 727,27 |
| Set value | 20 000 | 18 750 | 18 750 | 20 000 |
| Add listener | 25 000 | 25 000 | 16 666,67 | 25 000 |
| Notify 1 listener | 12 500 | 12 500 | 12 500 | 12 500 |
| Notify 5 listeners | 10 000 | 10 000 | 10 000 | 7 500 |
