import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { rpc, TransmissionRpcError, type SessionInfo } from "@/lib/transmission"
import { loadPref, savePref } from "@/lib/prefs"
import { cn } from "@/lib/utils"
import { useSession } from "@/hooks/use-session"
import { errorMessage } from "@/hooks/use-torrent-actions"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

function TextField(props: {
  id: string
  label: string
  value: string
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id} className="text-sm font-normal">
        {props.label}
      </Label>
      <Input
        id={props.id}
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}

function SwitchField(props: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={props.id} className="text-sm font-normal">
        {props.label}
      </Label>
      <Switch
        id={props.id}
        checked={props.checked}
        disabled={props.disabled}
        onCheckedChange={props.onCheckedChange}
      />
    </div>
  )
}

function SelectField(props: {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id} className="text-sm font-normal">
        {props.label}
      </Label>
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={cn(
          "border-input flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
          "dark:bg-input/30",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function DayChips(props: { value: number; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DAYS.map((day, i) => {
        const on = (props.value & (1 << i)) !== 0
        return (
          <button
            key={day}
            type="button"
            disabled={props.disabled}
            aria-pressed={on}
            className={cn(
              "h-7 rounded-md border px-2 text-xs font-medium transition-colors",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
              props.disabled && "pointer-events-none opacity-50",
            )}
            onClick={() => props.onChange(on ? props.value & ~(1 << i) : props.value | (1 << i))}
          >
            {day}
          </button>
        )
      })}
    </div>
  )
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function timeToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (m === null) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isInteger(h) || !Number.isInteger(min) || h > 23 || min > 59) return null
  return h * 60 + min
}

function str(v: number | string | undefined, fallback = ""): string {
  return v === undefined ? fallback : String(v)
}

interface SettingsForm {
  downloadDir: string
  startAdded: boolean
  sequential: boolean
  renamePartial: boolean
  incompleteEnabled: boolean
  incompleteDir: string
  ratioEnabled: boolean
  ratioLimit: string
  idleEnabled: boolean
  idleLimit: string
  cacheSize: string
  downEnabled: boolean
  downLimit: string
  upEnabled: boolean
  upLimit: string
  altEnabled: boolean
  altDown: string
  altUp: string
  altTimeEnabled: boolean
  altTimeBegin: string
  altTimeEnd: string
  altTimeDay: number
  peerPort: string
  randomPort: boolean
  portForwarding: boolean
  encryption: string
  peerLimitGlobal: string
  peerLimitTorrent: string
  pex: boolean
  dht: boolean
  lpd: boolean
  utp: boolean
  blocklistEnabled: boolean
  blocklistUrl: string
  dlQueueEnabled: boolean
  dlQueueSize: string
  seedQueueEnabled: boolean
  seedQueueSize: string
  stalledEnabled: boolean
  stalledMinutes: string
}

function initForm(session: SessionInfo): SettingsForm {
  return {
    downloadDir: session["download-dir"] ?? "",
    startAdded: session["start-added-torrents"] ?? false,
    sequential: session["sequential_download"] ?? false,
    renamePartial: session["rename-partial-files"] ?? false,
    incompleteEnabled: session["incomplete-dir-enabled"] ?? false,
    incompleteDir: session["incomplete-dir"] ?? "",
    ratioEnabled: session["seedRatioLimited"] ?? false,
    ratioLimit: str(session["seedRatioLimit"], "2"),
    idleEnabled: session["idle-seeding-limit-enabled"] ?? false,
    idleLimit: str(session["idle-seeding-limit"], "30"),
    cacheSize: str(session["cache-size-mb"], "4"),
    downEnabled: session["speed-limit-down-enabled"] ?? false,
    downLimit: str(session["speed-limit-down"], "100"),
    upEnabled: session["speed-limit-up-enabled"] ?? false,
    upLimit: str(session["speed-limit-up"], "100"),
    altEnabled: session["alt-speed-enabled"] ?? false,
    altDown: str(session["alt-speed-down"], "10"),
    altUp: str(session["alt-speed-up"], "10"),
    altTimeEnabled: session["alt-speed-time-enabled"] ?? false,
    altTimeBegin: minutesToTime(session["alt-speed-time-begin"] ?? 120),
    altTimeEnd: minutesToTime(session["alt-speed-time-end"] ?? 420),
    altTimeDay: session["alt-speed-time-day"] ?? 127,
    peerPort: str(session["peer-port"]),
    randomPort: session["peer-port-random-on-start"] ?? false,
    portForwarding: session["port-forwarding-enabled"] ?? false,
    encryption: session["encryption"] ?? "tolerated",
    peerLimitGlobal: str(session["peer-limit-global"], "500"),
    peerLimitTorrent: str(session["peer-limit-per-torrent"], "50"),
    pex: session["pex-enabled"] ?? false,
    dht: session["dht-enabled"] ?? false,
    lpd: session["lpd-enabled"] ?? false,
    utp: session["utp-enabled"] ?? false,
    blocklistEnabled: session["blocklist-enabled"] ?? false,
    blocklistUrl: session["blocklist-url"] ?? "",
    dlQueueEnabled: session["download-queue-enabled"] ?? false,
    dlQueueSize: str(session["download-queue-size"], "5"),
    seedQueueEnabled: session["seed-queue-enabled"] ?? false,
    seedQueueSize: str(session["seed-queue-size"], "10"),
    stalledEnabled: session["queue-stalled-enabled"] ?? false,
    stalledMinutes: str(session["queue-stalled-minutes"], "30"),
  }
}

type PortTestState = "idle" | "loading" | "open" | "closed" | "error"

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const queryClient = useQueryClient()
  const session = useSession().data

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SettingsForm | null>(null)
  const [portTest, setPortTest] = useState<PortTestState>("idle")
  const [blocklistUpdating, setBlocklistUpdating] = useState(false)
  const [blocklistUnsupported, setBlocklistUnsupported] = useState(false)
  const [peerGeo, setPeerGeo] = useState(() => loadPref<boolean>("peerCountryLookup", false))
  const initedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      initedRef.current = false
      setPortTest("idle")
      return
    }
    if (!initedRef.current && session !== undefined) {
      initedRef.current = true
      setForm(initForm(session))
    }
  }, [open, session])

  const patch = (p: Partial<SettingsForm>) => setForm((f) => (f === null ? f : { ...f, ...p }))

  const save = async () => {
    if (form === null) return
    setSaving(true)
    try {
      const args: Record<string, unknown> = {
        "start-added-torrents": form.startAdded,
        "rename-partial-files": form.renamePartial,
        "incomplete-dir-enabled": form.incompleteEnabled,
        "seedRatioEnabled": form.ratioEnabled,
        "idle-seeding-limit-enabled": form.idleEnabled,
        "speed-limit-down-enabled": form.downEnabled,
        "speed-limit-up-enabled": form.upEnabled,
        "alt-speed-enabled": form.altEnabled,
        "alt-speed-time-enabled": form.altTimeEnabled,
        "alt-speed-time-day": form.altTimeDay,
        "peer-port-random-on-start": form.randomPort,
        "port-forwarding-enabled": form.portForwarding,
        "pex-enabled": form.pex,
        "dht-enabled": form.dht,
        "lpd-enabled": form.lpd,
        "utp-enabled": form.utp,
        "blocklist-enabled": form.blocklistEnabled,
        "download-queue-enabled": form.dlQueueEnabled,
        "seed-queue-enabled": form.seedQueueEnabled,
        "queue-stalled-enabled": form.stalledEnabled,
      }
      if (session?.sequential_download !== undefined) {
        args["sequential_download"] = form.sequential
      }
      if (["tolerated", "preferred", "required"].includes(form.encryption)) {
        args.encryption = form.encryption
      }

      const putNum = (key: string, raw: string, opts?: { float?: boolean; min?: number; max?: number }) => {
        const n = Number(raw)
        const min = opts?.min ?? 0
        if (!Number.isFinite(n) || n < min) return
        if (opts?.max !== undefined && n > opts.max) return
        args[key] = opts?.float === true ? n : Math.round(n)
      }
      putNum("speed-limit-down", form.downLimit)
      putNum("speed-limit-up", form.upLimit)
      putNum("alt-speed-down", form.altDown)
      putNum("alt-speed-up", form.altUp)
      putNum("seedRatioLimit", form.ratioLimit, { float: true })
      putNum("idle-seeding-limit", form.idleLimit)
      putNum("cache-size-mb", form.cacheSize)
      putNum("peer-limit-global", form.peerLimitGlobal)
      putNum("peer-limit-per-torrent", form.peerLimitTorrent)
      putNum("download-queue-size", form.dlQueueSize)
      putNum("seed-queue-size", form.seedQueueSize)
      putNum("queue-stalled-minutes", form.stalledMinutes)
      if (!form.randomPort) putNum("peer-port", form.peerPort, { min: 1, max: 65535 })
      const begin = timeToMinutes(form.altTimeBegin)
      if (begin !== null) args["alt-speed-time-begin"] = begin
      const end = timeToMinutes(form.altTimeEnd)
      if (end !== null) args["alt-speed-time-end"] = end

      if (form.downloadDir.trim() !== "") args["download-dir"] = form.downloadDir.trim()
      if (form.incompleteDir.trim() !== "") args["incomplete-dir"] = form.incompleteDir.trim()
      if (form.blocklistUrl.trim() !== "") args["blocklist-url"] = form.blocklistUrl.trim()

      await rpc.sessionSet(args)
      await queryClient.invalidateQueries({ queryKey: ["session"] })
      toast.success("Settings saved")
      onOpenChange(false)
    } catch (err) {
      toast.error("Could not save settings", { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const testPort = async () => {
    setPortTest("loading")
    try {
      const res = await rpc.portTest()
      setPortTest(res["port-is-open"] ? "open" : "closed")
    } catch {
      setPortTest("error")
    }
  }

  const updateBlocklist = async () => {
    setBlocklistUpdating(true)
    try {
      const res = await rpc.blocklistUpdate()
      const size = res["blocklist-size"]
      toast.success("Blocklist updated", {
        description: size !== undefined ? `${size.toLocaleString()} rules` : undefined,
      })
      void queryClient.invalidateQueries({ queryKey: ["session"] })
    } catch (err) {
      const is404 =
        (err instanceof TransmissionRpcError && err.httpStatus === 404) ||
        /HTTP 404/.test(errorMessage(err))
      if (is404) {
        setBlocklistUnsupported(true)
      } else {
        toast.error("Could not update blocklist", { description: errorMessage(err) })
      }
    } finally {
      setBlocklistUpdating(false)
    }
  }

  const blocklistSize = session?.["blocklist-size"]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Session-wide Transmission preferences.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="download">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="download">Download</TabsTrigger>
            <TabsTrigger value="bandwidth">Bandwidth</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
          </TabsList>

          <div className="min-w-0 overflow-y-auto overflow-x-hidden pr-1 max-h-[60vh]">
            <TabsContent value="download" className="space-y-4 pt-3">
              <TextField
                id="set-download-dir"
                label="Default download directory"
                value={form?.downloadDir ?? ""}
                placeholder="/home/user/Downloads"
                onChange={(v) => patch({ downloadDir: v })}
              />
              <SwitchField
                id="set-start-added"
                label="Start added torrents"
                checked={form?.startAdded ?? false}
                onCheckedChange={(v) => patch({ startAdded: v })}
              />
              <SwitchField
                id="set-sequential"
                label="Download torrent pieces sequentially"
                checked={form?.sequential ?? false}
                onCheckedChange={(v) => patch({ sequential: v })}
              />
              <SwitchField
                id="set-rename-partial"
                label="Add .part extension to incomplete files"
                checked={form?.renamePartial ?? false}
                onCheckedChange={(v) => patch({ renamePartial: v })}
              />
              <SwitchField
                id="set-incomplete-enabled"
                label="Use separate directory for incomplete files"
                checked={form?.incompleteEnabled ?? false}
                onCheckedChange={(v) => patch({ incompleteEnabled: v })}
              />
              <TextField
                id="set-incomplete-dir"
                label="Path for incomplete files"
                value={form?.incompleteDir ?? ""}
                disabled={form !== null && !form.incompleteEnabled}
                onChange={(v) => patch({ incompleteDir: v })}
              />
              <div className="border-t pt-4">
                <SwitchField
                  id="set-ratio-enabled"
                  label="Stop seeding at ratio"
                  checked={form?.ratioEnabled ?? false}
                  onCheckedChange={(v) => patch({ ratioEnabled: v })}
                />
                <div className="mt-3">
                  <NumberField
                    id="set-ratio-limit"
                    label="Ratio limit"
                    value={form?.ratioLimit ?? ""}
                    suffix="×"
                    disabled={form !== null && !form.ratioEnabled}
                    onChange={(v) => patch({ ratioLimit: v })}
                  />
                </div>
              </div>
              <div className="border-t pt-4">
                <SwitchField
                  id="set-idle-enabled"
                  label="Stop idle torrents after"
                  checked={form?.idleEnabled ?? false}
                  onCheckedChange={(v) => patch({ idleEnabled: v })}
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <NumberField
                    id="set-idle-limit"
                    label="Idle limit"
                    value={form?.idleLimit ?? ""}
                    suffix="min"
                    disabled={form !== null && !form.idleEnabled}
                    onChange={(v) => patch({ idleLimit: v })}
                  />
                  <NumberField
                    id="set-cache-size"
                    label="Disk cache size"
                    value={form?.cacheSize ?? ""}
                    suffix="MiB"
                    onChange={(v) => patch({ cacheSize: v })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bandwidth" className="space-y-4 pt-3">
              <SwitchField
                id="set-down-enabled"
                label="Limit download speed"
                checked={form?.downEnabled ?? false}
                onCheckedChange={(v) => patch({ downEnabled: v })}
              />
              <NumberField
                id="set-down-limit"
                label="Download limit"
                value={form?.downLimit ?? ""}
                suffix="KiB/s"
                disabled={form !== null && !form.downEnabled}
                onChange={(v) => patch({ downLimit: v })}
              />
              <SwitchField
                id="set-up-enabled"
                label="Limit upload speed"
                checked={form?.upEnabled ?? false}
                onCheckedChange={(v) => patch({ upEnabled: v })}
              />
              <NumberField
                id="set-up-limit"
                label="Upload limit"
                value={form?.upLimit ?? ""}
                suffix="KiB/s"
                disabled={form !== null && !form.upEnabled}
                onChange={(v) => patch({ upLimit: v })}
              />
              <div className="border-t pt-4">
                <SwitchField
                  id="set-alt-enabled"
                  label="Alternative speed limits (turtle mode)"
                  checked={form?.altEnabled ?? false}
                  onCheckedChange={(v) => patch({ altEnabled: v })}
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <NumberField
                    id="set-alt-down"
                    label="Alt down"
                    value={form?.altDown ?? ""}
                    suffix="KiB/s"
                    onChange={(v) => patch({ altDown: v })}
                  />
                  <NumberField
                    id="set-alt-up"
                    label="Alt up"
                    value={form?.altUp ?? ""}
                    suffix="KiB/s"
                    onChange={(v) => patch({ altUp: v })}
                  />
                </div>
              </div>
              <div className="border-t pt-4">
                <SwitchField
                  id="set-alt-time-enabled"
                  label="Apply alternative limits on a schedule"
                  checked={form?.altTimeEnabled ?? false}
                  onCheckedChange={(v) => patch({ altTimeEnabled: v })}
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <TextField
                    id="set-alt-time-begin"
                    label="From"
                    value={form?.altTimeBegin ?? ""}
                    disabled={form !== null && !form.altTimeEnabled}
                    onChange={(v) => patch({ altTimeBegin: v })}
                  />
                  <TextField
                    id="set-alt-time-end"
                    label="Until"
                    value={form?.altTimeEnd ?? ""}
                    disabled={form !== null && !form.altTimeEnabled}
                    onChange={(v) => patch({ altTimeEnd: v })}
                  />
                </div>
                <div className="mt-3 grid gap-1.5">
                  <Label className="text-sm font-normal">Days</Label>
                  <DayChips
                    value={form?.altTimeDay ?? 127}
                    disabled={form !== null && !form.altTimeEnabled}
                    onChange={(v) => patch({ altTimeDay: v })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="network" className="space-y-4 pt-3">
              <div className="grid gap-1.5">
                <Label htmlFor="set-peer-port" className="text-sm font-normal">
                  Peer port
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="set-peer-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={form?.peerPort ?? ""}
                    disabled={form !== null && form.randomPort}
                    onChange={(e) => patch({ peerPort: e.target.value })}
                    className="w-28"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void testPort()}
                        disabled={portTest === "loading"}
                      >
                        {portTest === "loading" ? "Testing…" : "Test port"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Checks the currently configured port. Save changes first.
                    </TooltipContent>
                  </Tooltip>
                  {portTest === "open" && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Port is open</span>
                  )}
                  {portTest === "closed" && (
                    <span className="text-xs text-destructive">Port unreachable</span>
                  )}
                  {portTest === "error" && (
                    <span className="text-xs text-destructive">Test failed</span>
                  )}
                </div>
              </div>
              <SwitchField
                id="set-random-port"
                label="Let the daemon pick a random port"
                checked={form?.randomPort ?? false}
                onCheckedChange={(v) => patch({ randomPort: v })}
              />
              <SwitchField
                id="set-port-forwarding"
                label="Enable port forwarding (NAT-PMP / UPnP)"
                checked={form?.portForwarding ?? false}
                onCheckedChange={(v) => patch({ portForwarding: v })}
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  id="set-encryption"
                  label="Encryption"
                  value={form?.encryption ?? "tolerated"}
                  options={[
                    { value: "tolerated", label: "Tolerated" },
                    { value: "preferred", label: "Preferred" },
                    { value: "required", label: "Required" },
                  ]}
                  onChange={(v) => patch({ encryption: v })}
                />
                <div />
                <NumberField
                  id="set-peer-limit-global"
                  label="Global peer limit"
                  value={form?.peerLimitGlobal ?? ""}
                  onChange={(v) => patch({ peerLimitGlobal: v })}
                />
                <NumberField
                  id="set-peer-limit-torrent"
                  label="Per-torrent peer limit"
                  value={form?.peerLimitTorrent ?? ""}
                  onChange={(v) => patch({ peerLimitTorrent: v })}
                />
              </div>
              <div className="border-t pt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                <SwitchField
                  id="set-pex"
                  label="Peer exchange (PEX)"
                  checked={form?.pex ?? false}
                  onCheckedChange={(v) => patch({ pex: v })}
                />
                <SwitchField
                  id="set-dht"
                  label="DHT"
                  checked={form?.dht ?? false}
                  onCheckedChange={(v) => patch({ dht: v })}
                />
                <SwitchField
                  id="set-lpd"
                  label="Local discovery"
                  checked={form?.lpd ?? false}
                  onCheckedChange={(v) => patch({ lpd: v })}
                />
                <SwitchField
                  id="set-utp"
                  label="uTP"
                  checked={form?.utp ?? false}
                  onCheckedChange={(v) => patch({ utp: v })}
                />
              </div>
              <div className="border-t pt-4 space-y-3">
                <SwitchField
                  id="set-blocklist"
                  label="Enable blocklist"
                  checked={form?.blocklistEnabled ?? false}
                  onCheckedChange={(v) => patch({ blocklistEnabled: v })}
                />
                <TextField
                  id="set-blocklist-url"
                  label="Blocklist URL"
                  value={form?.blocklistUrl ?? ""}
                  disabled={form !== null && !form.blocklistEnabled}
                  onChange={(v) => patch({ blocklistUrl: v })}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {blocklistUnsupported
                      ? "Blocklist updates aren't supported by this Transmission build (HTTP 404)."
                      : blocklistSize !== undefined
                        ? `Blocklist contains ${blocklistSize.toLocaleString()} rules`
                        : "Blocklist is empty"}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void updateBlocklist()}
                        disabled={
                          blocklistUpdating || blocklistUnsupported || form === null || !form.blocklistEnabled
                        }
                      >
                        {blocklistUpdating ? "Updating…" : "Update blocklist"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Fetches the currently configured blocklist. Save changes first.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="border-t pt-4 space-y-1">
                <SwitchField
                  id="set-peer-geo"
                  label="Show peer country flags"
                  checked={peerGeo}
                  onCheckedChange={(v) => {
                    setPeerGeo(v)
                    savePref("peerCountryLookup", v)
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Looks up peer IP addresses at ipwho.is and caches results in this browser. Off by
                  default — no external requests are made while disabled.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="queue" className="space-y-4 pt-3">
              <div className="flex items-end justify-between gap-4">
                <Label htmlFor="set-dl-queue-size" className="text-sm font-normal">
                  Download queue size
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="set-dl-queue-enabled"
                    checked={form?.dlQueueEnabled ?? false}
                    onCheckedChange={(v) => patch({ dlQueueEnabled: v })}
                  />
                  <Input
                    id="set-dl-queue-size"
                    type="number"
                    min={0}
                    value={form?.dlQueueSize ?? ""}
                    disabled={form !== null && !form.dlQueueEnabled}
                    onChange={(e) => patch({ dlQueueSize: e.target.value })}
                    className="w-20"
                  />
                </div>
              </div>
              <div className="flex items-end justify-between gap-4">
                <Label htmlFor="set-seed-queue-size" className="text-sm font-normal">
                  Seed queue size
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="set-seed-queue-enabled"
                    checked={form?.seedQueueEnabled ?? false}
                    onCheckedChange={(v) => patch({ seedQueueEnabled: v })}
                  />
                  <Input
                    id="set-seed-queue-size"
                    type="number"
                    min={0}
                    value={form?.seedQueueSize ?? ""}
                    disabled={form !== null && !form.seedQueueEnabled}
                    onChange={(e) => patch({ seedQueueSize: e.target.value })}
                    className="w-20"
                  />
                </div>
              </div>
              <div className="flex items-end justify-between gap-4">
                <Label htmlFor="set-stalled-minutes" className="text-sm font-normal">
                  Consider torrents stalled when idle for
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="set-stalled-enabled"
                    checked={form?.stalledEnabled ?? false}
                    onCheckedChange={(v) => patch({ stalledEnabled: v })}
                  />
                  <Input
                    id="set-stalled-minutes"
                    type="number"
                    min={0}
                    value={form?.stalledMinutes ?? ""}
                    disabled={form !== null && !form.stalledEnabled}
                    onChange={(e) => patch({ stalledMinutes: e.target.value })}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || session === undefined || form === null}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
