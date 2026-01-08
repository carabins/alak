# Reactivity Performance Benchmark (Comprehensive)

**Date:** 07.01.2026
**Runtime:** Bun 1.3.0
**System:** win32 x64

## Results (ops/ms - Higher is Better)

| Benchmark | Quark | Nucl | Vue | Signal | MobX | Valtio | Reatom | Winner |
|-----------|---|---|---|---|---|---|---|---|
| **Creation (Primitive)** | 16 985,95 | 13 672,93 | 19 752,85 | 95 465,39 | 8 023,56 | 1 878,54 | 1 823,42 | **Signal** |
| **Creation (Object)** | 23 413,72 | 15 675,7 | 5 213,13 | 34 788,9 | 711,07 | 1 887,01 | - | **Signal** |
| **Read (Primitive)** | 401 848,5 | 547 417,29 | 127 373,61 | 251 788,96 | 136 026,66 | 326 049,39 | 55 779,23 | **Nucl** |
| **Write (Primitive)** | 160 743,28 | 113 484,19 | 23 788,23 | 197 863,08 | 6 721,9 | 49 633,21 | 8 831,25 | **Signal** |
| **Computed Read (Cached)** | - | 336 354,92 | 85 527,47 | 114 447,9 | 23 454 | - | 7 140,33 | **Nucl** |
| **Computed Update** | - | 12 464,85 | 9 852,39 | 26 041,67 | 4 620,47 | - | 2 939,55 | **Signal** |
| **Deep Mutation** | - | 8 381,6 | 1 789,7 | - | 3 786,39 | 4 410,4 | - | **Nucl** |
| **Memory (1M units)** | 28.06 MB | 174 MB | - | - | - | - | - | **Quark** |


*Note: Memory is measured in MB for 1,000,000 instances (Lower is Better).*