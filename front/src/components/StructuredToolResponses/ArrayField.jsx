import React, { useState } from 'react';

export default function ArrayField({ field, value, onChange, error }) {
  const {
    name,
    label,
    description,
    required,
    disabled,
    properties = {}
  } = field;

  const items = Array.isArray(value) ? value : [];
  const [expanded, setExpanded] = useState(properties.defaultExpanded ?? true);

  const handleChange = (index, itemValue) => {
    const updatedItems = [...items];
    updatedItems[index] = itemValue;
    onChange(name, updatedItems);
  };

  const handleAddItem = () => {
    const newItem = typeof items[0] === 'object' ? {} : properties.itemDefault || '';
    onChange(name, [...items, newItem]);
  };

  const handleRemoveItem = (index) => {
    const updatedItems = items.filter((_, idx) => idx !== index);
    onChange(name, updatedItems);
  };

  const handleReorder = (fromIndex, toIndex) => {
    const updatedItems = [...items];
    const [removed] = updatedItems.splice(fromIndex, 1);
    updatedItems.splice(toIndex, 0, removed);
    onChange(name, updatedItems);
  };

  if (properties.itemSchema && Array.isArray(properties.itemSchema)) {
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
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </button>

        {expanded && (
          <div className="px-4 pb-4 pt-2 space-y-3 bg-gray-50 dark:bg-gray-900/20">
            {items.length === 0 && (
              <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                No items added
              </div>
            )}

            {items.map((item, idx) => (
              <div key={`${name}-${idx}`} className="border border-gray-200 dark:border-gray-700 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Item {idx + 1}
                  </span>
                  <div className="flex gap-1">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleReorder(idx, idx - 1)}
                        disabled={disabled}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        ↑
                      </button>
                    )}
                    {idx < items.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleReorder(idx, idx + 1)}
                        disabled={disabled}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        ↓
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={disabled}
                      className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {properties.itemSchema.map((subField, subIdx) => (
                    <div key={subIdx}>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {subField.label || subField.name}
                      </label>
                      <input
                        type={subField.type === 'number' ? 'number' : 'text'}
                        value={item?.[subField.name] || ''}
                        onChange={(e) => {
                          const updatedItem = { ...item };
                          updatedItem[subField.name] = subField.type === 'number'
                            ? parseFloat(e.target.value)
                            : e.target.value;
                          handleChange(idx, updatedItem);
                        }}
                        disabled={disabled}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded
                          bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                        "
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddItem}
              disabled={disabled}
              className="w-full px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded transition-colors disabled:opacity-50"
            >
              + Add Item
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {label && (
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => {
                const updatedItems = [...items];
                updatedItems[idx] = e.target.value;
                onChange(name, updatedItems);
              }}
              disabled={disabled}
              placeholder={`${properties.placeholder || 'Item'} ${idx + 1}`}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white
              "
            />
            <button
              type="button"
              onClick={() => handleRemoveItem(idx)}
              disabled={disabled}
              className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            >
              ✕
            </button>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            No items added
          </div>
        )}

        <button
          type="button"
          onClick={handleAddItem}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded transition-colors disabled:opacity-50"
        >
          + Add Item
        </button>
      </div>

      {description && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {description}
        </p>
      )}
    </div>
  );
}