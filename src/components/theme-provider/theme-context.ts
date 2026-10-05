import { createContext } from "react"

export type Theme = "light" | "dark" | "system"

export interface ThemeProviderState {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

export const ThemeProviderContext = createContext<ThemeProviderState | null>(null)
