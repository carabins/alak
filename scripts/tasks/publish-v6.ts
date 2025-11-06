/**
 * Publish workflow for v6 packages
 */
import checkbox from '@inquirer/checkbox'
import select from '@inquirer/select'
import confirm from '@inquirer/confirm'
import * as fs from 'fs'
import * as path from 'path'
import {
  VersionBumpType,
  bumpVersion,
  getCurrentVersion,
  updateVersions,
} from '../utils/version'
import { publishPackage, checkPackageExists } from '../utils/publish'

// Import from main config would be better, but for now keep in sync with index.ts
const V6_PACKAGES = ['quark', 'nucl', 'rune', 'atom', 'vue'] as const

interface PackageInfo {
  name: string
  currentVersion: string
  newVersion: string
  packageName: string
}

/**
 * Get available packages for publishing
 */
function getAvailablePackages(): string[] {
  return V6_PACKAGES.filter((pkgName) => {
    const sourceDir = path.join(process.cwd(), 'packages', pkgName)
    const packageJsonPath = path.join(sourceDir, 'package.json')
    return fs.existsSync(packageJsonPath)
  })
}

/**
 * Select packages to publish
 */
async function selectPackages(): Promise<string[]> {
  const available = getAvailablePackages()

  if (available.length === 0) {
    console.log('❌ No v6 packages found')
    return []
  }

  const selected = await checkbox({
    message: 'Select packages to publish',
    choices: available.map((pkg) => {
      const sourceDir = path.join(process.cwd(), 'packages', pkg)
      const packageJsonPath = path.join(sourceDir, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      const version = packageJson.version || '0.0.0'

      return {
        name: `${pkg} (${packageJson.name}@${version})`,
        value: pkg,
        checked: false,
      }
    }),
  })

  return selected
}

/**
 * Select version bump type
 */
async function selectVersionBump(): Promise<VersionBumpType> {
  return await select({
    message: 'Select version bump type',
    choices: [
      {
        name: 'Patch (0.0.x) - Bug fixes',
        value: 'patch' as VersionBumpType,
      },
      {
        name: 'Minor (0.x.0) - New features (backwards compatible)',
        value: 'minor' as VersionBumpType,
      },
      {
        name: 'Major (x.0.0) - Breaking changes',
        value: 'major' as VersionBumpType,
      },
    ],
  })
}

/**
 * Calculate new versions for selected packages
 */
function calculateNewVersions(
  packages: string[],
  bumpType: VersionBumpType
): PackageInfo[] {
  return packages.map((pkgName) => {
    const sourceDir = path.join(process.cwd(), 'packages', pkgName)
    const packageJsonPath = path.join(sourceDir, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

    const currentVersion = packageJson.version || '0.0.0'
    const newVersion = bumpVersion(currentVersion, bumpType)

    return {
      name: pkgName,
      currentVersion,
      newVersion,
      packageName: packageJson.name,
    }
  })
}

/**
 * Main publish workflow
 *
 * Steps:
 * 1. Select packages to publish
 * 2. Select version bump type (patch/minor/major)
 * 3. Calculate new versions
 * 4. Show summary and confirm
 * 5. Run tests (abort if any fail)
 * 6. Update versions in source and artifacts
 * 7. Build packages (Rolldown + TypeScript)
 * 8. Publish to npm
 * 9. Show summary
 */
export async function publishWorkflow() {
  console.log('\n📦 Publish Workflow\n')

  // Step 1: Select packages
  const selectedPackages = await selectPackages()

  if (selectedPackages.length === 0) {
    console.log('No packages selected')
    return
  }

  // Step 2: Select version bump type
  const bumpType = await selectVersionBump()

  // Step 3: Calculate new versions
  const packageInfos = calculateNewVersions(selectedPackages, bumpType)

  // Step 4: Show summary and confirm
  console.log('\n📋 Publishing plan:\n')
  for (const info of packageInfos) {
    console.log(`  ${info.name}:`)
    console.log(`    ${info.currentVersion} → ${info.newVersion}`)
    console.log(`    Package: ${info.packageName}`)

    // Check if version already exists
    const exists = checkPackageExists(info.packageName, info.newVersion)
    if (exists) {
      console.log(`    ⚠️  Version ${info.newVersion} already exists in npm`)
    }
    console.log()
  }

  const confirmed = await confirm({
    message: 'Proceed with publishing?',
    default: false,
  })

  if (!confirmed) {
    console.log('❌ Publishing cancelled')
    return
  }

  // Step 5: Run tests
  console.log('\n🧪 Running tests before publishing...\n')
  const { runMultiplePackageTests, printTestResults } = await import('../utils/test')

  const testResults = await runMultiplePackageTests(selectedPackages)
  const allTestsPassed = printTestResults(testResults)

  if (!allTestsPassed) {
    console.log('\n❌ Tests failed! Publishing cancelled.')
    console.log('Fix the failing tests and try again.\n')
    return
  }

  console.log('✅ All tests passed!\n')

  // Step 6: Update versions
  console.log('\n📝 Updating versions...\n')
  for (const info of packageInfos) {
    updateVersions(info.name, info.newVersion, {
      updateSource: true,
      updateArtifacts: true,
    })
    console.log(`✅ ${info.name}: version updated to ${info.newVersion}`)
  }

  // Step 7: Build packages
  console.log('\n🔨 Building packages...\n')
  const { RolldownBuilder } = await import('../builders/RolldownBuilder')
  const { TypeScriptBuilder } = await import('../builders/TypeScriptBuilder')
  const {
    PackageJsonGenerator,
    detectEntryPoints,
    readRootPackageJson,
  } = await import('../generators/PackageJsonGenerator')

  const rootPackageJson = readRootPackageJson()

  for (const info of packageInfos) {
    const sourceDir = path.join(process.cwd(), 'packages', info.name)
    const artifactsDir = path.join(process.cwd(), 'artifacts', info.name)

    console.log(`[${info.name}] Building...`)

    // Read updated package.json
    const sourcePackageJsonPath = path.join(sourceDir, 'package.json')
    const sourcePackageJson = JSON.parse(
      fs.readFileSync(sourcePackageJsonPath, 'utf-8')
    )
    const packageName = sourcePackageJson.name
    const entryPoints = detectEntryPoints(sourceDir)

    // Build with Rolldown
    const rolldownBuilder = new RolldownBuilder({
      sourceDir,
      artifactsDir,
      entryPoints,
      packageName,
    })

    const rolldownSuccess = await rolldownBuilder.build()
    if (!rolldownSuccess) {
      console.error(`[${info.name}] ❌ Rolldown build failed`)
      continue
    }

    // Generate TypeScript declarations
    const tsBuilder = new TypeScriptBuilder({
      sourceDir,
      artifactsDir,
      entryPoints,
      packageName,
    })

    const tsSuccess = await tsBuilder.build()
    if (!tsSuccess) {
      console.error(`[${info.name}] ❌ TypeScript build failed`)
      continue
    }

    // Generate package.json
    const generator = new PackageJsonGenerator({
      sourceDir,
      artifactsDir,
      sourcePackageJson,
      rootPackageJson,
      entryPoints,
    })

    const packageJson = generator.generate()
    fs.writeFileSync(
      path.join(artifactsDir, 'package.json'),
      JSON.stringify(packageJson, null, 2) + '\n'
    )

    console.log(`[${info.name}] ✅ Build complete\n`)
  }

  // Step 8: Publish packages
  console.log('\n📤 Publishing to npm...\n')

  const results: Array<{ name: string; success: boolean; error?: string }> = []

  for (const info of packageInfos) {
    console.log(`[${info.name}] Publishing ${info.packageName}@${info.newVersion}...`)

    const result = await publishPackage(info.name, {
      access: 'public',
      tag: 'latest',
      dryRun: false,
    })

    results.push({
      name: info.name,
      success: result.success,
      error: result.error,
    })

    if (result.success) {
      console.log(`[${info.name}] ✅ Published successfully\n`)
    } else {
      console.error(`[${info.name}] ❌ Publishing failed: ${result.error}\n`)
    }
  }

  // Step 9: Summary
  console.log('\n📊 Publishing Summary:\n')
  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  console.log(`✅ Successful: ${successful.length}`)
  if (successful.length > 0) {
    successful.forEach((r) => console.log(`   - ${r.name}`))
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`)
    failed.forEach((r) => console.log(`   - ${r.name}: ${r.error}`))
  }

  console.log()
}
