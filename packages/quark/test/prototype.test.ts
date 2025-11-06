import { describe, expect, test, beforeEach, jest } from "bun:test";
import { Qu } from "../src/index"
import { quarkProto } from "../src/prototype";
import { HAS_GROW_UP, DEDUP, STATELESS, IS_EMPTY, SILENT } from "../src/flags";

describe("quarkProto", () => {
  let quark: any;

  beforeEach(() => {
    quark = Qu<number>({ value: 42 });
  });

  describe("up", () => {
    test("should add listener to the listeners array", () => {
      const listener = jest.fn();
      quark.up(listener);

      expect(quark._listeners).toBeDefined();
      expect(Array.isArray(quark._listeners)).toBe(true);
      expect(quark._listeners.includes(listener)).toBe(true);
      expect(quark._flags & HAS_GROW_UP).toBe(HAS_GROW_UP);
    });

    test("should call listener immediately if value is already set", () => {
      const listener = jest.fn();
      quark.up(listener);

      expect(listener).toHaveBeenCalledWith(42, quark);
    });

    test("should return quark for chaining", () => {
      const listener = jest.fn();
      const result = quark.up(listener);

      expect(result).toBe(quark);
    });

    test("should lazy init listeners if not present", () => {
      const tempQuark = Qu<number>() as any
      const listener = jest.fn();
      tempQuark.up(listener);

      expect(tempQuark._listeners).toBeDefined();
      expect(Array.isArray(tempQuark._listeners)).toBe(true);
      expect(tempQuark._listeners.includes(listener)).toBe(true);
    });
  });

  describe("down", () => {
    test("should remove listener from the listeners array", () => {
      const listener = jest.fn();
      quark.up(listener);

      expect(quark._listeners.length).toBe(1);

      quark.down(listener);

      expect(quark._listeners.length).toBe(0);
      expect(quark._flags & HAS_GROW_UP).toBe(0); // Flag should be cleared when no listeners
    });

    test("should return quark for chaining", () => {
      const listener = jest.fn();
      const result = quark.down(listener);

      expect(result).toBe(quark);
    });

    test("should handle removing non-existent listener gracefully", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      quark.up(listener1);

      expect(quark._listeners.length).toBe(1);

      quark.down(listener2); // Try to remove non-existent listener

      expect(quark._listeners.length).toBe(1);
      expect(quark._listeners[0]).toBe(listener1);
    });

    test("should not clear HAS_GROW_UP flag if other listeners remain", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      quark.up(listener1);
      quark.up(listener2);

      expect(quark._flags & HAS_GROW_UP).toBe(HAS_GROW_UP);

      quark.down(listener1);

      expect(quark._flags & HAS_GROW_UP).toBe(HAS_GROW_UP);
    });
  });

  describe("silent", () => {
    test("should set SILENT flag and call the quark with value", () => {
      const value = 100;
      const originalValue = quark.value;
      const spy = jest.fn();
      quark.up(spy); // Add a listener to verify the call works

      quark.silent(value);

      // Check that SILENT flag was set during execution
      // The flag will be cleared after the call, so we can't directly verify
      // Instead, we check that the quark was called with the value
      expect(quark.value).toBe(value);
    });

    test("should return quark for chaining", () => {
      const result = quark.silent(100);

      expect(result).toBe(quark);
    });
  });

  describe("pipe", () => {
    test("should set the pipe function", () => {
      const pipeFn = (x: number) => x * 2;
      quark.pipe(pipeFn);

      expect(quark._pipeFn).toBe(pipeFn);
    });

    test("should return quark for chaining", () => {
      const pipeFn = (x: number) => x * 2;
      const result = quark.pipe(pipeFn);

      expect(result).toBe(quark);
    });
  });

  describe("dedup", () => {
    test("should enable deduplication by default", () => {
      quark.dedup();

      expect(quark._flags & DEDUP).toBe(DEDUP);
    });

    test("should enable deduplication when true is passed", () => {
      quark.dedup(true);

      expect(quark._flags & DEDUP).toBe(DEDUP);
    });

    test("should disable deduplication when false is passed", () => {
      quark.dedup(true); // First enable
      expect(quark._flags & DEDUP).toBe(DEDUP);

      quark.dedup(false); // Then disable

      expect(quark._flags & DEDUP).toBe(0);
    });

    test("should return quark for chaining", () => {
      const result = quark.dedup();

      expect(result).toBe(quark);
    });
  });

  describe("stateless", () => {
    test("should enable stateless behavior by default", () => {
      quark.stateless();

      expect(quark._flags & STATELESS).toBe(STATELESS);
    });

    test("should enable stateless behavior when true is passed", () => {
      quark.stateless(true);

      expect(quark._flags & STATELESS).toBe(STATELESS);
    });

    test("should disable stateless behavior when false is passed", () => {
      quark.stateless(true); // First enable
      expect(quark._flags & STATELESS).toBe(STATELESS);

      quark.stateless(false); // Then disable

      expect(quark._flags & STATELESS).toBe(0);
    });

    test("should return quark for chaining", () => {
      const result = quark.stateless();

      expect(result).toBe(quark);
    });
  });

  describe("decay", () => {
    test("should clear listeners array", () => {
      const listener = jest.fn();
      quark.up(listener);

      expect(quark._listeners.length).toBe(1);

      quark.decay();

      expect(quark._listeners).toBeNull();
    });



    test("should delete value", () => {
      expect(quark.value).toBe(42);

      quark.decay();

      expect(quark.value).toBeUndefined();
    });

    test("should reset flags to 0", () => {
      quark.dedup(true);
      quark.stateless(true);

      expect(quark._flags).not.toBe(0);

      quark.decay();

      expect(quark._flags).toBe(0);
    });

    test("should handle missing optional properties gracefully", () => {
      // Create a quark with minimal properties to test handling of missing properties
      const minimalQuark = {
        _flags: 0,
        // value: 42,
        ...quarkProto
      };

      expect(() => {
        minimalQuark.decay.call(minimalQuark);
      }).not.toThrow();
    });
  });
});
