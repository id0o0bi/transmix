import { describe, expect, it } from "vitest"
import { drawPieces, drawRing, type PieceDrawInput } from "./piece-draw"

interface Fill {
  color: string
  alpha: number
  args: number[]
}

function makeCtx() {
  const fills: Fill[] = []
  let fillStyle = ""
  let globalAlpha = 1
  const ctx = {
    get fillStyle() {
      return fillStyle
    },
    set fillStyle(v: string) {
      fillStyle = v
    },
    get globalAlpha() {
      return globalAlpha
    },
    set globalAlpha(v: number) {
      globalAlpha = v
    },
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ color: fillStyle, alpha: globalAlpha, args: [x, y, w, h] })
    },
  } as unknown as CanvasRenderingContext2D
  return { ctx, fills }
}

function base(overrides: Partial<PieceDrawInput> & Pick<PieceDrawInput, "ctx">): PieceDrawInput {
  return {
    count: 4,
    cols: 2,
    cell: 12,
    ox: 0,
    oy: 0,
    bytes: new Uint8Array([0xff]),
    wanted: new Uint8Array([1, 1, 1, 1]),
    colors: { have: "#22c55e", missing: "#a3a3a3", skippedMark: "#737373" },
    ...overrides,
  }
}

describe("drawPieces", () => {
  it("fills have-cells with the have color", () => {
    const { ctx, fills } = makeCtx()
    drawPieces(base({ ctx }))
    expect(fills).toHaveLength(4)
    expect(fills.every((f) => f.color === "#22c55e" && f.alpha === 1)).toBe(true)
    expect(fills[0].args).toEqual([1, 1, 11, 11])
  })

  it("fills wanted holes with the missing color", () => {
    const { ctx, fills } = makeCtx()
    drawPieces(base({ ctx, bytes: new Uint8Array([0b10000000]) }))
    expect(fills.map((f) => f.color)).toEqual(["#22c55e", "#a3a3a3", "#a3a3a3", "#a3a3a3"])
  })

  it("leaves skipped cells unfilled and draws one centered dot when the cell is readable", () => {
    const { ctx, fills } = makeCtx()
    drawPieces(base({ ctx, bytes: new Uint8Array([0x00]), wanted: new Uint8Array([0, 0, 0, 0]) }))
    // cell 12 → dot size = round(12 * 0.3) = 4, centered at (4, 4)
    expect(fills).toHaveLength(4)
    expect(fills.every((f) => f.color === "#737373" && f.alpha === 1)).toBe(true)
    expect(fills[0].args).toEqual([4, 4, 4, 4])
    // third cell = row 1, col 0 → y shifted by 12
    expect(fills[2].args).toEqual([4, 16, 4, 4])
    expect(fills.every((f) => f.args[2] === 4 && f.args[3] === 4)).toBe(true)
  })

  it("scales the dot with the cell size within 2–5px", () => {
    const { ctx, fills } = makeCtx()
    drawPieces(base({ ctx, cell: 16, bytes: new Uint8Array([0x00]), wanted: new Uint8Array([0, 0, 0, 0]) }))
    // round(16 * 0.3) = 5, centered at (16 - 5) / 2 = 5.5
    expect(fills).toHaveLength(4)
    expect(fills[0].args).toEqual([5.5, 5.5, 5, 5])
    const small = makeCtx()
    drawPieces(base({ ctx: small.ctx, cell: 8, bytes: new Uint8Array([0x00]), wanted: new Uint8Array([0, 0, 0, 0]) }))
    // round(8 * 0.3) = 2
    expect(small.fills[0].args).toEqual([3, 3, 2, 2])
  })

  it("mixes states per cell", () => {
    const { ctx, fills } = makeCtx()
    drawPieces(base({ ctx, bytes: new Uint8Array([0b10000000]), wanted: new Uint8Array([1, 1, 1, 0]) }))
    expect(fills.map((f) => f.color)).toEqual(["#22c55e", "#a3a3a3", "#a3a3a3", "#737373"])
    expect(fills[3].args).toEqual([16, 16, 4, 4])
  })

  it("omits the dot when cells are too small to read it", () => {
    const { ctx, fills } = makeCtx()
    drawPieces(base({ ctx, cell: 6, bytes: new Uint8Array([0x00]), wanted: new Uint8Array([0, 0, 0, 0]) }))
    expect(fills).toHaveLength(0)
  })
})

describe("drawRing", () => {
  it("outlines the cell with four 1px bars inside its bounds", () => {
    const { ctx, fills } = makeCtx()
    drawRing(ctx, 1, 0, 12, 0, 0, "rgb(34,197,94)")
    expect(fills).toHaveLength(4)
    expect(fills.every((f) => f.color === "rgb(34,197,94)" && f.alpha === 1)).toBe(true)
    const xs = fills.map((f) => f.args[0])
    const ys = fills.map((f) => f.args[1])
    expect(Math.min(...xs)).toBe(12)
    expect(Math.max(...xs)).toBe(23)
    expect(Math.min(...ys)).toBe(0)
    expect(Math.max(...ys)).toBe(11)
    const [top, bottom, left, right] = fills
    expect(top.args).toEqual([12, 0, 12, 1])
    expect(bottom.args).toEqual([12, 11, 12, 1])
    expect(left.args).toEqual([12, 0, 1, 12])
    expect(right.args).toEqual([23, 0, 1, 12])
  })
})
