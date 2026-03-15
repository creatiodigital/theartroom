import type { TExhibition } from '@/types/exhibition'

import { baseApi } from './baseApi'

export const exhibitionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExhibitionsByUser: builder.query<TExhibition[], string>({
      query: (userId) => `exhibitions?userId=${userId}`,
    }),
    createExhibition: builder.mutation<
      TExhibition,
      {
        mainTitle: string
        userId: string
        userHandler: string
        spaceId?: string
        customUrl: string
      }
    >({
      query: ({ mainTitle, userId, userHandler, spaceId, customUrl }) => {
        const handler = userHandler
        const url = customUrl

        return {
          url: 'exhibitions',
          method: 'POST',
          body: { mainTitle, userId, handler, url, spaceId },
        }
      },
    }),
    deleteExhibition: builder.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({
        url: `exhibitions/${id}`,
        method: 'DELETE',
      }),
    }),
    getExhibitionByUrl: builder.query<TExhibition, { url: string; mode?: 'edit'; preview?: string }>({
      query: ({ url, mode, preview }) => {
        const params = new URLSearchParams()
        if (mode) params.set('mode', mode)
        if (preview) params.set('preview', preview)
        const qs = params.toString()
        return `exhibitions/by-url/${encodeURIComponent(url)}${qs ? `?${qs}` : ''}`
      },
    }),
  }),
  overrideExisting: true,
})

export const {
  useGetExhibitionsByUserQuery,
  useCreateExhibitionMutation,
  useDeleteExhibitionMutation,
  useGetExhibitionByUrlQuery,
} = exhibitionApi
