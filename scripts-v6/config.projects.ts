import { BuildPackage } from '~/scripts/BuildPackage'
import { getAffected } from '~/scripts/common/git'
import { packageRegistry } from '~/scripts/common/scan.projects'

interface PackageSet {
  name: string
  desc?: string
  interactive?: boolean
  get?: string[] | any
}

export const packagesSets: Record<string, PackageSet> = {
  core: {
    name: 'Core stack',
    desc: 'quark → nucl → atom',
    get: ['quark', 'deep-state', 'bitmask', 'nucl'],
  },
  affected: {
    name: 'Affected packages',
    desc: 'Changed packages (git)',
    get: getAffected,
  },

  all: {
    name: 'All packages',
    desc: 'Every package in monorepo',
    get: Object.keys(packageRegistry.all),
  },

  custom: {
    name: 'Custom selection',
    desc: 'Manual checkbox picker',
    interactive: true,
  },
}
