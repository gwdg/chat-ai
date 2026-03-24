import React from 'react';

export default function RangeSliderField({ field, value, onChange, error }) {
  const {
    name,
    label,
    description,
    required,
    disabled,
    constraints
  } = field;

  const handleChange = (e) => {
    onChange(name, parseFloat(e.target.value));
  };

  const min = constraints?.min ?? 0;
  const max = constraints?.max ?? 100;
  const step = constraints?.step ?? 1;
  const displayValue = value !== undefined ? value : min;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className={`text-sm font-medium ${error ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="flex items-center gap-4">
        <input
          type="range"
          name={name}
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={`flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${error ? 'accent-red-500' : 'accent-blue-500'}
          `}
        />
        
        <div className="min-w-[3rem] px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-center">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {displayValue}
          </span>
        </div>
      </div>
      
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