import { useState } from "react"
import { Tag } from "lucide-react"
import { useTorrentActions } from "@/hooks/use-torrent-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LabelsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ids: number[]
  /** Prefill from the first selected torrent's labels. */
  currentLabels?: string[]
}

export function LabelsDialog({ open, onOpenChange, ids, currentLabels }: LabelsDialogProps) {
  const actions = useTorrentActions()
  // null = untouched since last open, so the input re-prefills on every open.
  const [labelsInput, setLabelsInput] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const value = labelsInput ?? (currentLabels ?? []).join(", ")
  const count = ids.length
  const canSubmit = count > 0 && !saving

  const close = (next: boolean) => {
    if (!next) {
      setLabelsInput(null)
      setSaving(false)
    }
    onOpenChange(next)
  }

  const submit = () => {
    if (!canSubmit) return
    const labels = value
      .split(",")
      .map((label) => label.trim())
      .filter((label) => label !== "")
    setSaving(true)
    void actions.setFields(ids, { labels }).then((ok) => {
      if (ok) close(false)
      else setSaving(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {count === 1 ? "Set labels" : `Set labels for ${count} torrents`}
          </DialogTitle>
          <DialogDescription>
            Comma-separated labels, applied to all selected torrents. Leave empty to remove all
            labels.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="torrent-labels">Labels</Label>
          <Input
            id="torrent-labels"
            value={value}
            onChange={(e) => setLabelsInput(e.target.value)}
            placeholder="linux, hd, later"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit()
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            <Tag className="mr-1.5 size-4" />
            {saving ? "Saving…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
