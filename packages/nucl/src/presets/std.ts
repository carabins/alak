import { setupNuclearKinds } from '../plugins'
import { stdPlugin } from '../std/plugin'


setupNuclearKinds({
  'std': [stdPlugin]
})

declare module '../options' {
  export interface NuclearKindRegistry {
    'std': any
  }
}
