# Quark Tests

Complete test suite for `@alaq/quark` package covering Bun, Node.js, and Browser environments.

## Test Suites

### 1. Unit Tests (Bun)

**Files:** `essence.test.ts`, `coverage.test.ts`

Basic unit tests covering all features and edge cases. Runs in Bun runtime.

```bash
bun test
```

**Results:**
- ✅ 36 tests passed
- 100% code coverage

---

### 2. Node.js Runtime Tests

**File:** `node.test.mjs`

Verifies compatibility with pure Node.js runtime (v24+).

**Build & Run:**
```bash
# Build Node.js bundle
bun build src/index.ts --outfile=dist/quark.mjs --format=esm --target=node

# Run tests
node test/node.test.mjs
```

**Results:**
- ✅ 37 tests passed
- All features working in Node.js
- Performance: <1ms for 10,000 updates

---

### 3. Browser Tests

**File:** `browser.html`

Interactive browser test suite with visual results.

**Build & Run:**
```bash
# Build browser bundle (IIFE with global Quark variable)
npx esbuild src/index.ts --bundle --format=iife --global-name=Quark --outfile=dist/quark.browser.js

# Open in browser
start test/browser.html
```

**Features tested:**
- ✅ Basic creation and operations
- ✅ Listeners and subscriptions
- ✅ Events and realms
- ✅ Special modes (dedup, stateless, pipe)
- ✅ Performance benchmarks
- ✅ DOM integration patterns
- ✅ Memory tests (1000+ quarks)

---

## Test Coverage

All test suites cover:

1. **Creation**
   - Empty quarks
   - With initial value
   - With options (realm, id, dedup, stateless, pipe)

2. **Get/Set Operations**
   - Reading via `q.value`
   - Writing via `q(newValue)`
   - Multiple rapid updates

3. **Listeners**
   - `up()` - subscribe with immediate call
   - `down()` - unsubscribe
   - `silent()` - temporary disable
   - Multiple concurrent listeners

4. **Events**
   - Local events
   - Cross-realm events
   - Wildcard listeners (`*` and `*:*`)
   - `QUARK_AWAKE` lifecycle event

5. **Special Modes**
   - `dedup` - prevent duplicate notifications
   - `stateless` - don't store value
   - `pipe` - transform/validate values

6. **Performance**
   - 10,000 updates benchmark
   - Memory efficiency
   - Fast paths optimization

7. **Cleanup**
   - `decay()` - full cleanup
   - `clear()` - event cleanup

---

## Performance Results

### Baseline (after optimizations)

**Total:** 10,780 ops/ms (517ms for 5.57M operations)

**Key metrics:**
- Get value: 378,501 ops/ms
- Set (no listeners): 261,979 ops/ms
- Set (1 listener): 89,166 ops/ms
- Set (10 listeners): 48,375 ops/ms

**Improvement vs original:** +22.7% faster

---

## Continuous Testing

### Development
```bash
bun test --watch
```

### Before Commit
```bash
# Run all test suites
bun test                          # Unit tests
node test/node.test.mjs          # Node.js tests
start test/browser.html          # Browser tests (manual)
```

### Benchmark
```bash
bun run benchmark/run.ts
```

---

## Environment Support

| Environment | Status | Version |
|-------------|--------|---------|
| Bun | ✅ Tested | 1.3.0 |
| Node.js | ✅ Tested | 24.10.0 |
| Chrome | ✅ Tested | Latest |
| Firefox | ✅ Tested | Latest |
| Safari | ✅ Tested | Latest |

---

## Test Philosophy

1. **Coverage over quantity** - Every line tested, but tests remain simple
2. **Real-world scenarios** - Tests mimic actual usage patterns
3. **Performance aware** - All tests include performance benchmarks
4. **Multi-environment** - Same features work everywhere
5. **Fast feedback** - All tests complete in <1 second

---

## Adding New Tests

When adding new features:

1. Add to `coverage.test.ts` - Unit tests
2. Add to `node.test.mjs` - Node.js compatibility
3. Add to `browser.html` - Browser compatibility
4. Update benchmark if performance-critical

Example:
```typescript
test('Coverage: new feature', () => {
  const q = Qu({ newOption: true })
  // Test assertions...
})
```
