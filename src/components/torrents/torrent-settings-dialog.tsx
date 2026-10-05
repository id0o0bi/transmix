import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useTorrentActions } from "@/hooks/use-torrent-actions"
import { rpc } from "@/lib/transmission"

interface TorrentSettingsFields {
  labels: string[]
  group: string
  queuePosition: number
  bandwidthPriority: number
  honorsSessionLimits: boolean
  seedRatioMode: number
  seedRatioLimit: number
  uploadLimited: boolean
  uploadLimit: number
  downloadLimited: boolean
  downloadLimit: number
  "peer-limit": number
  downloadDir: string
}

const GET_FIELDS: string[] = [
  "labels",
  "group",
  "queuePosition",
  "bandwidthPriority",
  "honorsSessionLimits",
  "seedRatioMode",
  "seedRatioLimit",
  "uploadLimited",
  "uploadLimit",
  "downloadLimited",
  "downloadLimit",
  "peer-limit",
  "downloadDir",
]

interface FormState {
  labels: string
  group: string
  queuePosition: string
  bandwidthPriority: number
  honorsSessionLimits: boolean
  seedRatioMode: number
  seedRatioLimit: string
  upEnabled: boolean
  upLimit: string
  downEnabled: boolean
  downLimit: string
  peerLimit: string
  location: string
}

function fromFields(d: TorrentSettingsFields): FormState {
  return {
    labels: (d.labels ?? []).join(", "),
    group: d.group ?? "",
    queuePosition: String(d.queuePosition ?? 0),
    bandwidthPriority: d.bandwidthPriority ?? 0,
    honorsSessionLimits: d.honorsSessionLimits ?? true,
    seedRatioMode: d.seedRatioMode ?? 0,
    seedRatioLimit: String(d.seedRatioLimit ?? 2),
    upEnabled: d.uploadLimited ?? false,
    upLimit: String(d.uploadLimit ?? 0),
    downEnabled: d.downloadLimited ?? false,
    downLimit: String(d.downloadLimit ?? 0),
    peerLimit: String(d["peer-limit"] ?? 0),
    location: d.downloadDir ?? "",
  }
}

function parseNonNegative(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : -1
}

function TextField(props: {
  id: string
  label: string
  value: string
  placeholder?: string
  className?: string
  onChange: (value: string) => void
}) {
  return (
    <div className={`grid gap-1.5 ${props.className ?? ""}`}>
      <Label htmlFor={props.id} className="text-sm font-normal">
        {props.label}
      </Label>
      <Input
        id={props.id}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  )
}

