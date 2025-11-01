# Nucl vs Quark vs Vue Reactivity Performance Comparison

## Summary of Results

### Creation & Basic Operations

| Operation | Quark | Nucl | Vue Reactive | Vue Ref |
|-----------|-------|------|--------------|---------|
| Create empty | 14,951.71 ops/ms | 4,850.6 ops/ms | 5,849.08 ops/ms | 40,663.63 ops/ms |
| Get primitive | 9,514.33 ops/ms | 10,083.47 ops/ms | - | 18,376.31 ops/ms |
| Set primitive | 23,276.49 ops/ms | 8,840.87 ops/ms | - | 15,945.71 ops/ms |

### Deep Tracking Operations

| Operation | Nucl with Deep Tracking | Vue Deep Reactivity |
|-----------|------------------------|--------------------|
| Deep tracking operations | 397.16 ops/ms | 871.83 ops/ms |

## Key Observations

1. **Quark** is the fastest for primitive operations:
   - Set operations: 23,276 ops/ms
   - It's the bare-metal reactivity primitive with minimal overhead

2. **Nucl** has significant overhead compared to Quark but provides more features:
   - Set operations: 8,840 ops/ms (vs 23,276 for Quark)
   - The overhead comes from the plugin system and additional functionality
   - However, Nucl provides path-based access like `getDeep`, `setDeep`, and `watchDeep` when deep tracking is enabled

3. **Vue Ref** is fastest for value creation and competitive for primitive access:
   - Creation: 40,663 ops/ms
   - Get operations: 18,376 ops/ms
   - Set operations: 15,945 ops/ms

4. **Vue Reactive** is fastest for deep reactivity operations compared to Nucl with deep tracking:
   - Vue reactive: 871.83 ops/ms
   - Nucl with deep tracking: 397.16 ops/ms
   - This makes sense since Vue's reactivity system is built from the ground up for deep reactivity

5. **Feature Comparison**:
   - **Quark**: Minimalist, fastest primitive operations, extensible via Nucl
   - **Nucl**: More features (plugins, deep tracking, fusion), good performance considering functionality
   - **Vue**: Natural deep reactivity, good performance across the board

## Conclusions

- If you need raw performance for primitive operations, Quark is the fastest
- If you need powerful deep tracking with path-based access, Vue Reactive has better performance
- Nucl provides a balanced approach with good performance considering its extensibility and plugin system
- The deep tracking functionality in Nucl is implemented via proxies and path-based operations, which has more overhead than Vue's native deep reactivity system
- Nucl's plugin system allows for powerful extensibility at the cost of some performance overhead