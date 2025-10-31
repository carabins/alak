import { Project } from '../common/project';
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
export declare function buildWithRolldown(project: Project): Promise<void>;
//# sourceMappingURL=task.rolldown.d.ts.map