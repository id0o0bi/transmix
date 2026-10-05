import { useEffect, useState } from "react"

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 639px)").matches,
  )

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const onChange = (event: MediaQueryListEvent) => setMobile(event.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return mobile
}
