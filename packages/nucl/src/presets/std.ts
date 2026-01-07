import { setupNuclearKinds } from '../plugins'
import { stdPlugin } from '../std/plugin'

// Explicitly register 'std' kind
setupNuclearKinds({
  'std': [stdPlugin]
})

declare module '../options' {
  export interface NuclearKindRegistry {
    'std': any
  }
}
