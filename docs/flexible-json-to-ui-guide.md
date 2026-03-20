# Flexible JSON-to-UI Generation - Complete Guide

## Overview

The Structured Tool Responses feature now supports **comprehensive JSON-to-UI generation**, enabling tools to create any type of interactive form from simple to complex nested structures.

## Capabilities

### Fully Supported Field Types

| Type | Component | Use Case |
|------|-----------|----------|
| `text` | TextField | Single-line text input |
| `number` | NumberField | Numeric input with constraints |
| `select` | SelectField | Dropdown selection |
| `radio` | RadioField | Radio button group |
| `checkbox` | CheckboxField | Boolean toggle |
| `textarea` | TextareaField | Multi-line text input |
| `slider` / `range` | RangeSliderField | Range slider |
| `multiselect` | MultiSelectField | Multiple selection |
| `date` | DateField | Date picker |
| `color` / `colorpicker` | ColorPickerField | Color selection |
| `nested` / `object` | NestedObjectField | Nested object structures |
| `array` / `list` | ArrayField | Dynamic lists |
| `dynamic` / `custom` | DynamicField | Custom component types |

### Dynamic Components

The `DynamicField` component supports multiple UI patterns:

#### Badge Selection
```json
{
  "type": "dynamic",
  "name": "priority",
  "componentType": "badge",
  "properties": {
    "items": [
      { "value": "low", "label": "Low", "color": "green" },
      { "value": "medium", "label": "Medium", "color": "yellow" },
      { "value": "high", "label": "High", "color": "red" }
    ]
  }
}
```

#### Toggle Switch
```json
{
  "type": "dynamic",
  "name": "enabled",
  "componentType": "toggle"
}
```

#### Star Rating
```json
{
  "type": "dynamic",
  "name": "rating",
  "componentType": "rating",
  "properties": {
    "maxStars": 5
  }
}
```

#### Card with Schema
```json
{
  "type": "dynamic",
  "name": "profile",
  "componentType": "card",
  "properties": {
    "schema": [
      { "name": "name", "label": "Name", "required": true },
      { "name": "email", "label": "Email" }
    ]
  }
}
```

#### Timeline
```json
{
  "type": "dynamic",
  "name": "history",
  "componentType": "timeline",
  "properties": {
    "events": [
      { "title": "Step 1", "date": "2024-01-01" },
      { "title": "Step 2", "date": "2024-01-15" }
    ]
  }
}
```

#### List
```json
{
  "type": "dynamic",
  "name": "tasks",
  "componentType": "list",
  "properties": {
    "items": [
      { "value": "task1", "label": "Complete documentation" },
      { "value": "task2", "label": "Test implementation" }
    ]
  }
}
```

#### Key-Value Pairs
```json
{
  "type": "dynamic",
  "name": "config",
  "componentType": "keyvalue"
}
```

## Advanced Features

### Nested Objects

Create nested data structures with collapsible sections:

```json
{
  "type": "nested",
  "name": "address",
  "label": "Address Information",
  "properties": {
    "defaultExpanded": true,
    "schema": [
      {
        "type": "text",
        "name": "street",
        "label": "Street Address",
        "required": true
      },
      {
        "type": "text",
        "name": "city",
        "label": "City",
        "required": true
      },
      {
        "type": "text",
        "name": "zip",
        "label": "ZIP Code"
      }
    ]
  }
}
```

### Arrays

Dynamic lists with add/remove functionality:

#### Simple Array (String)
```json
{
  "type": "array",
  "name": "tags",
  "label": "Tags",
  "properties": {
    "placeholder": "Enter tag"
  }
}
```

#### Object Array (Structured)
```json
{
  "type": "array",
  "name": "phone_numbers",
  "label": "Phone Numbers",
  "properties": {
    "itemSchema": [
      {
        "type": "text",
        "name": "type",
        "label": "Type"
      },
      {
        "type": "text",
        "name": "number",
        "label": "Number",
        "required": true
      }
    ]
  }
}
```

### Field Constraints

All field types support constraints for validation:

```json
{
  "type": "text",
  "name": "username",
  "constraints": {
    "minLength": 3,
    "maxLength": 20,
    "pattern": "^[a-zA-Z0-9_]+$"
  }
}
```

```json
{
  "type": "number",
  "name": "age",
  "constraints": {
    "min": 0,
    "max": 120,
    "step": 1
  }
}
```

```json
{
  "type": "date",
  "name": "birth_date",
  "constraints": {
    "min": "1900-01-01",
    "max": "2024-12-31"
  }
}
```

## Complete Example: Complex Form

```json
{
  "type": "structured_tool_response",
  "version": "1.0",
  "tool_id": "user_profile",
  "status": "in_progress",
  "data": {
    "schema": {
      "title": "User Profile Configuration",
      "fields": [
        {
          "type": "text",
          "name": "name",
          "label": "Full Name",
          "required": true
        },
        {
          "type": "email",
          "name": "email",
          "label": "Email Address",
          "required": true
        },
        {
          "type": "nested",
          "name": "preferences",
          "label": "Preferences",
          "properties": {
            "schema": [
              {
                "type": "checkbox",
                "name": "newsletter",
                "label": "Subscribe to newsletter"
              },
              {
                "type": "select",
                "name": "language",
                "label": "Language",
                "options": [
                  { "value": "en", "label": "English" },
                  { "value": "de", "label": "German" }
                ]
              },
              {
                "type": "color",
                "name": "theme_color",
                "label": "Theme Color"
              }
            ]
          }
        },
        {
          "type": "array",
          "name": "skills",
          "label": "Skills",
          "properties": {
            "itemSchema": [
              {
                "type": "text",
                "name": "name",
                "label": "Skill Name",
                "required": true
              },
              {
                "type": "slider",
                "name": "level",
                "label": "Proficiency Level",
                "constraints": { "min": 1, "max": 10, "step": 1 }
              }
            ]
          }
        },
        {
          "type": "dynamic",
          "name": "status",
          "label": "Account Status",
          "componentType": "badge",
          "properties": {
            "items": [
              { "value": "active", "label": "Active", "color": "green" },
              { "value": "inactive", "label": "Inactive", "color": "gray" },
              { "value": "suspended", "label": "Suspended", "color": "red" }
            ]
          }
        }
      ],
      "submit_text": "Save Profile",
      "layout": "vertical"
    }
  }
}
```

