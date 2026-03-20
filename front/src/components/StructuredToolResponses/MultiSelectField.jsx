import React, { useState } from 'react';

export default function MultiSelectField({ field, value, onChange, error }) {
  const {
    name,
    label,
    description,
    options,
    required,
    disabled
  } = field;

  const selectedValues = Array.isArray(value) ? value : [];

  const handleToggle = (optionValue) => {
    const newValue = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue];
    
    onChange(name, newValue);
  };

  const handleSelectAll = () => {
    const allValues = Array.isArray(options) ? options.map(opt => opt.value) : [];
    onChange(name, allValues);
  };

  const handleClearAll = () => {
    onChange(name, []);
  };

  if (!Array.isArray(options) || options.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          No options available
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className={`text-sm font-medium ${error ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
            ({selectedValues.length} selected)
          </span>
        </label>
      )}
      
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={handleSelectAll}
          disabled={disabled}
          className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200 rounded transition-colors disabled:opacity-50"
        >
          Select All
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={disabled}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded transition-colors disabled:opacity-50"
        >
          Clear All
        </button>
      </div>
      
      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
        {options.map((option, index) => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <label
              key={`${name}-option-${index}`}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors
                ${isSelected 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                  : 'bg-gray-50 dark:bg-gray-800 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                border
              `}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => !disabled && handleToggle(option.value)}
                disabled={disabled}
                className="w-4 h-4 text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className={`text-sm ${isSelected ? 'font-medium' : 'font-normal'} text-gray-700 dark:text-gray-300`}>
                {option.label}
              </span>
            </label>
          );
        })}
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