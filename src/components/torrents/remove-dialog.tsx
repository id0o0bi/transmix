import { useState } from "react"
import { Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { CachedTorrent } from "@/lib/torrents"

interface RemoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  torrents: CachedTorrent[]
  onConfirm: (removeData: boolean) => void
}

export function RemoveDialog({ open, onOpenChange, torrents, onConfirm }: RemoveDialogProps) {
  const [removeData, setRemoveData] = useState(false)

  const count = torrents.length
  const first = torrents[0]

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setRemoveData(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {count === 1 ? "Remove torrent?" : `Remove ${count} torrents?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {count === 1 && first !== undefined ? (
                  <>
                    <span className="break-all font-medium text-foreground">{first.name}</span> will be
                    removed from Transmission.
                  </>
                ) : (
                  <>The selected torrents will be removed from Transmission.</>
                )}
              </p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remove-data"
                  checked={removeData}
                  onCheckedChange={(v) => setRemoveData(v === true)}
                />
                <Label htmlFor="remove-data" className="font-normal text-muted-foreground">
                  Also permanently delete downloaded data
                </Label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm(removeData)
              setRemoveData(false)
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            <Trash2 className="mr-1.5 size-4" />
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
