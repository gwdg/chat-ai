import { FIELD_TYPES, RESPONSE_STATUS, RESPONSE_VERSION } from '../constants/structuredToolResponses';

export class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

export function validateStructuredResponse(response) {
  const errors = [];

  if (!response || typeof response !== 'object') {
    errors.push('Response must be an object');
    return { valid: false, errors };
  }

  if (response.type !== 'structured_tool_response') {
    errors.push('Invalid response type');
  }

  if (response.version !== RESPONSE_VERSION) {
    errors.push('Unsupported response version');
  }

  if (!response.tool_id || typeof response.tool_id !== 'string') {
    errors.push('Invalid or missing tool_id');
  }

  if (!Object.values(RESPONSE_STATUS).includes(response.status)) {
    errors.push('Invalid status value');
  }

  if (response.status !== 'error' && !response.data) {
    errors.push('Missing data object');
  }

  if (response.data && response.data.schema && !validateSchema(response.data.schema)) {
    errors.push('Invalid schema');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateSchema(schema) {
  if (!schema || typeof schema !== 'object') return false;

  if (!Array.isArray(schema.fields)) return false;

  return schema.fields.every(field => validateField(field));
}

export function validateField(field) {
  if (!field || typeof field !== 'object') return false;

  if (!field.name || typeof field.name !== 'string') return false;

  if (!Object.values(FIELD_TYPES).includes(field.type)) return false;

  if (!field.label || typeof field.label !== 'string') return false;

  return true;
}

export function validateFieldValue(field, value) {
  const errors = [];

  if (field.required && (value === undefined || value === null || value === '')) {
    errors.push(`${field.label} is required`);
    return { valid: false, errors };
  }

  if (value === undefined || value === null || value === '') {
    return { valid: true, errors: [] };
  }

  switch (field.type) {
    case FIELD_TYPES.TEXT:
      return validateTextField(field, value);

    case FIELD_TYPES.NUMBER:
      return validateNumberField(field, value);

    case FIELD_TYPES.SELECT:
    case FIELD_TYPES.RADIO:
      return validateOptionField(field, value);

    case FIELD_TYPES.CHECKBOX:
      return validateBooleanField(field, value);

    case FIELD_TYPES.TEXTAREA:
      return validateTextField(field, value);

    case FIELD_TYPES.SLIDER:
      return validateNumberField(field, value);

    case FIELD_TYPES.MULTISELECT:
      return validateMultiSelectField(field, value);

    case FIELD_TYPES.DATE:
      return validateDateField(field, value);

    default:
      return { valid: true, errors: [] };
  }
}

function validateTextField(field, value) {
  const errors = [];

  if (typeof value !== 'string') {
    errors.push(`${field.label} must be a string`);
    return { valid: false, errors };
  }

  const { constraints = {} } = field;

  if (constraints.minLength && value.length < constraints.minLength) {
    errors.push(`${field.label} must be at least ${constraints.minLength} characters`);
  }

  if (constraints.maxLength && value.length > constraints.maxLength) {
    errors.push(`${field.label} must be at most ${constraints.maxLength} characters`);
  }

  if (constraints.pattern) {
    try {
      const regex = new RegExp(constraints.pattern);
      if (!regex.test(value)) {
        errors.push(`${field.label} does not match the required format`);
      }
    } catch (e) {
      console.error('Invalid regex pattern:', constraints.pattern);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateNumberField(field, value) {
  const errors = [];

  const numValue = Number(value);

  if (isNaN(numValue)) {
    errors.push(`${field.label} must be a valid number`);
    return { valid: false, errors };
  }

  const { constraints = {} } = field;

  if (constraints.min !== undefined && numValue < constraints.min) {
    errors.push(`${field.label} must be at least ${constraints.min}`);
  }

  if (constraints.max !== undefined && numValue > constraints.max) {
    errors.push(`${field.label} must be at most ${constraints.max}`);
  }

  if (constraints.step !== undefined) {
    const step = constraints.step;
    const steps = numValue / step;
    if (!Number.isInteger(steps)) {
      errors.push(`${field.label} must be a multiple of ${step}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateOptionField(field, value) {
  const errors = [];

  if (!Array.isArray(field.options) || field.options.length === 0) {
    return { valid: true, errors };
  }

  const validValues = field.options.map(opt => opt.value);

  if (!validValues.includes(value)) {
    errors.push(`${field.label} has an invalid value`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateBooleanField(field, value) {
  const errors = [];

  if (typeof value !== 'boolean') {
    errors.push(`${field.label} must be a boolean`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateMultiSelectField(field, value) {
  const errors = [];

  if (!Array.isArray(value)) {
    errors.push(`${field.label} must be an array`);
    return { valid: false, errors };
  }

  if (!Array.isArray(field.options) || field.options.length === 0) {
    return { valid: true, errors };
  }

  const validValues = field.options.map(opt => opt.value);

  for (const val of value) {
    if (!validValues.includes(val)) {
      errors.push(`Invalid value in ${field.label}`);
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateDateField(field, value) {
  const errors = [];

  if (!(value instanceof Date) && typeof value !== 'string') {
    errors.push(`${field.label} must be a valid date`);
    return { valid: false, errors };
  }

  const date = value instanceof Date ? value : new Date(value);

  if (isNaN(date.getTime())) {
    errors.push(`${field.label} must be a valid date`);
    return { valid: false, errors };
  }

  const { constraints = {} } = field;

  if (constraints.min) {
    const minDate = new Date(constraints.min);
    if (date < minDate) {
      errors.push(`${field.label} must be after ${constraints.min}`);
    }
  }

  if (constraints.max) {
    const maxDate = new Date(constraints.max);
    if (date > maxDate) {
      errors.push(`${field.label} must be before ${constraints.max}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateForm(schema, formData) {
  const errors = [];

  if (!schema || !Array.isArray(schema.fields)) {
    return { valid: false, errors: ['Invalid schema'] };
  }

  for (const field of schema.fields) {
    const value = formData[field.name];

    try {
      const result = validateFieldValue(field, value);

      if (!result.valid) {
        errors.push(...result.errors);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error.message);
      } else {
        console.error('Validation error for field', field.name, error);
        errors.push(`Error validating ${field.label}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function sanitizeFormData(formData) {
  const sanitized = {};

  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? item.trim() : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function getDefaultValue(field) {
  if (field.default !== undefined) {
    return field.default;
  }

  switch (field.type) {
    case FIELD_TYPES.TEXT:
    case FIELD_TYPES.TEXTAREA:
      return '';

    case FIELD_TYPES.NUMBER:
    case FIELD_TYPES.SLIDER:
      return field.constraints?.min ?? 0;

    case FIELD_TYPES.SELECT:
    case FIELD_TYPES.RADIO:
      return field.options?.[0]?.value ?? '';

    case FIELD_TYPES.CHECKBOX:
      return false;

    case FIELD_TYPES.MULTISELECT:
      return [];

    case FIELD_TYPES.DATE:
      return new Date().toISOString().split('T')[0];

    default:
      return '';
  }
}

export function initializeFormValues(schema) {
  const values = {};

  if (!schema || !Array.isArray(schema.fields)) {
    return values;
  }

  for (const field of schema.fields) {
    values[field.name] = getDefaultValue(field);
  }

  return values;
}