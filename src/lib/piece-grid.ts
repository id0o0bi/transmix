export interface Grid {
  cols: number
  rows: number
  cell: number
  ox: number
  oy: number
}

// TrguiNG-style sizing: the grid always fills the full canvas width
// (cell = width / cols), so the drawn block keeps a constant width when
// the panel is resized vertically; rows/cols only re-balance cell size.
export function computeGrid(count: number, w: number, h: number): Grid {
  const maxCell = 20
  const minCols = Math.max(1, Math.ceil(w / maxCell))
  if (count > 0 && count < minCols && h >= maxCell) {
    return {
      cols: count,
      rows: 1,
      cell: maxCell,
      ox: Math.max(0, Math.floor((w - count * maxCell) / 2)),
      oy: Math.max(0, Math.floor((h - maxCell) / 2)),
    }
  }
  const ratio = w / Math.max(h, 1)
  let cols = Math.max(Math.ceil(Math.sqrt(count * ratio)), minCols, 1)
  let rows = Math.ceil(count / cols)
  while (cols < rows * ratio) {
    cols++
    rows = Math.ceil(count / cols)
  }
  const cell = w / cols
  return { cols, rows, cell, ox: 0, oy: Math.max(0, Math.floor((h - rows * cell) / 2)) }
}
