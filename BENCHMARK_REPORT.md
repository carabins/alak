# Reactivity Performance Benchmark (Comprehensive)

**Date:** 08.01.2026
**Runtime:** Bun 1.3.0
**System:** win32 x64

## Results (ops/ms - Higher is Better)

| Benchmark | Quark | Nucl | Atom | Vue | Signal | MobX | Valtio | Reatom | Winner |
|-----------|---|---|---|---|---|---|---|---|---|
| **Creation (Primitive)** | 13 366,95 | 10 756,57 | 78,31 | 15 591,58 | 70 214,86 | 6 068,26 | 1 460,39 | 1 420,57 | **Signal** |
| **Creation (Object)** | 19 657,26 | 10 797,5 | 75,04 | 4 277,72 | 24 377,76 | 585,03 | 1 517,46 | - | **Signal** |
| **Read (Primitive)** | 213 791,25 | 245 612,14 | 115 653,47 | 102 491,15 | 160 677,16 | 102 157,15 | 198 683,13 | 41 706,81 | **Nucl** |
| **Write (Primitive)** | 124 106,43 | 93 437,86 | 15 127,98 | 18 019,87 | 137 176,09 | 5 507,29 | 34 845,15 | 6 539,95 | **Signal** |
| **Computed Read (Cached)** | - | 307 276,3 | 66 340,71 | 66 014,01 | 85 397,83 | 18 267,28 | - | 5 663,03 | **Nucl** |
| **Computed Update** | - | 9 064,13 | 3 883,37 | 8 812,14 | 21 418,05 | 3 739,16 | - | 2 480,17 | **Signal** |
| **Deep Mutation** | - | 6 772,57 | - | 1 385,22 | - | 2 781,33 | 3 537,66 | - | **Nucl** |
| **Memory (1M units)** | 29.33 MB | 179.42 MB | 2049.24 MB | - | - | - | - | - | **Quark** |


*Note: Memory is measured in MB for 1,000,000 instances (Lower is Better).*