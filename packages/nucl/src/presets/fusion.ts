import { setupNuclearKinds } from '../plugins'
import { fusionPlugin } from '../fusion/plugin'

// Register 'fusion' kind globally when this file is imported
setupNuclearKinds({
  'fusion': [fusionPlugin]
})

// Augment type registry
declare module '../options' {
  export interface NuclearKindRegistry {
    'fusion': any
  }
}
