import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme, type Theme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

interface ThemeToggleProps {
  className?: string
  size?: "sm" | "default"
}

export function ThemeToggle({ className, size = "sm" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const ActiveIcon = themes.find((t) => t.value === theme)?.icon ?? Monitor

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size === "sm" ? "icon" : "default"}
          className={cn(size === "sm" && "size-7", className)}
          aria-label="Theme"
          title={`Theme: ${theme} (${resolvedTheme})`}
        >
          <ActiveIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        {themes.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <Icon />
            {label}
            {value === theme && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
