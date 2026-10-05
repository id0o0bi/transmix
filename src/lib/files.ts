export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(",")
      resolve(comma === -1 ? result : result.slice(comma + 1))
    }
    reader.readAsDataURL(file)
  })
}
