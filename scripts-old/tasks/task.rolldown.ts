import { Project } from '../common/project'
import { FileLog } from '../log'
import * as path from 'path'
import * as fs from 'fs-extra'
import { runTsc } from '../common/tsc'
import { createUnifiedConfig, type UnifiedBuildContext } from '../rolldown/unified.config'

const tscState = {
  promise: undefined,
  result: undefined,
}

function tsc() {
  if (tscState.promise) {
    return tscState.promise
  }
  if (tscState.result) {
    return tscState.result
  }
  return (tscState.promise = runTsc().then((r) => {
    tscState.result = r
  }))
}

/**
 * Сборка пакета с использованием Rolldown (унифицированная конфигурация)
 *
 * Процесс:
 * 1. Генерация .d.ts файлов через TypeScript Compiler
 * 2. Автоматическое создание конфигурации на основе package.json и структуры пакета
 * 3. Запуск сборки через Rolldown
 * 4. Плагины Rolldown обрабатывают:
 *    - types/ → объединение всех .d.ts в types.d.ts
 *    - LICENSE → копирование в artifacts
 *    - package.json → генерация с полными путями exports
 *
 * Поддерживает:
 * - Универсальные пакеты (src/index.ts)
 *   → main, module, types, exports с import/require
 * - Платформо-специфичные пакеты (src/index.node.ts + src/index.browser.ts)
 *   → exports с условиями node/browser для каждого формата
 * - Автоматическую обработку types/
 * - Множественные форматы вывода (ESM, CJS, UMD)
 * - CDN поля (unpkg, jsdelivr) для UMD сборок
 */
export async function buildWithRolldown(project: Project) {
  const log = FileLog(project.packageJson.name + ' rolldown')

  try {
    // 1. Генерируем .d.ts файлы через tsc
    log('generating types via tsc...')
    await tsc()
    const { declarations } = tscState.result

    // Очищаем и создаем директорию artifacts
    fs.existsSync(project.artPatch) && fs.removeSync(project.artPatch)
    fs.mkdirpSync(project.artPatch)

    // Записываем сгенерированные .d.ts файлы
    log('writing declaration files...')
    declarations[project.dir].forEach(({ outFile, content }) => {
      fs.writeFileSync(outFile, content)
    })

    // 2. Динамически импортируем Rolldown
    log('loading rolldown...')
    let rolldown
    try {
      rolldown = await import('rolldown')
    } catch (err) {
      log.error('Rolldown not installed. Run: bun add -D rolldown')
      throw new Error('Rolldown not installed')
    }

    // 3. Создаем унифицированную конфигурацию автоматически
    log('creating unified build configuration...')
    const ctx: UnifiedBuildContext = {
      packageDir: project.packagePath,
      packageName: project.packageJson.name || path.basename(project.packagePath),
      packageJson: project.packageJson,
      artifactsDir: project.artPatch,
    }

    const configs = createUnifiedConfig(ctx)

    log(`generated ${configs.length} build configurations`)


    // 4. Запускаем сборку для каждой конфигурации
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i]
      const format = config.output?.format || 'unknown'
      const platform = config.platform || 'universal'

      log(`building [${i + 1}/${configs.length}] ${platform}/${format}...`)

      const bundle = await rolldown.rolldown(config)
      const { output } = await bundle.write(config.output)

      // Подсчитываем размер
      const totalSize = output.reduce((sum, chunk) => {
        if ('code' in chunk) {
          return sum + chunk.code.length
        }
        if ('source' in chunk) {
          return sum + (typeof chunk.source === 'string'
            ? chunk.source.length
            : chunk.source.byteLength)
        }
        return sum
      }, 0)

      log(`✓ ${platform}/${format}: ${(totalSize / 1024).toFixed(2)} KB`)
    }

    log('✓ rolldown build complete')
  } catch (err) {
    log.error('Rolldown build failed:', err.message)
    console.error(err)
    throw err
  }
}
