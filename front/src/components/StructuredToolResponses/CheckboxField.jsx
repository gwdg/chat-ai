import React from 'react';

export default function CheckboxField({ field, value, onChange, error }) {
  const {
    name,
    label,
    description,
    required,
    disabled
  } = field;

  const handleChange = (e) => {
    onChange(name, e.target.checked);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          name={name}
          id={name}
          checked={value ? true : false}
          onChange={handleChange}
          disabled={disabled}
          className={`w-5 h-5 rounded border-gray-300 dark:border-gray-600
            text-blue-500 focus:ring-blue-500 focus:ring-2
            ${error ? 'border-red-500' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        
        {label && (
          <label 
            htmlFor={name}
            className={`text-sm font-medium cursor-pointer
              ${error ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
      </div>
      
      {description && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-8">
          {description}
        </p>
      )}
      
      {error && (
        <p className="text-xs text-red-500 ml-8">
          {error}
        </p>
      )}
    </div>
  );
}