/**
 * Benchmark utilities for saving and comparing results
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { cpus, totalmem, platform, arch, release } from 'os'

export interface BenchmarkResult {
  timestamp: string
  date: string
  benchmarks: Record<string, number>
  metadata?: Record<string, any>
}

export interface ComparisonResult {
  current: BenchmarkResult
  previous: BenchmarkResult[]
  changes: Record<string, {
    current: number
    previous: number
    delta: number
    deltaPercent: number
    trend: 'improved' | 'degraded' | 'stable'
  }>
}

const RESULTS_DIR = join(__dirname, 'results')

/**
 * Get system information for benchmark metadata
 */
export function getSystemInfo() {
  const cpuInfo = cpus()[0]
  const totalMemGB = (totalmem() / 1024 / 1024 / 1024).toFixed(2)

  return {
    cpu: {
      model: cpuInfo.model,
      cores: cpus().length,
      speed: cpuInfo.speed, // MHz
    },
    memory: {
      total: `${totalMemGB} GB`,
      totalBytes: totalmem()
    },
    os: {
      platform: platform(),
      arch: arch(),
      release: release(),
      node: process.version
    }
  }
}

/**
 * Ensure results directory exists
 */
function ensureResultsDir() {
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true })
  }
}

/**
 * Save benchmark results to a file
 */
export function saveBenchmarkResults(
  benchmarkName: string,
  results: Record<string, number>,
  metadata?: Record<string, any>
): string {
  ensureResultsDir()

  const timestamp = Date.now()
  const date = new Date().toISOString()

  const result: BenchmarkResult = {
    timestamp: timestamp.toString(),
    date,
    benchmarks: results,
    metadata
  }

  const filename = `${benchmarkName}_${timestamp}.json`
  const filepath = join(RESULTS_DIR, filename)

  writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8')

  return filepath
}

/**
 * Load recent benchmark results (last N files)
 */
export function loadRecentResults(benchmarkName: string, count: number = 4): BenchmarkResult[] {
  ensureResultsDir()

  const files = readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith(benchmarkName) && f.endsWith('.json'))
    .sort((a, b) => {
      const timeA = parseInt(a.split('_')[1].replace('.json', ''))
      const timeB = parseInt(b.split('_')[1].replace('.json', ''))
      return timeB - timeA // newest first
    })
    .slice(0, count)

  return files.map(file => {
    const content = readFileSync(join(RESULTS_DIR, file), 'utf-8')
    return JSON.parse(content) as BenchmarkResult
  })
}

/**
 * Compare current results with historical data
 */
export function compareResults(
  current: BenchmarkResult,
  historical: BenchmarkResult[]
): ComparisonResult {
  if (historical.length === 0) {
    return {
      current,
      previous: [],
      changes: {}
    }
  }

  // Use most recent historical result for comparison
  const baseline = historical[0]
  const changes: ComparisonResult['changes'] = {}

  for (const [key, currentValue] of Object.entries(current.benchmarks)) {
    const previousValue = baseline.benchmarks[key]

    if (previousValue !== undefined) {
      const delta = currentValue - previousValue
      const deltaPercent = (delta / previousValue) * 100

      let trend: 'improved' | 'degraded' | 'stable'
      if (Math.abs(deltaPercent) < 5) {
        trend = 'stable'
      } else if (delta < 0) {
        trend = 'improved' // lower time is better
      } else {
        trend = 'degraded'
      }

      changes[key] = {
        current: currentValue,
        previous: previousValue,
        delta,
        deltaPercent,
        trend
      }
    }
  }

  return {
    current,
    previous: historical,
    changes
  }
}

/**
 * Format comparison results for console output
 */
export function formatComparison(comparison: ComparisonResult): string {
  const lines: string[] = []

  lines.push('\n=== Benchmark Comparison ===\n')

  if (comparison.previous.length === 0) {
    lines.push('No historical data for comparison.')
    return lines.join('\n')
  }

  const baseline = comparison.previous[0]
  lines.push(`Comparing with: ${new Date(baseline.date).toLocaleString()}`)
  lines.push(`Historical runs: ${comparison.previous.length}`)

  // Check if system changed
  const currentMeta = comparison.current.metadata
  const baselineMeta = baseline.metadata

  if (currentMeta && baselineMeta) {
    const systemChanged: string[] = []

    if (currentMeta.cpu?.model !== baselineMeta.cpu?.model) {
      systemChanged.push(`CPU: ${baselineMeta.cpu?.model} → ${currentMeta.cpu?.model}`)
    }
    if (currentMeta.cpu?.cores !== baselineMeta.cpu?.cores) {
      systemChanged.push(`Cores: ${baselineMeta.cpu?.cores} → ${currentMeta.cpu?.cores}`)
    }
    if (currentMeta.memory?.total !== baselineMeta.memory?.total) {
      systemChanged.push(`Memory: ${baselineMeta.memory?.total} → ${currentMeta.memory?.total}`)
    }
    if (currentMeta.os?.node !== baselineMeta.os?.node) {
      systemChanged.push(`Node: ${baselineMeta.os?.node} → ${currentMeta.os?.node}`)
    }

    if (systemChanged.length > 0) {
      lines.push('\n⚠️  System configuration changed:')
      systemChanged.forEach(change => lines.push(`   ${change}`))
    }
  }

  lines.push('')

  for (const [key, change] of Object.entries(comparison.changes)) {
    const icon = change.trend === 'improved' ? '✅' :
                 change.trend === 'degraded' ? '❌' :
                 '➖'

    const sign = change.delta > 0 ? '+' : ''

    lines.push(`${icon} ${key}:`)
    lines.push(`   Current:  ${change.current.toFixed(2)}ms`)
    lines.push(`   Previous: ${change.previous.toFixed(2)}ms`)
    lines.push(`   Change:   ${sign}${change.delta.toFixed(2)}ms (${sign}${change.deltaPercent.toFixed(2)}%)`)
    lines.push('')
  }

  // Show trend summary
  const trends = Object.values(comparison.changes)
  const improved = trends.filter(t => t.trend === 'improved').length
  const degraded = trends.filter(t => t.trend === 'degraded').length
  const stable = trends.filter(t => t.trend === 'stable').length

  lines.push('Summary:')
  lines.push(`  ✅ Improved: ${improved}`)
  lines.push(`  ❌ Degraded: ${degraded}`)
  lines.push(`  ➖ Stable:   ${stable}`)

  return lines.join('\n')
}

/**
 * Print historical trend for specific benchmark
 */
export function printTrend(benchmarkKey: string, historical: BenchmarkResult[]): void {
  console.log(`\n=== Trend: ${benchmarkKey} ===\n`)

  const sorted = [...historical].reverse() // oldest first

  sorted.forEach((result, index) => {
    const value = result.benchmarks[benchmarkKey]
    if (value !== undefined) {
      const date = new Date(result.date).toLocaleString()
      const bar = '█'.repeat(Math.floor(value / 10))
      console.log(`${index + 1}. ${date}: ${value.toFixed(2)}ms ${bar}`)
    }
  })
}
