import React, { useState } from 'react';
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
import { validateForm, sanitizeFormData } from '../../utils/structuredToolValidation';
import { updateFormData, removeActiveResponse, addToHistory, setLoading } from '../../Redux/reducers/structuredToolResponsesSlice';
import { FIELD_TYPES, RESPONSE_STATUS } from '../../constants/structuredToolResponses';

export default function StructuredToolResponse({ response, onSubmit, onCancel }) {
  const dispatch = useDispatch();
  const { schema, values: initialValues, metadata } = response.data;
  const [formData, setFormData] = useState(initialValues || {});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleFieldChange = (fieldName, value) => {
    const newFormData = {
      ...formData,
      [fieldName]: value
    };
    setFormData(newFormData);

    dispatch(updateFormData({
      id: response.id,
      field: fieldName,
      value
    }));

    if (errors[fieldName]) {
      const newErrors = { ...errors };
      delete newErrors[fieldName];
      setErrors(newErrors);
    }
  };

  const renderField = (field) => {
    const error = errors[field.name];
    const fieldType = field.type?.toLowerCase() || field.componentType || 'text';

    switch (fieldType) {
      case FIELD_TYPES.TEXT:
      case 'text':
        return (
          <TextField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.NUMBER:
      case 'number':
        return (
          <NumberField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.SELECT:
      case 'select':
        return (
          <SelectField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.RADIO:
      case 'radio':
        return (
          <RadioField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.TEXTAREA:
      case 'textarea':
        return (
          <TextareaField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.CHECKBOX:
      case 'checkbox':
        return (
          <CheckboxField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.SLIDER:
      case 'slider':
      case 'range':
        return (
          <RangeSliderField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.DATE:
      case 'date':
        return (
          <DateField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case FIELD_TYPES.MULTISELECT:
      case 'multiselect':
        return (
          <MultiSelectField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case 'color':
      case 'colorpicker':
        return (
          <ColorPickerField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case 'dynamic':
      case 'custom':
        return (
          <DynamicField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case 'nested':
      case 'object':
        return (
          <NestedObjectField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      case 'array':
      case 'list':
        return (
          <ArrayField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );

      default:
        console.warn(`Unsupported field type: ${field.type}, trying dynamic rendering`);
        return (
          <DynamicField
            field={field}
            value={formData[field.name]}
            onChange={handleFieldChange}
            error={error}
          />
        );
    }
  };

  const handleSubmit = async () => {
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
      return;
    }

    setSubmitting(true);
    dispatch(setLoading({ id: response.id, loading: true }));

    try {
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

    } catch (error) {
      console.error('Error submitting structured response:', error);
      setErrors({
        submit: error.message || 'Failed to submit form'
      });
    } finally {
      setSubmitting(false);
      dispatch(setLoading({ id: response.id, loading: false }));
    }
  };

  const handleCancel = () => {
    dispatch(removeActiveResponse(response.id));
    
    if (onCancel) {
      onCancel();
    }
  };

  const getLayoutClass = () => {
    switch (schema.layout) {
      case 'horizontal':
        return 'flex-row flex-wrap gap-4';
      case 'grid':
        return 'grid grid-cols-1 md:grid-cols-2 gap-4';
      case 'vertical':
      default:
        return 'flex-col gap-4';
    }
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
      {schema.title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {schema.title}
        </h3>
      )}

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
        {Array.isArray(schema.fields) && schema.fields.map(field => (
          <div 
            key={field.name} 
            className={`${schema.layout === 'grid' ? '' : schema.layout === 'horizontal' ? 'flex-1 min-w-[200px]' : 'w-full'}`}
          >
            {renderField(field)}
          </div>
        ))}
      </div>

      {errors.submit && (
        <div className="mt-4 px-3 py-2 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
          <p className="text-sm text-red-800 dark:text-red-200">
            {errors.submit}
          </p>
        </div>
      )}

      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSubmit}
          disabled={submitting || response.status === RESPONSE_STATUS.ERROR}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
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