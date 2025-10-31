/**
 * @deprecated Этот файл больше не нужен!
 *
 * Unified config автоматически создает конфигурацию на основе:
 * - Структуры файлов (src/index.ts)
 * - package.json метаданных (dependencies, buildOptions)
 * - Наличия types/ папки
 *
 * Этот файл сохранен как пример, но может быть удален.
 * Сборка работает без него через: npm start rolldown
 *
 * См. scripts/rolldown/unified.config.ts
 * См. docs/ROLLDOWN_UNIFIED_SYSTEM.md
 *
 * ---
 *
 * Rolldown конфигурация для @alaq/nucleus (DEPRECATED)
 *
 * Генерирует:
 * - artifacts/index.mjs (ESM)
 * - artifacts/index.js (CommonJS)
 * - artifacts/dist/nucleus.global.js (UMD для браузера)
 * - artifacts/types.d.ts (объединенные типы из types/)
 * - artifacts/types/* (копия всех .d.ts из types/)
 */

import { createRolldownConfig } from '../../scripts/rolldown/rolldown.base.config'
import packageJson from './package.json'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// ESM way to get __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default createRolldownConfig({
  packageDir: __dirname,
  packageName: '@alaq/nucleus',
  packageJson,
  globalName: 'Nucleus',
})
