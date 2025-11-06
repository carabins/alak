/**
 * Publishing utilities
 */
import { execSync } from 'child_process'
import * as path from 'path'

export interface PublishOptions {
  dryRun?: boolean
  access?: 'public' | 'restricted'
  tag?: string
}

/**
 * Publish a package to npm
 */
export async function publishPackage(
  pkgName: string,
  options: PublishOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const { dryRun = false, access = 'public', tag = 'latest' } = options

  const artifactsDir = path.join(process.cwd(), 'artifacts', pkgName)

  try {
    let cmd = 'npm publish'
    cmd += ` --access ${access}`
    cmd += ` --tag ${tag}`
    if (dryRun) {
      cmd += ' --dry-run'
    }

    console.log(`[${pkgName}] Running: ${cmd}`)

    const output = execSync(cmd, {
      cwd: artifactsDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    console.log(`[${pkgName}] ${output}`)

    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Check if package exists in npm registry
 */
export function checkPackageExists(packageName: string, version: string): boolean {
  try {
    execSync(`npm view ${packageName}@${version} version`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    })
    return true
  } catch {
    return false
  }
}

/**
 * Get package information from npm registry
 */
export interface NpmPackageInfo {
  name: string
  version: string
  description?: string
  versions: string[]
  'dist-tags': Record<string, string>
  time: Record<string, string>
  repository?: {
    type: string
    url: string
  }
  homepage?: string
  license?: string
}

/**
 * Get all versions of a package from npm
 */
export function getPackageVersions(packageName: string): NpmPackageInfo | null {
  try {
    const output = execSync(`npm view ${packageName} --json`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    })
    return JSON.parse(output)
  } catch {
    return null
  }
}

/**
 * Get latest version of a package from npm
 */
export function getLatestVersion(packageName: string): string | null {
  try {
    const output = execSync(`npm view ${packageName} version`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    })
    return output.trim()
  } catch {
    return null
  }
}
