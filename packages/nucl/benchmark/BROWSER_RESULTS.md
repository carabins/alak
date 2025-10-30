# Nucl vs Quark - Browser Benchmark Results

**Date:** 30.10.2025, 20:02:02
**Browser:** Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36

## Summary

| Implementation | Avg Ops/ms | vs Quark |
|----------------|----------:|----------:|
| Quark (baseline) | 12 275,11 | 0% |
| Nucl (bare) | 6 015,566 | -50.99% |
| Nucl+plugins | 6 040,331 | -50.79% |
| HeavyNucl | 6 030,691 | -50.87% |

## Detailed Results

| Test | Quark | Nucl | Nucl+plugins | HeavyNucl |
|------|------:|-----:|-------------:|----------:|
| Create empty | 12 658,23 | 6 849,32 | 6 802,72 | 7 462,69 |
| Create with value | 14 492,75 | 6 410,26 | 6 535,95 | 6 493,51 |
| Get value | 14 619,88 | 6 561,68 | 6 544,5 | 6 468,31 |
| Set value | 13 215,86 | 6 147,54 | 6 329,11 | 5 769,23 |
| Add listener | 13 157,89 | 6 172,84 | 6 097,56 | 6 097,56 |
| Notify 1 listener | 10 638,3 | 5 555,56 | 5 747,13 | 5 813,95 |
| Notify 5 listeners | 7 142,86 | 4 411,76 | 4 225,35 | 4 109,59 |
