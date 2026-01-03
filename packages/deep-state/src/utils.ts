import {IDeepState} from "./types";

export function getPath(node: IDeepState): string {
  const parts: string[] = []
  let current: IDeepState | undefined = node

  while (current && !current.isRoot) {
    if (current.key !== undefined) {
      parts.push(String(current.key))
    }
    current = current.parent
  }

  return parts.reverse().join('.')
}