## Custom Field Registration

Register custom field components for specialized UI needs:

```javascript
import { registerCustomField } from './utils/customFieldRegistry';

// Custom component
const CustomMapPicker = ({ field, value, onChange }) => {
  return (
    <div className="custom-map-picker">
      <button onClick={() => onChange(field.name, { lat: 52.5200, lng: 13.4050 })}>
        Pick Location
      </button>
      <span>Selected: {value?.lat}, {value?.lng}</span>
    </div>
  );
};

// Register the component
registerCustomField('map_picker', CustomMapPicker);

// Use it in schema
{
  "type": "map_picker",
  "name": "location",
  "label": "Pick Location"
}
```

## Layout Options

Control form layout at the schema level:

```json
{
  "layout": "vertical"
}
```

Options:
- `vertical` - Stacked fields (default)
- `horizontal` - Fields in a row
- `grid` - Two-column grid

## Testing and Examples

Access the test tool at `http://localhost:8080/test-structured-responses`

Available examples:
1. ** Flexible Form Generator** - Demonstrates all field types
2. ** Customer Feedback Survey** - Practical survey form
3. ** Task Management** - Task creation with subtasks
4. ** Complex Configuration** - Nested structures and arrays

## Best Practices

### 1. Field Naming
- Use descriptive names (`full_name` not `nm`)
- Use snake_case for consistency
- Avoid special characters

### 2. Labeling
- Provide clear, concise labels
- Use description fields for help text
- Mark required fields explicitly

### 3. Validation
- Set appropriate constraints
- Provide helpful error messages
- Use regex patterns for text fields

### 4. UX Considerations
- Group related fields with nested objects
- Use appropriate field types
- Consider default values where helpful
- Provide clear submit/cancel labels

### 5. Performance
- Avoid overly deep nesting
- Limit array sizes initially
- Use lazy loading for large forms

## Common Patterns

### Address Form
```json
{
  "type": "nested",
  "name": "address",
  "label": "Address",
  "properties": {
    "schema": [
      { "type": "text", "name": "street", "label": "Street", "required": true },
      { "type": "text", "name": "city", "label": "City", "required": true },
      { "type": "text", "name": "zip", "label": "ZIP", "required": true },
      { "type": "select", "name": "country", "label": "Country", "options": [...] }
    ]
  }
}
```

### Tag/Input System
```json
{
  "type": "array",
  "name": "tags",
  "label": "Tags",
  "properties": {
    "placeholder": "Add a tag..."
  }
}
```

### Rating System
```json
{
  "type": "dynamic",
  "name": "rating",
  "label": "Rate Us",
  "componentType": "rating",
  "properties": { "maxStars": 5 }
}
```

### Configuration Panel
```json
{
  "type": "nested",
  "name": "settings",
  "label": "Settings",
  "properties": {
    "schema": [
      { "type": "checkbox", "name": "enabled", "label": "Enable Feature" },
      { "type": "slider", "name": "timeout", "label": "Timeout (s)", "constraints": { "min": 1, "max": 60 } },
      { "type": "textarea", "name": "notes", "label": "Notes" }
    ]
  }
}
```

## Troubleshooting

### Form Not Rendering
- Check JSON syntax with validator
- Ensure all required properties are present
- Verify field types are supported

### Validation Issues
- Review constraint values
- Check field requirements
- Ensure data types match

### Nested Structure Problems
- Verify schema property format
- Check nested field names
- Ensure proper data structure

### Component Errors
- Check browser console
- Verify component registration
- Test with simpler schemas first

## Migration from Phase 1

Existing schemas (Phase 1) work without changes:
- `text`, `number`, `select`, `radio` remain supported
- New types can be added incrementally
- Backward compatible

## API Integration

To use in tool responses:

```javascript
async function myTool(params) {
  if (!params.userChoices) {
    return {
      type: 'structured_tool_response',
      version: '1.0',
      tool_id: 'my_tool',
      status: 'in_progress',
      data: {
        schema: { /* your schema */ },
        values: {}
      }
    };
  }
  
  return {
    type: 'structured_tool_response',
    version: '1.0',
    tool_id: 'my_tool',
    status: 'complete',
    data: {
      result: processData(params.userChoices)
    }
  };
}
```

## Future Enhancements

Potential future additions:
- Conditional field visibility
- Dynamic field updates
- Form presets/templates
- Advanced validation rules
- Form state persistence
- Undo/Redo support

## Support

- View examples: `utils/flexibleFormExamples.js`
- Test tool: `/test-structured-responses`
- Documentation: `docs/flexible-json-to-ui-guide.md`