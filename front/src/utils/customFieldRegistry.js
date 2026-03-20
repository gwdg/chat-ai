import React from 'react';

let customFieldRegistry = {};

export function registerCustomField(type, component) {
  if (customFieldRegistry[type]) {
    console.warn(`Field type "${type}" is already registered. It will be overwritten.`);
  }
  
  customFieldRegistry[type] = component;
}

export function unregisterCustomField(type) {
  delete customFieldRegistry[type];
}

export function getCustomField(type) {
  return customFieldRegistry[type];
}

export function getAllRegisteredFields() {
  return { ...customFieldRegistry };
}

export function clearCustomFields() {
  customFieldRegistry = {};
}

export function hasCustomField(type) {
  return type in customFieldRegistry;
}