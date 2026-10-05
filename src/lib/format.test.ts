import { describe, expect, it } from "vitest"
import { formatPercent } from "./format"

describe("formatPercent", () => {
  it("floors to one decimal like TrguiNG and never rounds up to 100% before completion", () => {
    expect(formatPercent(0.9999011)).toBe("99.9%")
    expect(formatPercent(1)).toBe("100.0%")
    expect(formatPercent(0)).toBe("0.0%")
    expect(formatPercent(0.3145584)).toBe("31.4%")
    expect(formatPercent(0.0999)).toBe("9.9%")
    expect(formatPercent(0.1)).toBe("10.0%")
  })

  it("clamps out-of-range and non-finite input", () => {
    expect(formatPercent(1.5)).toBe("100.0%")
    expect(formatPercent(-0.2)).toBe("0.0%")
    expect(formatPercent(Number.NaN)).toBe("0.0%")
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe("0.0%")
  })
})
