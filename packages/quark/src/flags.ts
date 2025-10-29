/**
 * Битовые флаги состояния кварка
 */

export const HAS_LISTENERS = 1   // 0000 0001
export const HAS_EVENTS = 2      // 0000 0010
export const HAS_REALM = 4       // 0000 0100
export const WAS_SET = 8         // 0000 1000
export const DEDUP = 16          // 0001 0000
export const STATELESS = 32      // 0010 0000
