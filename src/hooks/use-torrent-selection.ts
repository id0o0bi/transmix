import { useCallback, useMemo, useRef, useState } from "react"

export function hasModifierKey(event: React.MouseEvent | React.KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

export interface TorrentSelection {
  selected: Set<number>
  current: number | null
  /** Row click handler: plain = replace, right-click on selected = keep, modifier = toggle, shift = range. */
  onRowClick: (id: number, event: React.MouseEvent, orderedIds: number[]) => void
  onCheckboxToggle: (id: number) => void
  onSelectAll: (orderedIds: number[]) => void
  onClear: () => void
  /** Remove ids that no longer exist (after removal/filtering). */
  prune: (existingIds: number[]) => void
}

export function useTorrentSelection(): TorrentSelection {
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [current, setCurrent] = useState<number | null>(null)
  const anchorRef = useRef<number | null>(null)

  const onRowClick = useCallback(
    (id: number, event: React.MouseEvent, orderedIds: number[]) => {
      const mod = hasModifierKey(event)
      const shift = event.shiftKey

      if (shift && anchorRef.current !== null) {
        const from = orderedIds.indexOf(anchorRef.current)
        const to = orderedIds.indexOf(id)
        if (from !== -1 && to !== -1) {
          const [lo, hi] = from <= to ? [from, to] : [to, from]
          setSelected(new Set(orderedIds.slice(lo, hi + 1)))
        }
        setCurrent(id)
        return
      }

      if (mod) {
        anchorRef.current = id
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
        setCurrent(id)
        return
      }

      anchorRef.current = id
      setCurrent(id)
      // Right-click on an already-selected row keeps the multi-selection
      // (TrguiNG behavior); otherwise replace it with just this row.
      setSelected((prev) => {
        if (event.button === 2 && prev.has(id)) return prev
        if (prev.size === 1 && prev.has(id)) return prev
        return new Set([id])
      })
    },
    [],
  )

  const onCheckboxToggle = useCallback((id: number) => {
    anchorRef.current = id
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setCurrent(id)
  }, [])

  const onSelectAll = useCallback((orderedIds: number[]) => {
    setSelected(new Set(orderedIds))
  }, [])

  const onClear = useCallback(() => {
    anchorRef.current = null
    setSelected(new Set())
    setCurrent(null)
  }, [])

  const prune = useCallback((existingIds: number[]) => {
    const existing = new Set(existingIds)
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const next = new Set<number>()
      for (const id of prev) if (existing.has(id)) next.add(id)
      return next.size === prev.size ? prev : next
    })
    setCurrent((prev) => (prev !== null && !existing.has(prev) ? null : prev))
  }, [])

  return useMemo(
    () => ({ selected, current, onRowClick, onCheckboxToggle, onSelectAll, onClear, prune }),
    [selected, current, onRowClick, onCheckboxToggle, onSelectAll, onClear, prune],
  )
}
