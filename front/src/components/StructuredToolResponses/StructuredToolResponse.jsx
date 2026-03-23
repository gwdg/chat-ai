import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TextField from './TextField';
import SelectField from './SelectField';
import RadioField from './RadioField';
import NumberField from './NumberField';
import TextareaField from './TextareaField';
import CheckboxField from './CheckboxField';
import RangeSliderField from './RangeSliderField';
import MultiSelectField from './MultiSelectField';
import DateField from './DateField';
import ColorPickerField from './ColorPickerField';
import DynamicField from './DynamicField';
import NestedObjectField from './NestedObjectField';
import ArrayField from './ArrayField';
import { validateForm, sanitizeFormData, initializeFormValues } from '../../utils/structuredToolValidation';
import { updateFormData, removeActiveResponse, addToHistory, setLoading } from '../../Redux/reducers/structuredToolResponsesSlice';
import { FIELD_TYPES, RESPONSE_STATUS } from '../../constants/structuredToolResponses';
import { getStructuredToolData, updateStructuredToolData } from '../../db';
import { Edit2, Save, X } from 'lucide-react';

export default function StructuredToolResponse({ response, onSubmit, onCancel, messageIndex, onChange, onEdit }) {
  const dispatch = useDispatch();
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [cachedFormData, setCachedFormData] = useState(null);
  
  const isLocked = response.locked === true || !isEditMode;
  
  // Early return if response or response.data is invalid
  if (!response || !response.data) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
        <p className="text-sm text-red-800 dark:text-red-200">
          Invalid response data
        </p>
      </div>
    );
  }

  const { schema, values: initialValues, metadata } = response.data;
  const messageId = metadata?.messageId;
  const toolId = metadata?.tool_id || response.tool_id;

  const [formData, setFormData] = useState(() => {
    try {
      if (initialValues && typeof initialValues === 'object') return initialValues;
      if (schema && typeof schema === 'object') return initializeFormValues(schema);
      return {};
    } catch (error) {
      console.error("Error initializing form data:", error);
      return {};
    }
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    if (messageId && toolId) {
      getStructuredToolData(messageId, toolId).then(data => {
        if (data && typeof data === 'object') {
          const loadedData = { ...data };
          setFormData(loadedData);
          setCachedFormData(loadedData);
        }
      }).catch(error => {
        console.error('Error loading structured tool data from IndexedDB:', error);
      });
    }
  }, [messageId, toolId]);
  
  useEffect(() => {
    if (JSON.stringify(formData) !== JSON.stringify(cachedFormData)) {
      setHasUnsavedChanges(true);
    }
  }, [formData, cachedFormData]);
  
  if (!schema || !Array.isArray(schema.fields)) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Invalid schema configuration
        </p>
      </div>
    );
  }

  const handleFieldChange = (fieldName, value) => {
    if (!isEditMode) return;
    
    const newFormData = {
      ...formData,
      [fieldName]: value
    };
    setFormData(newFormData);
  };

  const renderField = (field) => {
    if (!field || !field.name) {
      console.warn("Invalid field:", field);
      return null;
    }

    const error = errors[field.name];
    const fieldType = field.type?.toLowerCase() || field.componentType || 'text';
    const fieldValue = formData != null ? formData[field.name] : undefined;
    const fieldDisabled = isLocked || field.disabled;
    const fieldWithDisabled = { ...field, disabled: fieldDisabled };

    switch (fieldType) {
      case FIELD_TYPES.TEXT:
      case 'text':
        return (
          <TextField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.NUMBER:
      case 'number':
        return (
          <NumberField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.SELECT:
      case 'select':
        return (
          <SelectField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.RADIO:
      case 'radio':
        return (
          <RadioField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.TEXTAREA:
      case 'textarea':
        return (
          <TextareaField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.CHECKBOX:
      case 'checkbox':
        return (
          <CheckboxField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.SLIDER:
      case 'slider':
      case 'range':
        return (
          <RangeSliderField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.DATE:
      case 'date':
        return (
          <DateField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.MULTISELECT:
      case 'multiselect':
        return (
          <MultiSelectField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case 'color':
      case 'colorpicker':
        return (
          <ColorPickerField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case 'dynamic':
      case 'custom':
        return (
          <DynamicField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case 'nested':
      case 'object':
        return (
          <NestedObjectField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case 'array':
      case 'list':
        return (
          <ArrayField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );

      default:
        console.warn(`Unsupported field type: ${field.type}, trying dynamic rendering`);
        return (
          <DynamicField
            field={fieldWithDisabled}
            value={fieldValue}
            onChange={handleFieldChange}
            error={error}
          />
        );
    }
  };

  const getLayoutClass = () => {
    if (!schema?.layout) return '';
    return schema.layout === 'horizontal' ? 'flex-row' : 
           schema.layout === 'grid' ? 'grid grid-cols-2 gap-4' : 'flex-col';
  };

  const handleSaveChanges = async () => {
    const validationResult = validateForm(schema, formData);

    if (!validationResult.valid) {
      const fieldErrors = {};
      validationResult.errors.forEach(error => {
        schema.fields.forEach(field => {
          if (error.toLowerCase().includes(field.name.toLowerCase()) || 
              error.toLowerCase().includes(field.label.toLowerCase())) {
            fieldErrors[field.name] = fieldErrors[field.name] 
              ? `${fieldErrors[field.name]}\n${error}`
              : error;
          }
        });
      });
      setErrors(fieldErrors);
      return false;
    }

    setSubmitting(true);
    dispatch(setLoading({ id: response.id, loading: true }));

    try {
      const sanitizedData = sanitizeFormData(formData);

      // Persist to IndexedDB
      if (messageId && toolId) {
        await updateStructuredToolData(messageId, toolId, sanitizedData);
      }

      // Update cached data and reset unsaved changes flag
      setCachedFormData({ ...formData });
      setHasUnsavedChanges(false);
      
      // Call parent onChange to persist to message content
      if (onChange) {
        Object.keys(sanitizedData).forEach(key => {
          onChange(key, sanitizedData[key]);
        });
      }

      return true;

    } catch (error) {
      console.error('Error saving structured response:', error);
      setErrors({
        submit: error.message || 'Failed to save form'
      });
      return false;
    } finally {
      setSubmitting(false);
      dispatch(setLoading({ id: response.id, loading: false }));
    }
  };

  const handleSubmit = async () => {
    if (hasUnsavedChanges) {
      const saved = await handleSaveChanges();
      if (!saved) return;
    }
    
    const sanitizedData = sanitizeFormData(formData);

    const updatedResponse = {
      ...response,
      data: {
        ...response.data,
        values: sanitizedData
      }
    };

    if (onSubmit) {
      await onSubmit(updatedResponse);
    }

    dispatch(addToHistory({
      responseId: response.id,
      toolId: response.tool_id,
      timestamp: new Date().toISOString(),
      status: RESPONSE_STATUS.IN_PROGRESS
    }));
    
    // Exit edit mode after successful submission
    setIsEditMode(false);
  };
  
  const handleCancel = () => {
    dispatch(removeActiveResponse(response.id));
    
    if (onCancel) {
      onCancel();
    }
  };
  
  const handleEditClick = () => {
    setIsEditMode(true);
  };
  
  const handleCancelEdit = () => {
    // Revert to cached data
    if (cachedFormData) {
      setFormData({ ...cachedFormData });
    }
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    setErrors({});
  };

  const getProgressInfo = () => {
    if (!metadata || !metadata.step || !metadata.total_steps) {
      return null;
    }

    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        <span className="font-medium">Step {metadata.step} of {metadata.total_steps}</span>
        {metadata.step_title && (
          <span className="ml-2">- {metadata.step_title}</span>
        )}
      </div>
    );
  };

  return (
    <div className="structured-tool-response bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 my-2">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {schema.title && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {schema.title}
              {isLocked && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-xs rounded-full">
                  {isEditMode ? 'Editing' : 'Read-only'}
                </span>
              )}
              {hasUnsavedChanges && isEditMode && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs rounded-full">
                  Unsaved changes
                </span>
              )}
            </h3>
          )}
        </div>
        {isEditMode ? (
          <div className="flex gap-2">
            <button
              onClick={handleCancelEdit}
              disabled={submitting}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={submitting || !hasUnsavedChanges}
              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed dark:bg-green-600 dark:hover:bg-green-700 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={handleEditClick}
            disabled={submitting}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {schema.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {schema.description}
        </p>
      )}

      {response.message && response.status !== RESPONSE_STATUS.ERROR && (
        <div className="mb-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {response.message}
          </p>
        </div>
      )}

      {response.status === RESPONSE_STATUS.ERROR && (
        <div className="mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
          <p className="text-sm text-red-800 dark:text-red-200">
            {response.message || 'An error occurred'}
          </p>
        </div>
      )}

      <div className={`flex ${getLayoutClass()}`}>
        {Array.isArray(schema?.fields) ? schema.fields
          .filter(field => field != null && field.name != null)
          .map(field => (
            <div 
              key={field.name} 
              className={`${schema?.layout === 'grid' ? '' : schema?.layout === 'horizontal' ? 'flex-1 min-w-[200px]' : 'w-full'}`}
            >
              {renderField(field)}
            </div>
          )) : (
          <div className="text-gray-500">No fields available</div>
        )}
      </div>

      {errors.submit && (
        <div className="mt-4 px-3 py-2 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
          <p className="text-sm text-red-800 dark:text-red-200">
            {errors.submit}
          </p>
        </div>
      )}

      {hasUnsavedChanges && isEditMode && (
        <div className="mt-4 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You have unsaved changes. Click "Save" to persist them before submitting.
          </p>
        </div>
      )}

      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSubmit}
          disabled={submitting || response.status === RESPONSE_STATUS.ERROR || hasUnsavedChanges}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          title={hasUnsavedChanges ? "Please save your changes first" : ""}
        >
          {submitting ? 'Processing...' : (schema.submit_text || 'Submit')}
        </button>

        <button
          onClick={handleCancel}
          disabled={submitting}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
        >
          {schema.cancel_text || 'Cancel'}
        </button>

        {getProgressInfo()}
      </div>
    </div>
  );
}