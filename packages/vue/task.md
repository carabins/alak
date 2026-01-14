# Vue Integration Tasks

## Summary
Vue integration should be simplified to focus on **ref** plugin for Nucl only. Complex plugin composition (StateReactivePlugin, ViewMarkerPlugin, etc.) is over-engineered.


## Tasks

### 1. Simplify Vue Integration
- [ ] Consolidate plugins into single **RefPlugin** for Nucl
- [ ] Focus on making Nucl values work with Vue's `ref()` directly
- [ ] Remove unnecessary proxy-based state management

### 2. Fix Plugin System Issues
- [ ] Resolve plugin initialization order problems
- [ ] Ensure onCreate hooks complete before onQuarkProperty is called
- [ ] Consider removing eager/lazy initialization complexity

### 3. Plugin Architecture Decision
- [ ] Decide: Should Vue integration wrap Nucl or extend it?
- [ ] Current approach: Plugin-based extension (complex)
- [ ] Alternative: Simpler wrapper with direct ref() support

### 4. Test Files
- [ ] Clean up/consolidate test structure
- [ ] Remove redundant test cases
- [ ] Focus on core ref functionality testing

### 5. Documentation
- [ ] Document simplified ref plugin API
- [ ] Provide usage examples
- [ ] Explain limitations vs full Vue reactivity

## Open Questions
1. Should `atom.state` use Vue reactivity or plain proxies?
2. Is `atom.view` namespace needed or should we use `atom.refs`?
3. How tightly should Vue integrate with Nucl vs stay as separate layer?

## Key Files
- `/packages/vue/src/atomic-state/index.ts` - StateReactivePlugin (may be removable)
- `/packages/vue/src/atomic-marker/index.ts` - ViewMarkerPlugin (unclear benefit)
- `/packages/vue/src/quark/index.ts` - VueQuarkRefPlugin (needs redesign)
