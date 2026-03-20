import React, { useState } from 'react';

export default function ColorPickerField({ field, value, onChange, error }) {
  const {
    name,
    label,
    description,
    required,
    disabled
  } = field;

  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (e) => {
    onChange(name, e.target.value);
  };

  const presetColors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#008080', '#FFC0CB', '#A52A2A', '#808080', '#FFD700'
  ];

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className={`text-sm font-medium ${error ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            name={name}
            value={value || '#000000'}
            onChange={handleChange}
            disabled={disabled}
            className={`w-12 h-12 rounded cursor-pointer border-2
              ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          />
        </div>
        
        <input
          type="text"
          value={value || ''}
          onChange={handleChange}
          disabled={disabled}
          placeholder="#000000"
          pattern="^#[0-9A-Fa-f]{6}$"
          className={`flex-1 px-3 py-2 rounded-lg border text-sm font-mono uppercase
            ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500
            transition-colors
          `}
        />
      </div>
      
      <div className="grid grid-cols-5 gap-2">
        {presetColors.map((color, index) => (
          <button
            key={index}
            type="button"
            onClick={() => !disabled && onChange(name, color)}
            disabled={disabled}
            className={`w-full h-8 rounded border-2 transition-transform hover:scale-110
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${value?.toUpperCase() === color.toUpperCase() 
                ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800'
                : 'border-gray-300 dark:border-gray-600'
              }
            `}
            style={{ backgroundColor: color }}
            title={color}
          />
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