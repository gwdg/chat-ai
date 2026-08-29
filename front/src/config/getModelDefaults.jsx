import { useState, useCallback, useEffect } from 'react';
// import { getDefaultSettings } from '../utils/conversationUtils';


// Use Vite's import.meta.glob
const modelFiles = import.meta.glob('../config/models/*.json', { eager: true });

// Build the modelConfigs object dynamically
const buildModelConfigs = () => {
  const configs = {};
  
  // Vite approach
  Object.entries(modelFiles).forEach(([path, module]) => {
    const filename = path.split('/').pop().replace('.json', '');
    configs[filename] = module.default || module;
  }); 
  
  return configs;
};

const modelConfigs = buildModelConfigs();

export default function getModelDefaults (model) {
    return modelConfigs[model]
};