import React from 'react';

export default function DateField({ field, value, onChange, error }) {
  const {
    name,
    label,
    description,
    required,
    disabled,
    constraints
  } = field;

  const handleChange = (e) => {
    onChange(name, e.target.value);
  };

  const min = constraints?.min;
  const max = constraints?.max;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className={`text-sm font-medium ${error ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <input
        type="date"
        name={name}
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        min={min}
        max={max}
        className={`px-3 py-2 rounded-lg border text-sm
          ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-white
          focus:outline-none focus:ring-2 focus:ring-blue-500
          transition-colors
        `}
      />
      
      {description && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      
      {error && (
        <p className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}