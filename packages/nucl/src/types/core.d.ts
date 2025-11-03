import type {NuOptions} from "@alaq/nucl/types";

export interface NuCore extends interna{
  (this, ...args: any[]): NuCore
  realm: string
  plugins: []
}
