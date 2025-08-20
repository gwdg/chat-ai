// src/store/services/appApi.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ModelInfo } from "../../types/models";
import type { User } from "../../types/user";

export const appApi = createApi({
  reducerPath: "appApi",
  baseQuery: fetchBaseQuery({}), // absolute URLs work fine here
  tagTypes: ["ModelList", "User"],
  endpoints: (builder) => ({
    // --- USER ---------------------------------------------------------------
    getUser: builder.query<User, void>({
      query: () => ({
        url: import.meta.env.VITE_USERDATA_ENDPOINT,
        method: "GET",
      }),
      providesTags: ["User"],
    }),

    // --- MODELS -------------------------------------------------------------
    getModels: builder.query<ModelInfo[], void>({
      query: () => ({
        url: import.meta.env.VITE_MODELS_ENDPOINT,
        method: "GET",
      }),
      // Accepts either { data: ModelInfo[] } or a bare ModelInfo[]
      transformResponse: (response: unknown): ModelInfo[] => {
        console.log("RTK QUERY ModelSelector: modelsList updated", response);
        const raw =(response as any)?.data ?? []

        return (raw as ModelInfo[]).map((model) => ({
          ...model,
          name: model.name ?? model.id,
          extended: Boolean((model as any)?.description),
        }));
      },
      providesTags: ["ModelList"],
    }),
  }),
});

export const { useGetModelsQuery, useGetUserQuery } = appApi;

// --- Global invalidation helpers (unchanged) --------------------------------
export const forceRefetchModelList =
  () => (dispatch: any) => dispatch(appApi.util.invalidateTags(["ModelList"]));

export const forceRefetchUser =
  () => (dispatch: any) => dispatch(appApi.util.invalidateTags(["User"]));
