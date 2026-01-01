import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { User } from '@plukd/shared/types'

async function fetchUser(): Promise<User> {
  return api.get<User>('/api/user')
}

export const userQueryKey = ['user'] as const

export function useUser() {
  return useQuery({
    queryKey: userQueryKey,
    queryFn: fetchUser,
    staleTime: 5 * 60 * 1000, // Consider user data stale after 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message === 'Unauthorized') {
        return false
      }
      return failureCount < 2
    },
  })
}
