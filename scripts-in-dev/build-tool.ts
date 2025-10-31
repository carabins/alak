// Simplified build tool - будет расширен позже
import { Builder } from './dist/core/Builder.js'
import { createContext } from './dist/core/Context.js'
import { ConsoleReporter } from './dist/reporters/ConsoleReporter.js'

export async function buildPackage(packagePath: string): Promise<boolean> {
  try {
    const context = await createContext(packagePath)
    const builder = new Builder(context)
    const reporter = new ConsoleReporter()
    reporter.listen(builder)

    const result = await builder.build()
    reporter.printResult(result)

    return result.success
  } catch (error: any) {
    console.error('Build error:', error.message)
    return false
  }
}
