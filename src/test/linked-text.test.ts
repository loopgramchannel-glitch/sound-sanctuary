import { describe, it, expect } from "vitest";
import { splitTrailing } from "@/components/LinkedText";
describe("description links", () => {
  it("drops the trailing full stop", () => expect(splitTrailing("https://x.com/a.")).toEqual(["https://x.com/a", "."]));
});
