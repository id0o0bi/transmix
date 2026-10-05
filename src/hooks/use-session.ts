import { useQuery } from "@tanstack/react-query"
import { rpc } from "@/lib/transmission"

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => rpc.sessionGet(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  })
}

export function useSessionStats() {
  return useQuery({
    queryKey: ["session-stats"],
    queryFn: () => rpc.sessionStats(),
    staleTime: 1_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  })
}