function NumberField(props: {
  id: string
  label: string
  value: string
  suffix?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id} className="text-sm font-normal">
        {props.label}
      </Label>
      <div className="relative">
        <Input
          id={props.id}
          type="number"
          min={0}
          value={props.value}
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.target.value)}
          className="pr-14"
        />
        {props.suffix !== undefined && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {props.suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function LimitField(props: {
  id: string
  label: string
  enabled: boolean
  value: string
  onEnabledChange: (enabled: boolean) => void
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id} className="text-sm font-normal">
        {props.label}
      </Label>
      <div className="flex items-center gap-2">
        <Switch checked={props.enabled} onCheckedChange={props.onEnabledChange} />
        <div className="relative w-28">
          <Input
            id={props.id}
            type="number"
            min={0}
            value={props.value}
            disabled={!props.enabled}
            onChange={(e) => props.onChange(e.target.value)}
            className="pr-12"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            KiB/s
          </span>
        </div>
      </div>
    </div>
  )
}

export function TorrentSettingsDialog({
  open,
  onOpenChange,
  ids,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ids: number[]
}) {
  const actions = useTorrentActions()
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["torrent-settings", ids.join(",")],
    enabled: open && ids.length > 0,
    staleTime: 5_000,
    queryFn: async () => {
      const { torrents } = await rpc.torrentGet<TorrentSettingsFields>(GET_FIELDS, ids)
      return torrents
    },
  })

  const raw = data?.[0]
  const initialForm = raw !== undefined ? fromFields(raw) : null

  useEffect(() => {
    if (open) setForm(null)
  }, [open])

  useEffect(() => {
    if (open && form === null && initialForm !== null) setForm(initialForm)
  }, [open, form, initialForm])

  const save = async () => {
    if (form === null || raw === undefined || ids.length === 0) return
    setSaving(true)
    try {
      const args: Record<string, unknown> = {}

      const labels = form.labels
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "")
      if (labels.join("\n") !== raw.labels.join("\n")) args.labels = labels
      if (form.group !== raw.group) args.group = form.group

      const queue = parseNonNegative(form.queuePosition)
      if (queue >= 0 && queue !== raw.queuePosition) args.queuePosition = queue
      if (form.bandwidthPriority !== raw.bandwidthPriority)
        args.bandwidthPriority = form.bandwidthPriority
      if (form.honorsSessionLimits !== raw.honorsSessionLimits)
        args.honorsSessionLimits = form.honorsSessionLimits
      if (form.seedRatioMode !== raw.seedRatioMode) args.seedRatioMode = form.seedRatioMode

      const ratio = parseNonNegative(form.seedRatioLimit)
      if (ratio >= 0 && ratio !== raw.seedRatioLimit) args.seedRatioLimit = ratio

      if (form.upEnabled !== raw.uploadLimited) args.uploadLimited = form.upEnabled
      const up = parseNonNegative(form.upLimit)
      if (up >= 0 && up !== raw.uploadLimit) args.uploadLimit = up

      if (form.downEnabled !== raw.downloadLimited) args.downloadLimited = form.downEnabled
      const down = parseNonNegative(form.downLimit)
      if (down >= 0 && down !== raw.downloadLimit) args.downloadLimit = down

      const peer = parseNonNegative(form.peerLimit)
      if (peer >= 0 && peer !== raw["peer-limit"]) args["peer-limit"] = peer

      const location = form.location.trim()
      if (location !== "" && location !== raw.downloadDir) args.location = location

      if (Object.keys(args).length > 0) {
        const ok = await actions.setFields(ids, args)
        if (!ok) return
        toast.success(
          `Properties updated${ids.length > 1 ? ` for ${ids.length} torrents` : ""}`,
        )
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Torrent properties</DialogTitle>
          <DialogDescription>
            {ids.length > 1
              ? `Applies to ${ids.length} selected torrents.`
              : "Per-torrent limits, queue position, labels and location."}
          </DialogDescription>
        </DialogHeader>

        {form === null ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {isLoading ? "Loading…" : "No torrent selected."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="tp-labels"
              label="Labels"
              value={form.labels}
              placeholder="separated, by, commas"
              className="sm:col-span-2"
              onChange={(v) => setForm({ ...form, labels: v })}
            />
            <TextField
              id="tp-group"
              label="Group"
              value={form.group}
              onChange={(v) => setForm({ ...form, group: v })}
            />
            <NumberField
              id="tp-queue"
              label="Queue position"
              value={form.queuePosition}
              onChange={(v) => setForm({ ...form, queuePosition: v })}
            />
            <div className="grid gap-1.5">
              <Label className="text-sm font-normal">Bandwidth priority</Label>
              <Select
                value={String(form.bandwidthPriority)}
                onValueChange={(v) => setForm({ ...form, bandwidthPriority: Number(v) })}
              >
                <SelectTrigger className="h-9 w-full" aria-label="Bandwidth priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">Low</SelectItem>
                  <SelectItem value="0">Normal</SelectItem>
                  <SelectItem value="1">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TextField
              id="tp-location"
              label="Download location"
              value={form.location}
              className="sm:col-span-2"
              onChange={(v) => setForm({ ...form, location: v })}
            />

            <LimitField
              id="tp-up-limit"
              label="Upload limit"
              enabled={form.upEnabled}
              value={form.upLimit}
              onEnabledChange={(en) => setForm({ ...form, upEnabled: en })}
              onChange={(v) => setForm({ ...form, upLimit: v })}
            />
            <LimitField
              id="tp-down-limit"
              label="Download limit"
              enabled={form.downEnabled}
              value={form.downLimit}
              onEnabledChange={(en) => setForm({ ...form, downEnabled: en })}
              onChange={(v) => setForm({ ...form, downLimit: v })}
            />

            <div className="grid gap-1.5">
              <Label className="text-sm font-normal">Seed ratio</Label>
              <Select
                value={String(form.seedRatioMode)}
                onValueChange={(v) => setForm({ ...form, seedRatioMode: Number(v) })}
              >
                <SelectTrigger className="h-9 w-full" aria-label="Seed ratio mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Use session default</SelectItem>
                  <SelectItem value="1">Stop at ratio</SelectItem>
                  <SelectItem value="2">No ratio limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumberField
              id="tp-ratio-limit"
              label="Ratio limit"
              value={form.seedRatioLimit}
              disabled={form.seedRatioMode !== 1}
              onChange={(v) => setForm({ ...form, seedRatioLimit: v })}
            />
            <NumberField
              id="tp-peer-limit"
              label="Peer limit"
              value={form.peerLimit}
              onChange={(v) => setForm({ ...form, peerLimit: v })}
            />
            <div className="flex items-end pb-2">
              <Switch
                checked={form.honorsSessionLimits}
                onCheckedChange={(en) => setForm({ ...form, honorsSessionLimits: en })}
              />
              <Label className="ml-2 text-sm font-normal">Honors session limits</Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={form === null || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
