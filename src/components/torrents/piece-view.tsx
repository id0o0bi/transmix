import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react"
import { useTorrentPieces } from "@/hooks/use-torrent-detail"
import { formatBytes } from "@/lib/format"
import { computeGrid } from "@/lib/piece-grid"
import { drawPieces, drawRing } from "@/lib/piece-draw"

interface Size {
  w: number
  h: number
}

interface HoverInfo {
  index: number
  have: boolean
  wanted: boolean
}

// Canvas fillStyle cannot use raw CSS custom-property token streams: theme
// vars are oklch(), which browsers like Firefox reject (fill stays black).
// Resolve the var through a probe element to get a canonical rgb() string.
function resolveColor(varName: string, fallback: string): string {
  const probe = document.createElement("span")
  probe.style.color = `var(${varName}, ${fallback})`
  document.documentElement.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color !== "" ? color : fallback
}

export function PieceView({ torrentId }: { torrentId: number }) {
  const { data, isLoading, isError, error } = useTorrentPieces(torrentId)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [themeTick, setThemeTick] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (el === null) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect !== undefined) setSize({ w: rect.width, h: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((t) => t + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    void themeTick
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (canvas === null || wrap === null || data === null || data === undefined) return

    const dpr = window.devicePixelRatio || 1
    const cssW = size.w
    const cssH = size.h
    if (cssW < 1 || cssH < 1) return

    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext("2d")
    if (ctx === null) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    const count = data.pieceCount
    const grid = computeGrid(count, cssW, cssH)
    const { cols, cell, ox, oy } = grid

    drawPieces({
      ctx,
      count,
      cols,
      cell,
      ox,
      oy,
      bytes: data.bytes,
      wanted: data.wanted,
      colors: {
        have: resolveColor("--piece-have", "#22c55e"),
        missing: resolveColor("--piece-missing", "#a3a3a3"),
        skippedMark: resolveColor("--muted-foreground", "#737373"),
      },
    })

    if (hover !== null && hover.index < count) {
      const r = Math.floor(hover.index / cols)
      const c = hover.index % cols
      drawRing(ctx, c, r, cell, ox, oy, resolveColor("--ring", "#22c55e"))
    }
  }, [size, data, hover, themeTick])

  const onMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const data0 = data
    if (data0 === null || data0 === undefined || size.w < 1 || size.h < 1) return
    const count = data0.pieceCount
    const grid = computeGrid(count, size.w, size.h)
    const { cols, rows, cell, ox, oy } = grid
    const rect = e.currentTarget.getBoundingClientRect()
    const c = Math.floor((e.clientX - (rect.left + ox)) / cell)
    const r = Math.floor((e.clientY - (rect.top + oy)) / cell)
    const index = r * cols + c
    if (r < 0 || r >= rows || c < 0 || c >= cols || index >= count) {
      setHover(null)
      return
    }
    const have = ((data0.bytes[index >> 3] ?? 0) & (0x80 >> (index & 7))) !== 0
    setHover({ index, have, wanted: data0.wanted[index] === 1 })
  }

  let body: ReactNode
  if (isLoading) {
    body = (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
        Loading pieces…
      </div>
    )
  } else if (isError) {
    body = (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
        Failed to load pieces: {error instanceof Error ? error.message : String(error)}
      </div>
    )
  } else if (data === null || data === undefined || data.pieceCount === 0) {
    body = (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
        No piece information yet.
      </div>
    )
  } else {
    body = (
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
      />
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex h-7 shrink-0 items-center gap-4 overflow-hidden px-3 text-xs whitespace-nowrap text-muted-foreground">
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="size-2.5 bg-piece-have" />
          Have
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="size-2.5 bg-piece-missing border border-border" />
          Missing
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex size-2.5 items-center justify-center border border-border">
            <span className="size-1 bg-muted-foreground" />
          </span>
          Skipped
        </span>
        {data != null && (
          <span className="shrink-0 tabular-nums">
            {data.pieceCount} pieces × {formatBytes(data.pieceSize)}
          </span>
        )}
        <span className="min-w-0 truncate tabular-nums ml-auto text-foreground/70">
          {hover === null
            ? ""
            : `Piece ${hover.index + 1} of ${data?.pieceCount ?? 0} · ${hover.have ? "have" : hover.wanted ? "missing" : "skipped"}`}
        </span>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1 px-3">
        {body}
      </div>
    </div>
  )
}
