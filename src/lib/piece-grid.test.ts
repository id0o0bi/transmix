import { describe, expect, it } from "vitest"
import { computeGrid } from "@/lib/piece-grid"

describe("computeGrid", () => {
  it("gives small piece counts a single centered row of max cells", () => {
    const g = computeGrid(3, 100, 100)
    expect(g.cols).toBe(3)
    expect(g.rows).toBe(1)
    expect(g.cell).toBe(20)
    expect(g.ox).toBe(20)
    expect(g.oy).toBe(40)
  })

  it("fills the full width with cell = width / cols", () => {
    const g = computeGrid(100, 200, 100)
    expect(g.ox).toBe(0)
    expect(g.cols * g.cell).toBeCloseTo(200, 10)
    expect(g.rows).toBe(Math.ceil(100 / g.cols))
    expect(g.oy).toBeGreaterThanOrEqual(0)
  })

  it("never produces more rows than pieces", () => {
    for (const [count, w, h] of [
      [1, 50, 50],
      [7, 333, 177],
      [2048, 640, 300],
      [5000, 1000, 100],
    ] as const) {
      const g = computeGrid(count, w, h)
      expect(g.cols).toBeGreaterThanOrEqual(1)
      expect(g.rows).toBeGreaterThanOrEqual(1)
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(count)
      expect(g.oy).toBeGreaterThanOrEqual(0)
    }
  })

  it("keeps cells within the requested maximum size", () => {
    const g = computeGrid(4, 400, 400)
    expect(g.cell).toBeLessThanOrEqual(20)
  })

  it("handles zero pieces without dividing by zero", () => {
    const g = computeGrid(0, 300, 200)
    expect(g.cols).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(g.cell)).toBe(true)
  })
})
