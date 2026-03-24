import React, { useState } from 'react';

export default function DynamicField({ field, value, onChange, error }) {
  const {
    name,
    label,
    description,
    placeholder,
    required,
    disabled,
    componentType = 'text',
    properties = {}
  } = field;

  const [errors, setErrors] = useState([]);

  const handleChange = (subField, newValue) => {
    const updatedValue = value ? { ...value } : {};
    updatedValue[subField] = newValue;
    onChange(name, updatedValue);
  };

  const validateData = (data) => {
    const newErrors = [];
    
    if (properties.required && !data) {
      newErrors.push(`${label} is required`);
      return newErrors;
    }

    if (properties.schema) {
      for (const subFieldDef of properties.schema) {
        if (subFieldDef.required && !data?.[subFieldDef.name]) {
          newErrors.push(`${subFieldDef.label} is required`);
        }
      }
    }

    return newErrors;
  };

  const renderComponent = () => {
    switch (componentType) {
      case 'card':
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            {properties.schema && properties.schema.map((subField, idx) => (
              <div key={idx} className="mb-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {subField.label}
                  {subField.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type="text"
                  placeholder={subField.placeholder}
                  value={value?.[subField.name] || ''}
                  onChange={(e) => handleChange(subField.name, e.target.value)}
                  disabled={disabled}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                    focus:outline-none focus:ring-1 focus:ring-blue-500
                  "
                />
                {description && (
                  <p className="text-xs text-gray-500 mt-1">{subField.description}</p>
                )}
              </div>
            ))}
          </div>
        );

      case 'badge':
        return (
          <div className="flex flex-wrap gap-2">
            {properties.items?.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => !disabled && onChange(name, item.value)}
                disabled={disabled}
                className={`px-3 py-1 text-sm rounded-full transition-colors
                  ${value === item.value
                    ? `bg-${item.color || 'blue'}-500 text-white`
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {item.label}
              </button>
            ))}
          </div>
        );

      case 'timeline':
        return (
          <div className="space-y-3">
            {properties.events?.map((event, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{event.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{event.date}</p>
                </div>
              </div>
            ))}
          </div>
        );

      case 'rating':
        return (
          <div className="flex items-center gap-1">
            {[...Array(properties.maxStars || 5)].map((_, idx) => {
              const starValue = idx + 1;
              const isFilled = (value || 0) >= starValue;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => !disabled && onChange(name, starValue)}
                  disabled={disabled}
                  className={`text-2xl transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isFilled ? '⭐' : '☆'}
                </button>
              );
            })}
          </div>
        );

      case 'toggle':
        return (
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => !disabled && onChange(name, !value)}
              disabled={disabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${value ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
        );

      case 'list':
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded divide-y divide-gray-200 dark:divide-gray-700">
            {properties.items?.map((item, idx) => (
              <div key={idx} className="px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className="text-sm text-gray-900 dark:text-white">{item.label}</span>
                <input
                  type="checkbox"
                  checked={value?.includes(item.value) || false}
                  onChange={(e) => {
                    const current = value || [];
                    if (e.target.checked) {
                      handleChange('items', [...current, item.value]);
                    } else {
                      handleChange('items', current.filter(v => v !== item.value));
                    }
                  }}
                  disabled={disabled}
                  className="w-4 h-4 text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        );

      case 'keyvalue':
        return (
          <div className="space-y-2">
            {Object.entries(value || {}).map(([key, val], idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={key}
                  disabled
                  className="w-1/3 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  value={val}
                  onChange={(e) => {
                    const updated = { ...value, [key]: e.target.value };
                    onChange(name, updated);
                  }}
                  disabled={disabled}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...value };
                    delete updated[key];
                    onChange(name, updated);
                  }}
                  disabled={disabled}
                  className="px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const newKey = `key_${Object.keys(value || {}).length + 1}`;
                handleChange('items', { ...value, [newKey]: '' });
              }}
              disabled={disabled}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              + Add Pair
            </button>
          </div>
        );

      default:
        return (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Unknown component type: {componentType}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className={`text-sm font-medium ${error ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {renderComponent()}
      
      {description && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      
      {error && Array.isArray(error) ? (
        error.map((err, idx) => (
          <p key={idx} className="text-xs text-red-500">
            • {err}
          </p>
        ))
      ) : error ? (
        <p className="text-xs text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}