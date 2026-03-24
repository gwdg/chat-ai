import React from 'react';

export default function RadioField({ field, value, onChange, error }) {
  const {
    name,
    label,
    description,
    options,
    required,
    disabled,
    layout = 'vertical'
  } = field;

  const handleChange = (selectedValue) => {
    onChange(name, selectedValue);
  };

  const isVertical = layout === 'vertical';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className={`text-sm font-medium ${error ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className={`flex ${isVertical ? 'flex-col' : 'flex-row flex-wrap'} gap-3`}>
        {Array.isArray(options) && options.map((option, index) => (
          <label
            key={`${name}-option-${index}`}
            className={`flex items-center gap-2 cursor-pointer
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${isVertical ? 'flex-row' : 'flex-row'}
            `}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => handleChange(option.value)}
              disabled={disabled}
              className={`w-4 h-4 text-blue-500 border-gray-300 dark:border-gray-600
                focus:ring-blue-500 focus:ring-2
                ${error ? 'border-red-500' : ''}
              `}
            />
            <span className={`text-sm ${error ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
              {option.label}
            </span>
          </label>
        ))}
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