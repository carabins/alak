/**
 * Benchmark Runner - запуск и сохранение результатов
 */

import { writeFileSync } from 'fs'
import { join } from 'path'

console.log('🚀 Running Nucl vs Quark Comparison Benchmark...\n')

// Импорт и запуск бенчмарка
const { comparisonResults } = await import('./compare')

// Сохранение результатов в JSON
const resultsPath = join(import.meta.dir, 'RESULTS.json')
writeFileSync(resultsPath, JSON.stringify(comparisonResults, null, 2))

console.log(`\n💾 Results saved to: ${resultsPath}`)

// Создание markdown отчета
const mdReport = generateMarkdownReport(comparisonResults)
const mdPath = join(import.meta.dir, 'RESULTS.md')
writeFileSync(mdPath, mdReport)

console.log(`📄 Markdown report saved to: ${mdPath}`)

function generateMarkdownReport(data: typeof comparisonResults): string {
  const { timestamp, runtime, platform, arch, results, summary } = data

  let md = `# Nucl vs Quark Performance Comparison\n\n`
  md += `**Date:** ${new Date(timestamp).toLocaleString()}\n`
  md += `**Runtime:** ${runtime}\n`
  md += `**Platform:** ${platform} (${arch})\n\n`

  md += `## Summary\n\n`
  md += `| Implementation | Avg Ops/ms | Overhead |\n`
  md += `|----------------|----------:|----------:|\n`
  md += `| Quark (baseline) | ${summary.avgQuark.toLocaleString()} | 0% |\n`
  md += `| Nucl (bare) | ${summary.avgNucl.toLocaleString()} | ${summary.avgNuclOverhead}% |\n`
  md += `| Nucl+plugins | ${summary.avgPlugins.toLocaleString()} | ${summary.avgPluginsOverhead}% |\n`
  md += `| HeavyNucl | ${summary.avgHeavy.toLocaleString()} | ${summary.avgHeavyOverhead}% |\n\n`

  md += `## Detailed Results\n\n`

  md += `### Performance Comparison (ops/ms)\n\n`
  md += `| Test | Quark | Nucl | Nucl+plugins | HeavyNucl | Overhead (Nucl) | Overhead (Plugins) | Overhead (Heavy) |\n`
  md += `|------|------:|-----:|-------------:|----------:|----------------:|-------------------:|-----------------:|\n`

  for (const result of results) {
    md += `| ${result.quark.name.replace(' (Quark)', '')} `
    md += `| ${result.quark.opsPerMs.toLocaleString()} `
    md += `| ${result.nucl.opsPerMs.toLocaleString()} `
    md += `| ${result.nuclWithPlugins.opsPerMs.toLocaleString()} `
    md += `| ${result.heavyNucl.opsPerMs.toLocaleString()} `
    md += `| ${result.overhead.nucl} `
    md += `| ${result.overhead.nuclWithPlugins} `
    md += `| ${result.overhead.heavyNucl} |\n`
  }

  md += `\n## Analysis\n\n`

  md += `### Overhead Breakdown\n\n`
  md += `1. **Nucl (bare)** - ${summary.avgNuclOverhead}% overhead\n`
  md += `   - Cost of plugin system infrastructure (prototype chain, hooks)\n`
  md += `   - Minimal impact on basic operations\n\n`

  md += `2. **Nucl+plugins** - ${summary.avgPluginsOverhead}% overhead\n`
  md += `   - Includes nucleus plugin (universal + array + object methods)\n`
  md += `   - Additional prototype properties and methods\n\n`

  md += `3. **HeavyNucl** - ${summary.avgHeavyOverhead}% overhead\n`
  md += `   - Same as Nucl+plugins (uses same implementation)\n`
  md += `   - Convenience wrapper for full feature set\n\n`

  const overheadNum = parseFloat(summary.avgPluginsOverhead)
  if (overheadNum < 5) {
    md += `### ✅ Excellent Performance\n\n`
    md += `The overhead is minimal (< 5%), making Nucl suitable for performance-critical applications.\n`
  } else if (overheadNum < 10) {
    md += `### ✅ Good Performance\n\n`
    md += `The overhead is acceptable (< 10%), providing good balance between features and performance.\n`
  } else if (overheadNum < 20) {
    md += `### ⚠️ Moderate Performance Impact\n\n`
    md += `The overhead is noticeable (10-20%). Consider using bare Nucl for hot paths.\n`
  } else {
    md += `### ⚠️ Significant Performance Impact\n\n`
    md += `The overhead is significant (> 20%). Optimization needed for hot paths.\n`
  }

  md += `\n## Recommendations\n\n`
  md += `- **Hot paths / Performance-critical code**: Use bare Quark or Nucl\n`
  md += `- **General application code**: Use Nucl+plugins or HeavyNucl\n`
  md += `- **Developer experience**: HeavyNucl provides best DX with auto-installed features\n`

  return md
}
