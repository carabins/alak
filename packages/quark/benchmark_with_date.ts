/**
 * Скрипт для запуска бенчмарков и сохранения результатов с новой датой
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { $ } from 'bun'

// Получаем текущую дату и время
const now = new Date()
const dateStr = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5)  // Формат: YYYY-MM-DD_HH-mm

// Путь к папке для сохранения результатов
const resultsDir = join(process.cwd(), 'bun-results')

// Создаем папку, если она не существует
if (!existsSync(resultsDir)) {
  mkdirSync(resultsDir)
}

console.log(`🚀 Запуск бенчмарка: ${dateStr}`)

// Запускаем бенчмарк и получаем результаты
const { baselineResults } = await import('./benchmark/baseline')

// Формируем имя файла с результатами
const resultsFileName = `results_${dateStr}.json`
const resultsPath = join(resultsDir, resultsFileName)

// Сохраняем результаты в JSON
writeFileSync(resultsPath, JSON.stringify(baselineResults, null, 2))

console.log(`💾 Результаты сохранены в: ${resultsPath}`)

// Создание markdown отчета
const mdReport = generateMarkdownReport(baselineResults)
const mdFileName = `results_${dateStr}.md`
const mdPath = join(resultsDir, mdFileName)
writeFileSync(mdPath, mdReport)

console.log(`📄 Markdown отчет сохранен в: ${mdPath}`)

function generateMarkdownReport(data: typeof baselineResults): string {
  const { timestamp, runtime, platform, arch, results, summary } = data

  let md = `# Quark Performance Results - ${new Date(timestamp).toLocaleString()}\n\n`
  md += `**Date:** ${new Date(timestamp).toLocaleString()}\n`
  md += `**Runtime:** ${runtime}\n`
  md += `**Platform:** ${platform} (${arch})\n\n`

  md += `## Summary\n\n`
  md += `- **Total Operations:** ${summary.totalOps.toLocaleString()}\n`
  md += `- **Total Time:** ${summary.totalTime}ms\n`
  md += `- **Average Performance:** ${summary.avgOpsPerMs.toLocaleString()} ops/ms\n\n`

  md += `## Detailed Results\n\n`

  const categories = {
    'Creation': results.filter(r => r.name.includes('Create')),
    'Get/Set': results.filter(r => r.name.includes('Get') || (r.name.includes('Set') && !r.name.includes('pipe') && !r.name.includes('dedup') && !r.name.includes('stateless'))),
    'Listeners': results.filter(r => r.name.includes('listener') || r.name.includes('Notify')),
    'Events': results.filter(r => r.name.includes('event') || r.name.includes('Emit')),
    'Special Modes': results.filter(r => r.name.includes('dedup') || r.name.includes('stateless') || r.name.includes('pipe')),
    'Combined Operations': results.filter(r => r.name.includes('workflow') || r.name.includes('communication') || r.name.includes('lifecycle'))
  }

  for (const [category, categoryResults] of Object.entries(categories)) {
    if (categoryResults.length === 0) continue

    md += `### ${category}\n\n`
    md += `| Operation | Ops | Time (ms) | Ops/ms |\n`
    md += `|-----------|----:|----------:|-------:|\n`

    for (const result of categoryResults) {
      md += `| ${result.name} | ${result.ops.toLocaleString()} | ${result.time.toFixed(2)} | ${result.opsPerMs.toLocaleString()} |\n`
    }

    md += `\n`
  }

  return md
}