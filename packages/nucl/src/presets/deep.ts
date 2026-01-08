import { setupNuclearKinds } from '../plugins'
import { deepStatePlugin } from '../deep-state/plugin'


setupNuclearKinds({
  'deep': [deepStatePlugin]
})


declare module '../options' {
  export interface NuclearKindRegistry {
    'deep': any
  }
}
