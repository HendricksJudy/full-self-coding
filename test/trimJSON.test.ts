import { expect, test } from "bun:test";
import { trimJSON } from "../src/utils/trimJSON";

test("trimJSON trims extra text before and after a valid JSON object", () => {
    const input = "some text before {\"key\": \"value\"} some text after";
    const expected = "{\"key\": \"value\"}";
    expect(trimJSON(input)).toBe(expected);
});

test("trimJSON returns an empty string if no JSON object is found", () => {
    const input = "some text without any json";
    const expected = "";
    expect(trimJSON(input)).toBe(expected);
});

test("trimJSON handles incomplete JSON objects", () => {
    const input = "some text with incomplete json {\"key\": \"value\"";
    const expected = "";
    expect(trimJSON(input)).toBe(expected);
});

test("trimJSON returns the same string if it is already a valid JSON object", () => {
    const input = "{\"key\": \"value\"}";
    const expected = "{\"key\": \"value\"}";
    expect(trimJSON(input)).toBe(expected);
});

test("trimJSON handles nested JSON objects", () => {
    const input = "some text before {\"key\": {\"nestedKey\": \"nestedValue\"}} some text after";
    const expected = "{\"key\": {\"nestedKey\": \"nestedValue\"}}";
    expect(trimJSON(input)).toBe(expected);
});

