import React, { useState } from 'react';

export default function NestedObjectField({ field, value, onChange, error }) {
  const {
    name,
    label,
    description,
    required,
    disabled,
    properties = {}
  } = field;

  const [expanded, setExpanded] = useState(properties.defaultExpanded ?? false);

  const handleChange = (subFieldName, subValue) => {
    const updatedValue = value ? { ...value } : {};
    updatedValue[subFieldName] = subValue;
    onChange(name, updatedValue);
  };

  if (!properties.schema || !Array.isArray(properties.schema)) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Nested object requires a schema property
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        disabled={disabled}
        className={`w-full px-4 py-3 flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
          transition-colors
        `}
      >
        <div className="flex items-center gap-2">
          <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {label || name}
          </span>
          {required && <span className="text-red-500">*</span>}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {Object.keys(value || {}).length} fields
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-3 bg-gray-50 dark:bg-gray-900/20">
          {properties.schema.map((subField, idx) => {
            const subFieldValue = value?.[subField.name];
            return (
              <div key={`${name}-${subField.name}-${idx}`} className="pl-4 border-l-2 border-gray-300 dark:border-gray-600">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {subField.label || subField.name}
                  {subField.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                
                {subField.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {subField.description}
                  </p>
                )}

                <input
                  type={subField.type === 'number' ? 'number' : 'text'}
                  value={subFieldValue !== undefined ? subFieldValue : subField.default || ''}
                  onChange={(e) => {
                    const newValue = subField.type === 'number' 
                      ? parseFloat(e.target.value) 
                      : e.target.value;
                    handleChange(subField.name, newValue);
                  }}
                  disabled={disabled || subField.disabled}
                  placeholder={subField.placeholder}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                    focus:outline-none focus:ring-1 focus:ring-blue-500
                  "
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}