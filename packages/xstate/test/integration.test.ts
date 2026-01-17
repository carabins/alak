import { test, expect, describe } from 'bun:test'
import { setup, assign, fromPromise } from 'xstate'
import { fromMachine } from '../src/index'
import { Qv } from '@alaq/quark'

// --- Mock Machine ---
const heaterMachine = setup({
  types: {
    context: {} as { target: number; current: number },
    events: {} as 
      | { type: 'SENSOR_UPDATE'; temp: number }
      | { type: 'SET_TARGET'; value: number }
      | { type: 'TOGGLE' }
  },
  actions: {
    notifyUser: () => console.log('Action: notifyUser')
  }
}).createMachine({
  id: 'heater',
  initial: 'inactive',
  context: { target: 22, current: 20 },
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      initial: 'checking',
      on: { TOGGLE: 'inactive' },
      states: {
        checking: {
          always: [
            { target: 'heating', guard: ({ context }) => context.current < context.target },
            { target: 'idle' }
          ]
        },
        idle: {
          on: { 
            SENSOR_UPDATE: {
               // Logic: if new temp < target - 1 -> heating
               target: 'checking',
               actions: assign({ current: ({ event }) => event.temp })
            }
          }
        },
        heating: {
          entry: { type: 'notifyUser' },
          on: {
            SENSOR_UPDATE: {
              target: 'checking',
              actions: assign({ current: ({ event }) => event.temp })
            }
          }
        }
      }
    }
  },
  on: {
    SET_TARGET: {
      actions: assign({ target: ({ event }) => event.value })
    }
  }
})

describe('XState Adapter', () => {

  test('Initialization and Defaults', () => {
    const heater = fromMachine(heaterMachine)
    
    expect(heater.state().value).toBe('inactive')
    expect(heater.ctx('target').value).toBe(22)
    expect(heater.ctx('current').value).toBe(20)
    
    heater.decay()
  })

  test('State & Matches', () => {
    const heater = fromMachine(heaterMachine)
    const isActive = heater.state('active')
    
    expect(isActive.value).toBe(false)
    
    heater.send({ type: 'TOGGLE' })
    // inactive -> active -> checking -> heating (current 20 < target 22)
    
    expect(heater.state().value).toEqual({ active: 'heating' })
    expect(isActive.value).toBe(true)
    
    heater.decay()
  })

  test('Context Selector', () => {
    const heater = fromMachine(heaterMachine)
    
    // String selector
    const targetQ = heater.ctx('target')
    // Function selector
    const gapQ = heater.ctx(c => c.target - c.current)
    
    expect(targetQ.value).toBe(22)
    expect(gapQ.value).toBe(2) // 22 - 20
    
    heater.send({ type: 'SET_TARGET', value: 25 })
    
    expect(targetQ.value).toBe(25)
    expect(gapQ.value).toBe(5) // 25 - 20
    
    heater.decay()
  })

  test('Input Binding (toEvent)', () => {
    const heater = fromMachine(heaterMachine)
    const sensor = Qv(20)
    
    // Bind sensor to SENSOR_UPDATE event
    // When sensor changes -> { type: 'SENSOR_UPDATE', temp: value }
    heater.toEvent(sensor, 'SENSOR_UPDATE', 'temp')
    
    heater.send({ type: 'TOGGLE' }) // Go to heating
    // Current 20, Target 22. State: heating.
    expect(heater.state().value).toEqual({ active: 'heating' })
    
    // Update sensor to 25 (hotter than target)
    sensor(25)
    
    // Should transition to idle
    expect(heater.ctx('current').value).toBe(25)
    expect(heater.state().value).toEqual({ active: 'idle' })
    
    heater.decay()
  })

  test('Input Binding (asEvent)', () => {
    const heater = fromMachine(heaterMachine)
    const control = Qv<any>(undefined)
    
    // Bind control quark directly as event
    heater.asEvent(control)
    
    expect(heater.state().value).toBe('inactive')
    
    control({ type: 'TOGGLE' })
    expect(heater.state().value).toEqual({ active: 'heating' })
    
    heater.decay()
  })

  test('Action Stream', async () => {
    // Note: actions in XState V5 are tricky to catch via inspect if synchronous?
    // Let's verify our inspect implementation works.
    
    let actionTriggered = false
    const heater = fromMachine(heaterMachine)
    
    heater.action('notifyUser').up(() => {
      actionTriggered = true
    })
    
    // Trigger heating entry action
    heater.send({ type: 'TOGGLE' }) 
    
    // Need a tiny delay for inspect to fire? usually sync but let's see.
    expect(heater.state().value).toEqual({ active: 'heating' })
    expect(actionTriggered).toBe(true)
    
    heater.decay()
  })

  test('Can Check', () => {
    const heater = fromMachine(heaterMachine)
    
    const canToggle = heater.can('TOGGLE')
    expect(canToggle.value).toBe(true)
    
    // In this machine TOGGLE is always possible, let's check checking?
    // SENSOR_UPDATE is only valid in active state
    
    const canUpdate = heater.can('SENSOR_UPDATE')
    expect(canUpdate.value).toBe(false) // inactive
    
    heater.send({ type: 'TOGGLE' })
    expect(canUpdate.value).toBe(true) // active
    
    heater.decay()
  })
})
