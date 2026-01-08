import { setupNuclearKinds } from '../plugins'
import { fusionPlugin } from '../fusion/plugin'


setupNuclearKinds({
  'fusion': [fusionPlugin]
})


declare module '../options' {
  export interface NuclearKindRegistry {
    'fusion': any
  }
}
