# Rolldown Build System Design

## Цели

1. Заменить текущую систему сборки (oxc-transform) на Rolldown
2. Автоматически включать все .d.ts файлы из папки `types/` в финальные библиотеки
3. Генерировать оптимизированные бандлы (ESM, CJS, UMD)
4. Сохранить совместимость с существующей структурой проекта

## Архитектура решения

### 1. Структура сборки

```
packages/
├── nucleus/
│   ├── src/
│   │   ├── index.ts          # Точка входа
│   │   ├── bus.ts
│   │   └── ...
│   ├── types/                # Дополнительные типы (не генерируемые tsc)
│   │   ├── INucleus.d.ts
│   │   ├── plugins.d.ts
│   │   └── ...
│   ├── package.json
│   └── rolldown.config.ts    # Конфиг Rolldown для пакета
├── atom/
│   └── ...
└── ...
```

### 2. Выходные файлы

```
artifacts/nucleus/
├── index.js                  # CommonJS
├── index.mjs                 # ESM
├── index.d.ts                # Основные типы (tsc)
├── types.d.ts                # Объединенные типы из types/
├── types/                    # Копия папки types/
│   ├── INucleus.d.ts
│   ├── plugins.d.ts
│   └── ...
└── dist/
    └── nucleus.global.js     # UMD (для браузера)
```

### 3. Конфигурация Rolldown

#### Общий конфиг (scripts/rolldown/rolldown.base.config.ts)

```typescript
import { defineConfig, Plugin } from 'rolldown'
import * as path from 'path'
import * as fs from 'fs-extra'

export interface PackageBuildOptions {
  packageDir: string
  packageName: string
  packageJson: any
  globalName?: string
}

/**
 * Плагин для обработки типов из папки types/
 */
export function typesPlugin(options: PackageBuildOptions): Plugin {
  return {
    name: 'alak-types-plugin',

    async generateBundle(outputOptions, bundle) {
      const typesDir = path.join(options.packageDir, 'types')

      if (!fs.existsSync(typesDir)) {
        return
      }

      const outDir = outputOptions.dir || path.dirname(outputOptions.file!)
      const artTypesDir = path.join(outDir, 'types')

      // 1. Копируем все .d.ts файлы в artifacts/types/
      fs.mkdirpSync(artTypesDir)
      const typeFiles = fs.readdirSync(typesDir).filter(f => f.endsWith('.d.ts'))

      let combinedTypes = ''

      typeFiles.forEach(file => {
        const sourcePath = path.join(typesDir, file)
        const destPath = path.join(artTypesDir, file)
        const content = fs.readFileSync(sourcePath, 'utf-8')

        // Копируем файл
        fs.copyFileSync(sourcePath, destPath)

        // Добавляем в объединенный файл
        combinedTypes += `// ${file}\n${content}\n\n`
      })

      // 2. Добавляем references на зависимости
      const deps = options.packageJson.dependencies || {}
      const refs = Object.keys(deps)
        .filter(dep => dep.startsWith('@alaq/'))
        .map(dep => {
          const depName = dep.replace('@alaq/', '')
          return `/// <reference path="../${depName}/types.d.ts" />`
        })

      if (refs.length > 0) {
        combinedTypes = refs.join('\n') + '\n\n' + combinedTypes
      }

      // 3. Создаем types.d.ts
      fs.writeFileSync(
        path.join(outDir, 'types.d.ts'),
        combinedTypes
      )

      // 4. Добавляем reference в index.d.ts
      const indexDtsPath = path.join(outDir, 'index.d.ts')
      if (fs.existsSync(indexDtsPath)) {
        let indexContent = fs.readFileSync(indexDtsPath, 'utf-8')
        if (!indexContent.includes('reference path="types.d.ts"')) {
          indexContent = `/// <reference path="types.d.ts" />\n${indexContent}`
          fs.writeFileSync(indexDtsPath, indexContent)
        }
      }
    }
  }
}

/**
 * Базовая конфигурация Rolldown для пакета
 */
export function createRolldownConfig(options: PackageBuildOptions) {
  const { packageDir, packageName, packageJson, globalName } = options

  const external = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ]

  return defineConfig([
    // ESM build
    {
      input: path.join(packageDir, 'src/index.ts'),
      output: {
        file: path.join(packageDir, 'artifacts/index.mjs'),
        format: 'esm',
        sourcemap: true,
      },
      external,
      plugins: [
        typesPlugin(options),
      ],
    },

    // CommonJS build
    {
      input: path.join(packageDir, 'src/index.ts'),
      output: {
        file: path.join(packageDir, 'artifacts/index.js'),
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      external,
      plugins: [
        typesPlugin(options),
      ],
    },

    // UMD build (для браузера)
    ...(globalName ? [{
      input: path.join(packageDir, 'src/index.ts'),
      output: {
        file: path.join(packageDir, 'artifacts/dist', `${globalName}.global.js`),
        format: 'umd',
        name: globalName,
        sourcemap: true,
      },
      external: [],
      plugins: [
        typesPlugin(options),
      ],
    }] : []),
  ])
}
```

#### Пример конфига для пакета (packages/nucleus/rolldown.config.ts)

```typescript
import { createRolldownConfig } from '../../scripts/rolldown/rolldown.base.config'
import packageJson from './package.json'

