import { setupNuclearKinds } from '../plugins'
import { deepStatePlugin } from '../deep-state/plugin'

// Register 'deep' kind globally when this file is imported
setupNuclearKinds({
  'deep': [deepStatePlugin]
})

// Augment type registry
declare module '../options' {
  export interface NuclearKindRegistry {
    'deep': any
  }
}
