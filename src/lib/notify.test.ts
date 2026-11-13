import { describe, expect, it } from "vitest";
import { unreadCount } from "./notify";
describe("unreadCount", () => {
  it("counts only notifications newer than last open", () => expect(unreadCount([{ at: 5 }, { at: 10 }, { at: 20 }], 10)).toBe(1));
});