export default createRolldownConfig({
  packageDir: __dirname,
  packageName: '@alaq/nucleus',
  packageJson,
  globalName: 'Nucleus',
})
```

### 4. Интеграция в систему сборки

#### scripts/tasks/task.rolldown.ts

```typescript
import { Project } from '../common/project'
import { FileLog } from '../log'
import * as path from 'path'
import * as fs from 'fs-extra'
import { runTsc } from '../common/tsc'
import { build } from 'rolldown'

export async function buildWithRolldown(project: Project) {
  const log = FileLog(project.packageJson.name + ' rolldown')

  try {
    // 1. Генерируем .d.ts файлы через tsc
    log('generating types...')
    await runTsc()

    // 2. Загружаем rolldown конфиг пакета
    const configPath = project.resolveInPackage('rolldown.config.ts')

    if (!fs.existsSync(configPath)) {
      log.warn('No rolldown.config.ts found, skipping')
      return
    }

    log('loading rolldown config...')
    const config = await import(configPath)

    // 3. Запускаем сборку
    log('building...')
    const configs = Array.isArray(config.default) ? config.default : [config.default]

    for (const cfg of configs) {
      const result = await build(cfg)

      if (result.output) {
        const totalSize = result.output.reduce((sum, chunk) => {
          return sum + (chunk.code?.length || 0)
        }, 0)

        log(`built ${cfg.output.format}:`, (totalSize / 1024).toFixed(2), 'kb')
      }
    }

    // 4. Копируем LICENSE
    fs.copyFileSync('LICENSE', path.resolve(project.artPatch, 'LICENSE'))

    log('complete')
  } catch (err) {
    log.error('Build failed:', err)
    throw err
  }
}
```

### 5. Преимущества Rolldown

1. **Производительность**: Написан на Rust, в 10-20x быстрее Rollup
2. **Tree-shaking**: Автоматическое удаление неиспользуемого кода
3. **Оптимизация**: Минификация, scope hoisting
4. **TypeScript**: Встроенная поддержка без дополнительных плагинов
5. **Совместимость**: Поддерживает плагины Rollup
6. **Форматы**: ESM, CJS, UMD, IIFE из коробки

### 6. План миграции

#### Фаза 1: Подготовка
- [ ] Установить rolldown: `bun add -D rolldown`
- [ ] Создать базовый конфиг: `scripts/rolldown/rolldown.base.config.ts`
- [ ] Создать плагин для типов: `typesPlugin`

#### Фаза 2: Пилот (nucleus)
- [ ] Создать `packages/nucleus/rolldown.config.ts`
- [ ] Создать `scripts/tasks/task.rolldown.ts`
- [ ] Протестировать сборку nucleus
- [ ] Сравнить размеры бандлов

#### Фаза 3: Миграция остальных пакетов
- [ ] Создать конфиги для atom, alak, vue, и др.
- [ ] Обновить scripts/index.ts для выбора системы сборки
- [ ] Добавить опцию `npm start rolldown`

#### Фаза 4: Оптимизация
- [ ] Настроить минификацию
- [ ] Добавить source maps
- [ ] Настроить external dependencies правильно
- [ ] Оптимизировать размер UMD бандлов

### 7. Дополнительные возможности

#### 7.1 Плагин для генерации API документации

```typescript
export function apiDocsPlugin(): Plugin {
  return {
    name: 'alak-api-docs',

    async generateBundle(outputOptions, bundle) {
      // Генерация API.md на основе .d.ts файлов
      const typeFiles = Object.keys(bundle).filter(f => f.endsWith('.d.ts'))

      let apiDoc = '# API Reference\n\n'

      typeFiles.forEach(file => {
        const chunk = bundle[file]
        if (chunk.type === 'asset') {
          apiDoc += `## ${file}\n\n\`\`\`typescript\n${chunk.source}\n\`\`\`\n\n`
        }
      })

      this.emitFile({
        type: 'asset',
        fileName: 'API.md',
        source: apiDoc
      })
    }
  }
}
```

#### 7.2 Плагин для валидации типов

```typescript
export function typeValidationPlugin(): Plugin {
  return {
    name: 'alak-type-validation',

    async buildEnd() {
      // Проверка что все публичные API экспортируют типы
      // Проверка на breaking changes
    }
  }
}
```

## Заключение

Rolldown предоставит:
- ✅ Автоматическую обработку types/
- ✅ Оптимизированные бандлы
- ✅ Лучшую производительность
- ✅ Современный стандарт сборки
- ✅ Гибкость через плагины
