type IStartupStrategy = 'lazy' | 'immediately'

interface IAlakConstructor<Model, E, N> {
  name?: string
  namespace?: string
  model?: Model
  nucleusStrategy?: NucleusStrategy

  emitChanges?: boolean
  startup?: IStartupStrategy
}
