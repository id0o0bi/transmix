import { useRef, useState } from "react"
import { FileUp, Link2, Plus } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { readAsBase64 } from "@/lib/files"

export interface AddPayload {
  urls: string[]
  files: { filename: string; base64: string }[]
  paused: boolean
}

interface AddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: AddPayload) => void
}

export function AddDialog({ open, onOpenChange, onSubmit }: AddDialogProps) {
  const [tab, setTab] = useState("url")
  const [urlsText, setUrlsText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const urls = urlsText
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s !== "")

  const canSubmit = !busy && (tab === "url" ? urls.length > 0 : files.length > 0)

  const reset = () => {
    setUrlsText("")
    setFiles([])
    setPaused(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      const filePayloads =
        tab === "file"
          ? await Promise.all(
              files.map(async (file) => ({
                filename: file.name,
                base64: await readAsBase64(file),
              })),
            )
          : []
      onSubmit({
        urls: tab === "url" ? urls : [],
        files: filePayloads,
        paused,
      })
      reset()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add torrents</DialogTitle>
          <DialogDescription>
            Paste magnet links or HTTP URLs, or pick .torrent files from disk.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">
              <Link2 className="mr-1.5 size-4" />
              URLs / Magnet
            </TabsTrigger>
            <TabsTrigger value="file">
              <FileUp className="mr-1.5 size-4" />
              Torrent files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-2">
            <Label htmlFor="add-urls">One link per line</Label>
            <Textarea
              id="add-urls"
              rows={6}
              placeholder={"magnet:?xt=urn:btih:...\nhttps://example.com/file.torrent"}
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              className="font-mono text-xs"
            />
          </TabsContent>

          <TabsContent value="file" className="space-y-2">
            <Label htmlFor="add-files">.torrent files</Label>
            <Input
              id="add-files"
              ref={fileInputRef}
              type="file"
              accept=".torrent,application/x-bittorrent"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {files.length} {files.length === 1 ? "file" : "files"} selected
              </p>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Switch id="add-paused" checked={paused} onCheckedChange={setPaused} />
            <Label htmlFor="add-paused" className="text-sm font-normal">
              Start paused
            </Label>
          </div>
          {!canSubmit && !busy && (
            <span className="text-xs text-muted-foreground">
              {tab === "url" ? "Enter at least one link" : "Select a .torrent file"}
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            <Plus className="mr-1.5 size-4" />
            {busy ? "Reading…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
