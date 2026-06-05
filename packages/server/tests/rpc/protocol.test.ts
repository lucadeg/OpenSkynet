import { test, describe, expect } from "bun:test";
import { ERROR_CODES } from "../../src/rpc/protocol";

describe("ERROR_CODES", () => {
  test("PARSE_ERROR is -32700", () => {
    expect(ERROR_CODES.PARSE_ERROR).toBe(-32700);
  });

  test("METHOD_NOT_FOUND is -32601", () => {
    expect(ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
  });

  test("INTERNAL_ERROR is -32000", () => {
    expect(ERROR_CODES.INTERNAL_ERROR).toBe(-32000);
  });

  test("INVALID_REQUEST is -32600", () => {
    expect(ERROR_CODES.INVALID_REQUEST).toBe(-32600);
  });

  test("INVALID_PARAMS is -32602", () => {
    expect(ERROR_CODES.INVALID_PARAMS).toBe(-32602);
  });
});
