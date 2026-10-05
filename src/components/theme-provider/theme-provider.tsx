import { useEffect, useState, type ReactNode } from "react"
import { ThemeProviderContext, type Theme } from "./theme-context"

const STORAGE_KEY = "transmix-theme"

function getStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === "light" || value === "dark" || value === "system") return value
  } catch {
    // localStorage unavailable
  }
  return "system"
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyTheme(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window === "undefined" ? false : prefersDark(),
  )

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    applyTheme(theme === "dark" || (theme === "system" && systemDark))
  }, [theme, systemDark])

  const setTheme = (next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable
    }
    setThemeState(next)
  }

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme

  return (
    <ThemeProviderContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
