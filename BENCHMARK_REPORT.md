# Reactivity Performance Benchmark (Comprehensive)

**Date:** 08.01.2026
**Runtime:** Bun 1.3.0
**System:** win32 x64

## Results (ops/ms - Higher is Better)

| Benchmark | Quark | Nucl | Atom | Vue | Signal | MobX | Valtio | Reatom | Winner |
|-----------|---|---|---|---|---|---|---|---|---|
| **Creation (Primitive)** | 26 823,17 | 13 198,29 | 450 775,33 | 18 491,53 | 86 497,71 | 6 693,2 | 1 552,49 | 1 402,78 | **Atom** |
| **Creation (Object)** | 19 964,3 | 11 771,57 | 102 747,47 | 4 844,54 | - | 555,59 | 1 466,12 | - | **Atom** |
| **Read (Primitive)** | 375 459,94 | 239 174,94 | 94 816,39 | 90 952,58 | 151 270,37 | 99 799 | 188 375 | 42 017,12 | **Quark** |
| **Write (Primitive)** | 137 826,48 | 93 908,18 | 14 317,42 | 16 882,22 | 149 033,52 | 4 942,1 | 60 080,63 | 5 944,55 | **Signal** |
| **Computed Read (Cached)** | - | 308 256,65 | 105 811,71 | 56 940,8 | 77 248,41 | 16 878,82 | - | 4 770,63 | **Nucl** |
| **Computed Update** | - | 10 253,19 | 4 833,38 | 8 165,79 | 22 802,31 | 3 676,68 | - | 2 067,17 | **Signal** |
| **Deep Mutation** | - | 5 728,64 | - | 1 263,48 | - | 2 593,2 | 2 954,66 | - | **Nucl** |
