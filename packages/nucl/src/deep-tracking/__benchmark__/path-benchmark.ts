/**
 * Benchmark: String concatenation vs Array paths
 */

const ITERATIONS = 1_000_000

// Симуляция глубокой вложенности: obj.user.profile.settings.theme.colors.primary
const pathSegments = ['user', 'profile', 'settings', 'theme', 'colors', 'primary']

console.log('=== Path Building Benchmark ===\n')

// 1. String concatenation (current approach with separator)
{
  const start = performance.now()
  let path = ''

  for (let i = 0; i < ITERATIONS; i++) {
    path = ''
    for (const segment of pathSegments) {
      path = path === '' ? segment : path + '.' + segment
    }
  }

  const time = performance.now() - start
  console.log('1. String concat with separator:')
  console.log(`   Time: ${time.toFixed(2)}ms`)
  console.log(`   Result: "${path}"\n`)
}

// 2. String concatenation (pre-built path)
{
  const start = performance.now()
  let finalPath = ''

  for (let i = 0; i < ITERATIONS; i++) {
    let path = ''
    for (const segment of pathSegments) {
      path = path + segment + '.'
    }
    finalPath = path.slice(0, -1) // remove trailing dot
  }

  const time = performance.now() - start
  console.log('2. String concat (with trailing dot):')
  console.log(`   Time: ${time.toFixed(2)}ms`)
  console.log(`   Result: "${finalPath}"\n`)
}

// 3. Array + join
{
  const start = performance.now()
  let path = ''

  for (let i = 0; i < ITERATIONS; i++) {
    const arr: string[] = []
    for (const segment of pathSegments) {
      arr.push(segment)
    }
    path = arr.join('.')
  }

  const time = performance.now() - start
  console.log('3. Array + join:')
  console.log(`   Time: ${time.toFixed(2)}ms`)
  console.log(`   Result: "${path}"\n`)
}

// 4. Template literals
{
  const start = performance.now()
  let path = ''

  for (let i = 0; i < ITERATIONS; i++) {
    path = ''
    for (const segment of pathSegments) {
      path = path === '' ? segment : `${path}.${segment}`
    }
  }

  const time = performance.now() - start
  console.log('4. Template literals:')
  console.log(`   Time: ${time.toFixed(2)}ms`)
  console.log(`   Result: "${path}"\n`)
}

console.log('\n=== Real-world scenario: Incremental path building ===\n')

// Реальный сценарий: путь строится инкрементально при создании прокси
// Каждый уровень сохраняет полный путь

// 5. Incremental string (как в текущей реализации ДОЛЖНО быть)
{
  const start = performance.now()

  for (let i = 0; i < ITERATIONS; i++) {
    let path = ''
    for (const segment of pathSegments) {
      path = path === '' ? segment : path + '.' + segment
      // path сохраняется в parent.parentPath
    }
  }

  const time = performance.now() - start
  console.log('5. Incremental string building:')
  console.log(`   Time: ${time.toFixed(2)}ms`)
  console.log(`   (Each level caches full path)\n`)
}

// 6. Incremental array
{
  const start = performance.now()

  for (let i = 0; i < ITERATIONS; i++) {
    const pathArray: string[] = []
    for (const segment of pathSegments) {
      pathArray.push(segment)
      // каждый раз нужен join для notify
      const path = pathArray.join('.')
    }
  }

  const time = performance.now() - start
  console.log('6. Incremental array (with join each time):')
  console.log(`   Time: ${time.toFixed(2)}ms`)
  console.log(`   (join() called on every access)\n`)
}

console.log('\n=== Memory test ===\n')

// Память: строки vs массивы
const memTest = {
  strings: [] as string[],
  arrays: [] as string[][]
}

const startMem = process.memoryUsage().heapUsed / 1024 / 1024

// Создаем 10000 путей разной глубины
for (let depth = 0; depth < 10000; depth++) {
  let path = ''
  const arr: string[] = []

  for (let i = 0; i <= (depth % 10); i++) {
    const segment = `prop${i}`
    path = path === '' ? segment : path + '.' + segment
    arr.push(segment)
  }

  memTest.strings.push(path)
  memTest.arrays.push(arr)
}

const endMem = process.memoryUsage().heapUsed / 1024 / 1024
console.log(`Memory used: ${(endMem - startMem).toFixed(2)} MB`)
console.log(`Average per path: ${((endMem - startMem) / 10000 * 1024).toFixed(2)} KB`)
