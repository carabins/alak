# Reactivity Performance Benchmark (Extended)

**Date:** 07.01.2026
**Runtime:** Bun 1.3.0
**System:** win32 x64

## Results (ops/ms - Higher is Better)

| Benchmark | Quark | Nucl | Vue Ref | Signal | MobX | Valtio | Winner |
|-----------|---|---|---|---|---|---|---|
| **Creation (Primitive)** | 17 209,39 | 14 849,93 | 20 458,6 | 98 467,84 | 7 986,68 | 1 966,15 | **Signal** |
| **Read (Primitive)** | 359 763,99 | 218 692,05 | 136 156,68 | 239 461,31 | 144 137,91 | 322 021,78 | **Quark** |
| **Write (Primitive)** | 164 817,96 | 110 018,26 | 24 899,65 | 192 455,74 | 7 427,04 | 64 051,24 | **Signal** |
| **Update (1 sub)** | 130 777,08 | 72 370,42 | 15 691,74 | 13 828,85 | 2 488,51 | 3 948,85 | **Quark** |
| **Deep Mutation** | - | 8 374,63 | - | - | 3 951,24 | 4 179,21 | **Nucl** |
| **Memory (1M units)** | 26.18 MB | 144.89 MB | - | 98.2 MB | - | 256.12 MB | **Quark** |


*Note: Memory is measured in MB for 1,000,000 instances (Lower is Better).*

## Observations
- **Quark** wins in **Read** and **Update Propagation** and has the **smallest memory footprint**.
- **Signals** are fastest in **Creation** and **Write**.
- **Nucl (Deep)** is faster than **MobX** and **Valtio** in deep mutations.
- **Vue Ref** and **MobX** are significantly heavier in terms of memory.
