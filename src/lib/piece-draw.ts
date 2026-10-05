export interface PieceDrawColors {
  have: string
  missing: string
  skippedMark: string
}

export interface PieceDrawInput {
  ctx: CanvasRenderingContext2D
  count: number
  cols: number
  cell: number
  ox: number
  oy: number
  bytes: Uint8Array
  wanted: Uint8Array
  colors: PieceDrawColors
}

/**
 * Draw the 1px hover ring around one cell, inset to the cell bounds.
 * Axis-aligned bars via fillRect (rasterizes identically everywhere,
 * including probe harnesses where strokeRect is dropped).
 */
export function drawRing(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  cell: number,
  ox: number,
  oy: number,
  color: string,
): void {
  const x0 = Math.round(ox + col * cell)
  const y0 = Math.round(oy + row * cell)
  const x1 = Math.round(ox + (col + 1) * cell) - 1
  const y1 = Math.round(oy + (row + 1) * cell) - 1
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  if (w < 2 || h < 2) return
  ctx.fillStyle = color
  ctx.fillRect(x0, y0, w, 1)
  ctx.fillRect(x0, y1, w, 1)
  ctx.fillRect(x0, y0, 1, h)
  ctx.fillRect(x1, y0, 1, h)
}

/**
 * Paint the piece grid. State per cell:
 * - have        → filled with the "have" color
 * - wanted hole → filled with the "missing" color
 * - skipped     → left empty (panel background); a small centered dot marks
 *                 it once cells are big enough to read it (cell >= 8).
 */
export function drawPieces(input: PieceDrawInput): void {
  const { ctx, count, cols, cell, ox, oy, bytes, wanted, colors } = input
  const gap = cell >= 7 ? 1 : 0

  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    const have = (bytes[i >> 3] ?? 0) & (0x80 >> (i & 7))
    const x = ox + c * cell
    const y = oy + r * cell
    if (have) {
      ctx.fillStyle = colors.have
      ctx.fillRect(x + gap, y + gap, cell - gap, cell - gap)
    } else if (wanted[i]) {
      ctx.fillStyle = colors.missing
      ctx.fillRect(x + gap, y + gap, cell - gap, cell - gap)
    } else if (cell >= 8) {
      const size = Math.max(2, Math.min(5, Math.round(cell * 0.3)))
      ctx.fillStyle = colors.skippedMark
      ctx.fillRect(x + (cell - size) / 2, y + (cell - size) / 2, size, size)
    }
  }
}
