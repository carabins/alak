/**
 * Check published versions of packages in npm
 */
import select from '@inquirer/select'
import { getPackageVersions, NpmPackageInfo } from '../../common/utils/publish'
import { packageRegistry } from '../../common/scan.projects'
import { BuildPackage } from '../../BuildPackage'

interface PackageChoice {
  name: string
  value: string
  packageName: string
  localVersion: string
}

/**
 * Get available packages for version check
 */
function getAvailablePackages(): PackageChoice[] {
  return Object.values(packageRegistry.all).map((project: BuildPackage) => {
    const localVersion = project.packageJson.version || '0.0.0'
    const packageName = project.packageJson.name

    return {
      name: `${project.id} (${packageName}@${localVersion})`,
      value: project.id,
      packageName,
      localVersion,
    }
  })
}

/**
 * Format date string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'today'
  } else if (diffDays === 1) {
    return 'yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months > 1 ? 's' : ''} ago`
  } else {
    const years = Math.floor(diffDays / 365)
    return `${years} year${years > 1 ? 's' : ''} ago`
  }
}

/**
 * Display package version information
 */
function displayPackageInfo(info: NpmPackageInfo, localVersion: string, pkgName: string) {
  console.log('\n' + '═'.repeat(60))
  console.log(`📦 Package: ${info.name}`)
  console.log('═'.repeat(60))

  if (info.description) {
    console.log(`📝 Description: ${info.description}`)
  }

  if (info.homepage) {
    console.log(`🏠 Homepage: ${info.homepage}`)
  }

  if (info.license) {
    console.log(`⚖️  License: ${info.license}`)
  }

  console.log()

  // Dist tags
  console.log('🏷️  Tags:')
  Object.entries(info['dist-tags']).forEach(([tag, version]) => {
    const symbol = tag === 'latest' ? '⭐' : '  '
    console.log(`  ${symbol} ${tag}: ${version}`)
  })

  console.log()

  // Local version
  console.log(`💻 Local version: ${localVersion}`)
  const latestNpm = info['dist-tags'].latest
  if (localVersion === latestNpm) {
    console.log('   ✅ Up to date with npm')
  } else {
    console.log(`   ⚠️  Different from latest (${latestNpm})`)
  }

  console.log()

  // All versions (sorted by time, newest first)
  console.log(`📚 Published versions (${info.versions.length} total):`)
  console.log()

  const versionsWithTime = info.versions
    .map((v) => ({
      version: v,
      time: info.time[v],
      timestamp: new Date(info.time[v]).getTime(),
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20) // Show last 20 versions

  versionsWithTime.forEach((v, index) => {
    const isLocal = v.version === localVersion
    const isLatest = v.version === info['dist-tags'].latest
    const age = formatDate(v.time)
    const date = new Date(v.time).toISOString().split('T')[0]

    let prefix = '  '
    let suffix = ''

    if (isLatest) {
      prefix = '⭐'
      suffix += ' (latest)'
    }

    if (isLocal) {
      prefix = '💻'
      suffix += ' (local)'
    }

    console.log(`  ${prefix} ${v.version.padEnd(10)} ${date}  (${age})${suffix}`)
  })

  if (info.versions.length > 20) {
    console.log(`  ... and ${info.versions.length - 20} more versions`)
  }

  console.log()
  console.log('═'.repeat(60))
}

/**
 * Check versions workflow
 */
export async function checkVersionsWorkflow() {
  console.log('\n🔍 Check Published Versions\n')

  const available = getAvailablePackages()

  if (available.length === 0) {
    console.log('❌ No packages found')
    return
  }

  // Select package
  const choice = await select<string>({
    message: 'Select a package to check',
    choices: available.map((p) => ({
      name: p.name,
      value: p.value,
    })),
  })

  const selected = available.find((p) => p.value === choice)
  if (!selected) {
    console.log('❌ Package not found')
    return
  }

  console.log(`\n🔎 Fetching information for ${selected.packageName}...\n`)

  // Get npm info
  const npmInfo = getPackageVersions(selected.packageName)

  if (!npmInfo) {
    console.log(`❌ Package ${selected.packageName} not found in npm registry`)
    console.log(`   This package may not be published yet.`)
    console.log(`\n💻 Local version: ${selected.localVersion}`)

    // Still update the project's npmVersion even if package not found on npm
    const project = packageRegistry.all[selected.value];
    if (project) {
      project.npmVersion = selected.localVersion; // Use local version if not published
    }

    return
  }

  // Update Project's npm version
  const project = packageRegistry.all[selected.value];
  if (project) {
    project.npmVersion = npmInfo['dist-tags'].latest || selected.localVersion;
  }

  // Display info
  displayPackageInfo(npmInfo, selected.localVersion, selected.value)
}
