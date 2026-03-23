import { createSlice } from '@reduxjs/toolkit';
import { validateStructuredResponse, initializeFormValues } from '../../utils/structuredToolValidation';
import { saveStructuredToolData, getStructuredToolData } from '../../db';

const initialState = {
  activeResponses: {},
  history: [],
  loading: {},
  errors: {},
  savedFormValues: {}
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

    saveFormValues: (state, action) => {
      const { messageId, toolId, values } = action.payload;
      if (!state.savedFormValues) state.savedFormValues = {};
      
      const key = `${messageId}_${toolId}`;
      state.savedFormValues[key] = {
        values,
        timestamp: new Date().toISOString()
      };
      
      saveStructuredToolData(messageId, toolId, values);
    },

    loadFormValues: (state, action) => {
      const { messageId, toolId } = action.payload;
      
      getStructuredToolData(messageId, toolId).then(data => {
        if (data) {
          const key = `${messageId}_${toolId}`;
          if (!state.savedFormValues) state.savedFormValues = {};
          state.savedFormValues[key] = {
            values: data,
            timestamp: new Date().toISOString()
          };
        }
      }).catch(error => {
        console.error('Error loading structured tool data:', error);
      });
      
      const key = `${messageId}_${toolId}`;
      return state.savedFormValues?.[key]?.values || null;
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
  saveFormValues,
  loadFormValues,
  resetAll
} = structuredToolResponsesSlice.actions;

export default structuredToolResponsesSlice.reducer;

export const selectActiveResponse = (id) => (state) => 
  state?.structuredToolResponses?.activeResponses?.[id];

export const selectAllActiveResponses = (state) => 
  state?.structuredToolResponses?.activeResponses || {};

export const selectIsLoading = (id) => (state) => 
  state?.structuredToolResponses?.loading?.[id] || false;

export const selectError = (id) => (state) => 
  state?.structuredToolResponses?.errors?.[id];

export const selectHistory = (state) => 
  state?.structuredToolResponses?.history || [];

export const selectSavedFormValues = (messageId, toolId) => (state) => {
  if (!state) return null;
  const key = `${messageId}_${toolId}`;
  return state.structuredToolResponses?.savedFormValues?.[key]?.values || null;
};