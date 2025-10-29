/**
 * Benchmark Runner - запуск и сохранение результатов
 */

import { writeFileSync } from 'fs'
import { join } from 'path'

console.log('🚀 Running Quark Baseline Benchmark...\n')

// Импорт и запуск бенчмарка
const { baselineResults } = await import('./baseline')

// Сохранение результатов в JSON
const resultsPath = join(import.meta.dir, 'BASELINE_RESULTS.json')
writeFileSync(resultsPath, JSON.stringify(baselineResults, null, 2))

console.log(`💾 Results saved to: ${resultsPath}`)

// Создание markdown отчета
const mdReport = generateMarkdownReport(baselineResults)
const mdPath = join(import.meta.dir, 'BASELINE_RESULTS.md')
writeFileSync(mdPath, mdReport)

console.log(`📄 Markdown report saved to: ${mdPath}`)

function generateMarkdownReport(data: typeof baselineResults): string {
  const { timestamp, runtime, platform, arch, results, summary } = data

  let md = `# Quark Baseline Performance Results\n\n`
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

  md += `## Key Findings\n\n`
  md += `### Fastest Operations\n`
  const fastest = [...results].sort((a, b) => b.opsPerMs - a.opsPerMs).slice(0, 5)
  for (const result of fastest) {
    md += `- **${result.name}**: ${result.opsPerMs.toLocaleString()} ops/ms\n`
  }

  md += `\n### Slowest Operations\n`
  const slowest = [...results].sort((a, b) => a.opsPerMs - b.opsPerMs).slice(0, 5)
  for (const result of slowest) {
    md += `- **${result.name}**: ${result.opsPerMs.toLocaleString()} ops/ms\n`
  }

  md += `\n## Notes\n\n`
  md += `This is the baseline performance measurement before applying optimizations from PERFORMANCE.md.\n`
  md += `Future benchmarks should be compared against these results to measure improvement.\n\n`
  md += `Target improvements:\n`
  md += `- Creation: +30-40%\n`
  md += `- Get/Set: +25-35%\n`
  md += `- Events: +20-30%\n`
  md += `- Memory: -40-50% allocations\n`

  return md
}
