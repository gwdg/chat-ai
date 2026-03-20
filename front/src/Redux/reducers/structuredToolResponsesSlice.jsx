import { createSlice } from '@reduxjs/toolkit';
import { validateStructuredResponse, initializeFormValues } from '../../utils/structuredToolValidation';

const initialState = {
  activeResponses: {},
  history: [],
  loading: {},
  errors: {}
};

const structuredToolResponsesSlice = createSlice({
  name: 'structuredToolResponses',
  initialState,
  reducers: {
    setActiveResponse: (state, action) => {
      const { id, response } = action.payload;

      const validationResult = validateStructuredResponse(response);

      if (!validationResult.valid) {
        state.errors[id] = validationResult.errors;
        return;
      }

      delete state.errors[id];

      state.activeResponses[id] = {
        ...response,
        id,
        formData: response.data?.values || initializeFormValues(response.data?.schema)
      };
    },

    updateResponse: (state, action) => {
      const { id, updates } = action.payload;

      if (state.activeResponses[id]) {
        state.activeResponses[id] = {
          ...state.activeResponses[id],
          ...updates
        };
      }
    },

    updateFormData: (state, action) => {
      const { id, field, value } = action.payload;

      if (state.activeResponses[id]) {
        state.activeResponses[id].formData = {
          ...state.activeResponses[id].formData,
          [field]: value
        };
      }
    },

    removeActiveResponse: (state, action) => {
      const id = action.payload;
      delete state.activeResponses[id];
      delete state.loading[id];
      delete state.errors[id];
    },

    addToHistory: (state, action) => {
      state.history.push({
        ...action.payload,
        timestamp: new Date().toISOString()
      });
    },

    clearHistory: (state) => {
      state.history = [];
    },

    setLoading: (state, action) => {
      const { id, loading } = action.payload;
      state.loading[id] = loading;
    },

    setError: (state, action) => {
      const { id, error } = action.payload;
      state.errors[id] = Array.isArray(error) ? error : [error];
    },

    clearError: (state, action) => {
      const id = action.payload;
      delete state.errors[id];
    },

    resetAll: () => initialState
  }
});

export const {
  setActiveResponse,
  updateResponse,
  updateFormData,
  removeActiveResponse,
  addToHistory,
  clearHistory,
  setLoading,
  setError,
  clearError,
  resetAll
} = structuredToolResponsesSlice.actions;

export default structuredToolResponsesSlice.reducer;

export const selectActiveResponse = (id) => (state) => 
  state.structuredToolResponses?.activeResponses?.[id];

export const selectAllActiveResponses = (state) => 
  state.structuredToolResponses?.activeResponses || {};

export const selectIsLoading = (id) => (state) => 
  state.structuredToolResponses?.loading?.[id] || false;

export const selectError = (id) => (state) => 
  state.structuredToolResponses?.errors?.[id];

export const selectHistory = (state) => 
  state.structuredToolResponses?.history || [];