import { useQuery } from '@tanstack/react-query'
import type { User } from '@/types'

async function fetchUser(): Promise<User> {
  const response = await fetch('/api/user')

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized')
    }
    throw new Error('Failed to fetch user')
  }

  return response.json()
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
