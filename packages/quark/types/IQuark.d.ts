// /**
//  * External Types for Quark - Public API
//  * Documenting all prototype properties and methods
//  */
//
// declare module '@alaq/quark' {
//
//   type AnyFunction = (...args: any[]) => any
//
//   interface IQuark<T = any> {
//     /**
//      * Quark function - Get or set the value
//      * @param value Optional new value to set
//      * @returns Current value when called without arguments, or new value when setting
//      */
//     (value?: T): T | undefined
//
//     /**
//      * Current value of the quark
//      */
//     value?: T
//
//     /**
//      * Unique identifier for this quark instance
//      */
//     readonly uid: number
//
//     /**
//      * Optional ID for the quark
//      */
//     id?: string
//
//     /**
//      * Subscribe to value changes with a callback
//      * @param listener Function called when value changes
//      * @returns The quark instance for chaining
//      */
//     up(listener: (value: T, quark: IQuark<T>) => void): this
//
//     /**
//      * Unsubscribe a listener from value changes
//      * @param listener The listener function to remove
//      * @returns The quark instance for chaining
//      */
//     down(listener: (value: T, quark: IQuark<T>) => void): this
//
//     /**
//      * Get whether the quark has active listeners
//      */
//     readonly hasListeners: boolean
//
//     /**
//      * Set a pipe function for value transformation/validation
//      * @param fn Function to transform or validate values
//      * @returns The quark instance for chaining
//      */
//     pipe(fn: (value: T) => T | undefined): this
//
//     /**
//      * Enable or disable deduplication (prevent same-value updates)
//      * @param enable Whether to enable deduplication (default: true)
//      * @returns The quark instance for chaining
//      */
//     dedup(enable?: boolean): this
//
//     /**
//      * Enable or disable stateless behavior (don't store value internally)
//      * @param enable Whether to enable stateless behavior (default: true)
//      * @returns The quark instance for chaining
//      */
//     stateless(enable?: boolean): this
//
//     /**
//      * Emit an event to the realm
//      * @param event Name of the event
//      * @param data Data to send with the event
//      * @returns The quark instance for chaining
//      */
//     emit(event: string, data: any): this
//
//     /**
//      * Subscribe to events
//      * @param event Name of the event to listen to
//      * @param listener Function called when event is emitted
//      * @returns The quark instance for chaining
//      */
//     on(event: string, listener: AnyFunction): this
//
//     /**
//      * Subscribe to an event once (removes listener after first call)
//      * @param event Name of the event to listen to once
//      * @param listener Function called when event is emitted
//      * @returns The quark instance for chaining
//      */
//     once(event: string, listener: AnyFunction): this
//
//     /**
//      * Unsubscribe from events
//      * @param event Name of the event to unsubscribe from
//      * @param listener The listener function to remove (optional - if not provided, removes all listeners for the event)
//      * @returns The quark instance for chaining
//      */
//     off(event: string, listener?: AnyFunction): this
//
//     /**
//      * Clear events
//      * @param event Optional name of the specific event to clear (if not provided, clears all events)
//      * @returns The quark instance for chaining
//      */
//     clear(event?: string): this
//
//     /**
//      * Set value without triggering notifications
//      * @param value New value to set
//      * @returns The quark instance for chaining
//      */
//     silent(value: T): this
//
//     /**
//      * Perform cleanup and reset the quark to initial state
//      * @returns The quark instance for chaining
//      */
//     decay(): this
//   }
// }
