/**
 * Битовые флаги состояния кварка
 */

export const HAS_GROW_UP = 1   // 0000 0001
export const EMIT_CHANGES = 2      // 0000 0010
export const HAS_REALM = 4       // 0000 0100
export const IS_EMPTY = 8         // 0000 1000
export const DEDUP = 16          // 0001 0000
export const STATELESS = 32      // 0010 0000
export const SILENT = 64         // 0100 0000
export const IMMUTABLE = 128     // 1000 0000
export const DEEP_STATE = 256 // 1 0000 0000
export const HAVE_PLUGINS = 526
export const HAS_PIPE = 526 + 526


export const HAS_REALM_AND_EMIT = HAS_REALM | EMIT_CHANGES

export const HAS_REALM_AWAKE = HAS_REALM | IS_EMPTY


