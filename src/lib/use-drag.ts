import { useCallback } from "react"

type Axis = "x" | "y"

interface DragOptions {
  axis: Axis
  onDelta: (delta: number) => void
}

/** Returns an onMouseDown handler that tracks pointer deltas until release. */
export function useDragResize({ axis, onDelta }: DragOptions) {
  return useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      const startX = event.clientX
      const startY = event.clientY

      const onMove = (e: MouseEvent) => {
        const delta = axis === "x" ? e.clientX - startX : e.clientY - startY
        onDelta(delta)
      }
      const onUp = () => {
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize"
      document.body.style.userSelect = "none"
    },
    [axis, onDelta],
  )
}
