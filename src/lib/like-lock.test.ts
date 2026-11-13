import { describe, it, expect } from "vitest";
import { canVote } from "./like-lock";
describe("like lock", () => {
  it("guests cannot like", () => { expect(canVote(true, null)).toBe(false); });
  it("signed-in viewers can like", () => { expect(canVote(true, { uid: "u" })).toBe(true); });
  it("blocked until sign-in state is known", () => { expect(canVote(false, { uid: "u" })).toBe(false); });
});
