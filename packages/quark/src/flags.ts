/**
 * Битовые флаги состояния кварка
 */

export const IS_AWAKE = 1   // 0000 0001
export const EMIT_CHANGES = 2      // 0000 0010
export const HAS_REALM = 4       // 0000 0100
export const IS_EMPTY = 8         // 0000 1000
export const DEDUP = 16          // 0001 0000
export const STATELESS = 32      // 0010 0000
export const SILENT = 64         // 0100 0000
export const HAS_PIPE = 128

export const HAS_REALM_AND_EMIT = HAS_REALM | EMIT_CHANGES

export const HAS_REALM_AWAKE = HAS_REALM | IS_EMPTY

