import { progressVariantClasses, type ProgressVariant } from "@/lib/torrents"
import { cn } from "@/lib/utils"

interface ProgressBarProps {
  percent: number
  variant?: ProgressVariant
  className?: string
}

export function ProgressBar({ percent, variant = "default", className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-primary/15",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          progressVariantClasses[variant],
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
