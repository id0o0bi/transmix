// Flag letters come from Transmission's peer-mgr.cc / docs/Peer-Status-Text.md.
// The tooltip groups the decoded description into one line per section.
export function flagsTooltip(flagStr: string | undefined): string {
  const fs = flagStr ?? ""
  const has = (c: string) => fs.includes(c)
  const status: string[] = []
  if (has("O")) status.push("optimistic unchoke")
  if (has("D")) status.push("downloading")
  if (has("d")) status.push("can download from")
  if (has("U")) status.push("uploading")
  if (has("u")) status.push("can upload to")
  if (has("K")) status.push("not interested")
  if (has("?")) status.push("peer not interested")
  const source = [
    has("X") ? "PEX" : "",
    has("H") ? "DHT" : "",
  ].filter((s) => s !== "")
  const lines = [
    fs,
    `Status: ${status.length > 0 ? status.join(", ") : "idle"}`,
    `Encryption: ${has("E") ? "encrypted" : "plain text"}`,
    `Protocol: ${has("T") ? "µTP" : "TCP"}`,
    `Source: ${source.length > 0 ? source.join(" + ") : "tracker"}`,
    `Connection: ${has("I") ? "incoming" : "outgoing"}`,
  ]
  if (has("h")) lines.push("Holepunch: active")
  return lines.join("\n")
}
