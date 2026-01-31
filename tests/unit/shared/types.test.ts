import { describe, expect, test } from "bun:test";
import { isValidStatus } from "../../../src/shared/types";

describe("isValidStatus", () => {
  test("returns true for 'processing'", () => {
    expect(isValidStatus("processing")).toBe(true);
  });

  test("returns true for 'ready'", () => {
    expect(isValidStatus("ready")).toBe(true);
  });

  test("returns true for 'failed'", () => {
    expect(isValidStatus("failed")).toBe(true);
  });

  test("returns false for invalid status string", () => {
    expect(isValidStatus("unknown")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isValidStatus("")).toBe(false);
  });

  test("returns false for non-string values", () => {
    expect(isValidStatus(null)).toBe(false);
    expect(isValidStatus(undefined)).toBe(false);
    expect(isValidStatus(42)).toBe(false);
    expect(isValidStatus({})).toBe(false);
  });
});
