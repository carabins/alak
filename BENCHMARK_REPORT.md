# Reactivity Performance Benchmark (Comprehensive)

**Date:** 08.01.2026
**Runtime:** Bun 1.3.0
**System:** win32 x64

## Results (ops/ms - Higher is Better)

| Benchmark | Quark | Nucl | Atom | Vue | Signal | MobX | Valtio | Reatom | Winner |
|-----------|---|---|---|---|---|---|---|---|---|
| **Creation (Primitive)** | 11 837,85 | 9 547,56 | 365,22 | 14 959,98 | 68 280,83 | 6 040,41 | 1 428,78 | 1 392,09 | **Signal** |
| **Creation (Object)** | 19 164,5 | 10 189,48 | 364,6 | 4 471,91 | 24 622,05 | 551,2 | 1 491,02 | - | **Signal** |
| **Read (Primitive)** | 203 409,96 | 239 118,89 | 121 481,29 | 104 998,34 | 158 697,92 | 100 317,2 | 187 884,46 | 42 190,28 | **Nucl** |
| **Write (Primitive)** | 108 713,38 | 85 586,4 | 14 538,69 | 14 144,89 | 139 407,8 | 5 443,42 | 34 646,07 | 6 377,18 | **Signal** |
| **Computed Read (Cached)** | - | 308 851,69 | 81 106,62 | 61 924,87 | 93 093,4 | 17 282,37 | - | 5 401,87 | **Nucl** |
| **Computed Update** | - | 8 452,73 | 4 563,46 | 8 041,14 | 20 387,69 | 3 766,88 | - | 2 407,11 | **Signal** |
| **Deep Mutation** | - | 6 463,37 | - | 1 123,87 | - | 2 684,01 | 3 175,99 | - | **Nucl** |
| **Memory (1M units)** | 28.68 MB | 179.8 MB | 2382.38 MB | - | - | - | - | - | **Quark** |


*Note: Memory is measured in MB for 1,000,000 instances (Lower is Better).*