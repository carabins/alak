
export function isEmpty(value: any): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  if (typeof value === 'number') return value === 0 || isNaN(value)
  if (typeof value === 'boolean') return !value
  return false
}