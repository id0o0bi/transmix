import { useState } from "react"
import { FolderInput } from "lucide-react"
import { useTorrentActions } from "@/hooks/use-torrent-actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

interface MoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ids: number[]
  /** Prefill from the first selected torrent's download directory. */
  currentPath?: string
}

export function MoveDialog({ open, onOpenChange, ids, currentPath }: MoveDialogProps) {
  const actions = useTorrentActions()
  // null = untouched since last open, so the input re-prefills on every open.
  const [pathInput, setPathInput] = useState<string | null>(null)
  const [moveFiles, setMoveFiles] = useState(true)
  const [saving, setSaving] = useState(false)

  const path = pathInput ?? currentPath ?? ""
  const count = ids.length
  const canSubmit = path.trim() !== "" && count > 0 && !saving

  const close = (next: boolean) => {
    if (!next) {
      setPathInput(null)
      setMoveFiles(true)
      setSaving(false)
    }
    onOpenChange(next)
  }

  const submit = () => {
    if (!canSubmit) return
    setSaving(true)
    void actions.moveLocation(ids, path.trim(), moveFiles).then((ok) => {
      if (ok) close(false)
      else setSaving(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{count === 1 ? "Move torrent" : `Move ${count} torrents`}</DialogTitle>
          <DialogDescription>
            Point Transmission at a new location for this data, optionally moving existing files
            there.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="move-location">Location</Label>
            <Input
              id="move-location"
              value={path}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="/path/to/downloads"
              spellCheck={false}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="move-files"
              checked={moveFiles}
              onCheckedChange={(v) => setMoveFiles(v === true)}
            />
            <Label htmlFor="move-files" className="font-normal text-muted-foreground">
              Move existing files to the new location
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            <FolderInput className="mr-1.5 size-4" />
            {saving ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
