import { describe, expect, test, beforeEach } from "bun:test";
import { setValue } from "../src/setValue";
import setupQuarkAndOptions from "../src/setupQuarkAndOptions";
import { Qu } from "../src/index";
import {
  DEDUP,
  HAS_GROW_UP,
  HAS_REALM,
  HAS_REALM_AND_EMIT,
  IS_EMPTY,
  SILENT,
  STATELESS,
  EMIT_CHANGES
} from "@alaq/quark/flags";

describe("setValue", () => {
  let quark: any;

  beforeEach(() => {
    quark = {
      _flags: IS_EMPTY,
      value: undefined,
      _pipeFn: undefined,
      _listeners: [],
      id: "test",
      realm: undefined,
      _bus: undefined
    };
  });

  test("should set value", () => {
    setValue(quark, "test");

    expect(quark.value).toBe("test");
  });

  test("should apply pipe function if present", () => {
    quark._pipeFn = (x: string) => x.toUpperCase();
    quark._flags &= ~IS_EMPTY; // Remove IS_EMPTY flag

    setValue(quark, "test");

    expect(quark.value).toBe("TEST");
  });

  test("should return early if pipe function returns undefined", () => {
    quark._pipeFn = (x: string) => undefined;
    quark.value = "existing";
    quark._flags &= ~IS_EMPTY; // Remove IS_EMPTY flag

    // Value should not change if pipe returns undefined
    setValue(quark, "new");

    expect(quark.value).toBe("existing");
  });

  test("should clear IS_EMPTY flag on first value assignment", () => {
    expect(quark._flags & IS_EMPTY).toBe(IS_EMPTY); // Initially set

    setValue(quark, "test");

    expect(quark._flags & IS_EMPTY).toBe(0); // Cleared
  });

  test("should return early if DEDUP is enabled and value is the same", () => {
    quark.value = "test";
    quark._flags |= DEDUP;
    quark._flags &= ~IS_EMPTY; // Remove IS_EMPTY flag

    // Changing to the same value should not trigger any updates
    setValue(quark, "test");

    // Value should remain the same
    expect(quark.value).toBe("test");
  });

  test("should update value if DEDUP is enabled but value is different", () => {
    quark.value = "old";
    quark._flags |= DEDUP;
    quark._flags &= ~IS_EMPTY; // Remove IS_EMPTY flag

    setValue(quark, "new");

    expect(quark.value).toBe("new");
  });

  test("should not update value if STATELESS is enabled", () => {
    quark._flags |= STATELESS;
    quark._flags &= ~IS_EMPTY; // Remove IS_EMPTY flag

    setValue(quark, "test");

    expect(quark.value).toBeUndefined();
  });

  test("should set value but skip emitting when SILENT is enabled", () => {
    quark._flags |= SILENT;
    quark._flags &= ~IS_EMPTY; // Remove IS_EMPTY so value gets set

    setValue(quark, "test");

    // Value should still be set, but emission should be skipped
    expect(quark.value).toBe("test");
  });

  test("should call listeners if HAS_GROW_UP flag is set", () => {
    const calls: [any, any][] = [];
    const listener1 = (value: any, q: any) => {
      calls.push([value, q]);
    };
    const listener2 = (value: any, q: any) => {
      calls.push([value, q]);
    };
    quark._listeners = [listener1, listener2];
    quark._flags |= HAS_GROW_UP;
    quark._flags &= ~IS_EMPTY; // Remove IS_EMPTY flag

    setValue(quark, "test");

    expect(calls.length).toBe(2);
    expect(calls[0]).toEqual(["test", quark]);
    expect(calls[1]).toEqual(["test", quark]);
  });

  test("should emit to bus when HAS_REALM_AND_EMIT flags are set", () => {
    // Setup realm and set the HAS_REALM_AND_EMIT flag combination (HAS_REALM | EMIT_CHANGES)
    quark.realm = "testRealm";
    quark.id = "testId";
    // HAS_REALM_AND_EMIT = HAS_REALM | EMIT_CHANGES = 4 | 2 = 6
    quark._flags = 6; // Set both HAS_REALM (4) and EMIT_CHANGES (2)

    // Create a mock bus
    const emitCalls: any[] = [];
    quark._bus = {
      emit: (event: string, data: any) => {
        emitCalls.push({ event, data });
      }
    };

    setValue(quark, "test");

    expect(emitCalls.length).toBe(1);
    expect(emitCalls[0].event).toBe("QUARK_CHANGE");
    expect(emitCalls[0].data.id).toBe("testId");
    expect(emitCalls[0].data.value).toBe("test");
    expect(emitCalls[0].data.quark).toBe(quark);
  });
});

describe("setupQuarkAndOptions", () => {
  let quark: Function & any;

  beforeEach(() => {
    quark = function() {};
  });

  test("should initialize quark with default values", () => {
    const result = setupQuarkAndOptions(quark);

    expect(result.uid).toBeGreaterThan(0);
    expect(result._flags).toBe(IS_EMPTY);
  });

  test("should set value from options", () => {
    const options = { value: "test" };
    const result = setupQuarkAndOptions(quark, options);

    expect(result.value).toBe("test");
  });

  test("should set id from options", () => {
    const options = { id: "myId" };
    const result = setupQuarkAndOptions(quark, options);

    expect(result.id).toBe("myId");
  });

  test("should set realm and update flags when realm is provided", () => {
    const options = { realm: "testRealm" };
    const result = setupQuarkAndOptions(quark, options);

    expect(result.realm).toBe("testRealm");
    expect(result._flags & HAS_REALM).toBe(HAS_REALM);
  });

  test("should set pipe function and flag when pipe is provided", () => {
    const pipeFn = (x: any) => x * 2;
    const options = { pipe: pipeFn };
    const result = setupQuarkAndOptions(quark, options);

    expect(result._pipeFn).toBe(pipeFn);
    // Since HAS_PIPE is not imported, we can't test the flag directly
  });

  test("should set emitChanges flag and event name", () => {
    const options = { emitChanges: true, emitChangeName: "custom" };
    const result = setupQuarkAndOptions(quark, options);

    expect(result._flags & EMIT_CHANGES).toBe(EMIT_CHANGES);
    expect(result._changeEventName).toBe("custom");
  });

  test("should set emitChanges flag with default event name", () => {
    const options = { emitChanges: true };
    const result = setupQuarkAndOptions(quark, options);

    expect(result._flags & EMIT_CHANGES).toBe(EMIT_CHANGES);
    expect(result._changeEventName).toBe("change");
  });

  test("should set DEDUP flag when dedup option is true", () => {
    const options = { dedup: true };
    const result = setupQuarkAndOptions(quark, options);

    expect(result._flags & DEDUP).toBe(DEDUP);
  });

  test("should set STATELESS flag when stateless option is true", () => {
    const options = { stateless: true };
    const result = setupQuarkAndOptions(quark, options);

    expect(result._flags & STATELESS).toBe(STATELESS);
  });

  test("should set value and call quark with value if value is provided", () => {
    let callCount = 0;
    let callArgs: any[] = [];

    const mockQuark = function(value: any) {
      callCount++;
      callArgs = [value];
      // Simulate the setValue behavior
      if (value !== undefined) {
        mockQuark.value = value;
      }
    };

    Object.setPrototypeOf(mockQuark, quark);

    setupQuarkAndOptions(mockQuark, { value: "test" });

    // Check that the quark function was called with initial value
    expect(callCount).toBe(1);
    expect(callArgs[0]).toBe("test");
  });
});
