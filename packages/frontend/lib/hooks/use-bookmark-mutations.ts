import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { Bookmark, BookmarkListResponse } from '@plukd/shared/types'
import { bookmarkQueryKey } from './use-bookmark'
import { bookmarksQueryKey } from './use-bookmarks'

// Types for mutation payloads
export interface UpdateBookmarkPayload {
  id: string
  data: Partial<Pick<Bookmark, 'title' | 'category' | 'tags' | 'blurb' | 'summary'>>
}

export interface DeleteBookmarkPayload {
  id: string
}

// Update bookmark mutation
async function updateBookmark({
  id,
  data,
}: UpdateBookmarkPayload): Promise<Bookmark> {
  return api.patch<Bookmark>(`/api/bookmarks/${id}`, data)
}

// Delete bookmark mutation
async function deleteBookmark({
  id,
}: DeleteBookmarkPayload): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/api/bookmarks/${id}`)
}

export function useUpdateBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateBookmark,
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: bookmarkQueryKey(id) })
      await queryClient.cancelQueries({ queryKey: bookmarksQueryKey({}) })

      // Snapshot the previous value
      const previousBookmark = queryClient.getQueryData<Bookmark>(
        bookmarkQueryKey(id)
      )

      // Optimistically update the single bookmark
      if (previousBookmark) {
        queryClient.setQueryData<Bookmark>(bookmarkQueryKey(id), {
          ...previousBookmark,
          ...data,
          updated_at: new Date().toISOString(),
        })
      }

      // Return a context object with the snapshotted value
      return { previousBookmark }
    },
    onError: (_err, { id }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousBookmark) {
        queryClient.setQueryData(bookmarkQueryKey(id), context.previousBookmark)
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Always refetch after error or success to ensure cache is in sync
      queryClient.invalidateQueries({ queryKey: bookmarkQueryKey(id) })
      queryClient.invalidateQueries({ queryKey: bookmarksQueryKey({}) })
    },
  })
}

export function useDeleteBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteBookmark,
    onMutate: async ({ id }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookmarksQueryKey({}) })

      // Snapshot the previous bookmark lists
      const previousBookmarksQueries = queryClient.getQueriesData<BookmarkListResponse>({
        queryKey: ['bookmarks'],
      })

      // Optimistically remove the bookmark from all cached lists
      queryClient.setQueriesData<BookmarkListResponse>(
        { queryKey: ['bookmarks'] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            bookmarks: old.bookmarks.filter((b) => b.id !== id),
            pagination: {
              ...old.pagination,
              total: Math.max(0, old.pagination.total - 1),
            },
          }
        }
      )

      // Remove the single bookmark query
      queryClient.removeQueries({ queryKey: bookmarkQueryKey(id) })

      return { previousBookmarksQueries }
    },
    onError: (_err, _variables, context) => {
      // Roll back to the previous bookmark lists on error
      if (context?.previousBookmarksQueries) {
        context.previousBookmarksQueries.forEach(([queryKey, data]) => {
          if (data) {
            queryClient.setQueryData(queryKey, data)
          }
        })
      }
    },
    onSettled: () => {
      // Invalidate all bookmark queries to ensure cache is in sync
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
    },
  })
}
