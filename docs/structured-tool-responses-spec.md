# Structured Tool Responses Specification

## Overview
Structured Tool Responses enable AI tools to return JSON schemas that are dynamically rendered as interactive UI components (radio buttons, dropdowns, checkboxes, text inputs, etc.) in the Chat AI interface. Users can modify these inputs and submit them back through the LLM to continue the tool execution.

## Objectives
- Enable tools to generate dynamic forms based on AI reasoning
- Provide flexible UI components for various input types
- Maintain existing tool architecture while adding response rendering
- Support bidirectional communication: tool → UI → user → tool
- Enable progressive refinement of tool parameters through user interaction

## Data Flow

```
1. User Message → LLM
2. LLM calls Tool with parameters
3. Tool returns Structured Response (JSON + UI Schema)
4. UI renders interactive form based on schema
5. User modifies inputs in form
6. User submits form → LLM with updated parameters
7. LLM re-calls Tool with refined parameters
8. Repeat until completion or user cancel
```

## Response Schema

### Base Structure

```json
{
  "type": "structured_tool_response",
  "version": "1.0",
  "tool_id": "string",
  "status": "in_progress" | "complete" | "error",
  "message": "string (optional explanation)",
  "data": {
    "schema": { /* UI Schema */ },
    "values": { /* Current values */ },
    "metadata": { /* Tool-specific metadata */ }
  }
}
```

### UI Schema Definition

```json
{
  "title": "Form Title",
  "description": "Form description/instructions",
  "fields": [
    {
      "name": "field_name",
      "type": "text" | "number" | "select" | "radio" | "checkbox" | "textarea" | "slider" | "date" | "multiselect",
      "label": "Human readable label",
      "description": "Field description/help text",
      "required": false,
      "default": "default value",
      "options": [ /* For select/radio/checkbox/multiselect */ ],
      "constraints": {
        "min": 0,
        "max": 100,
        "step": 1,
        "pattern": "^regex$",
        "minLength": 1,
        "maxLength": 500
      },
      "validation": {
        "message": "Custom validation message"
      }
    }
  ],
  "submit_text": "Continue" | "Update" | "Proceed",
  "cancel_text": "Cancel",
  "layout": "vertical" | "horizontal" | "grid"
}
```

## Field Types

### text
Single-line text input
```json
{
  "type": "text",
  "name": "username",
  "label": "Username",
  "constraints": {
    "minLength": 3,
    "maxLength": 20,
    "pattern": "^[a-zA-Z0-9_]+$"
  }
}
```

### number
Numeric input with min/max/step
```json
{
  "type": "number",
  "name": "temperature",
  "label": "Temperature",
  "description": "Controls response randomness (0-2)",
  "constraints": {
    "min": 0,
    "max": 2,
    "step": 0.1
  },
  "default": 0.7
}
```

### select
Dropdown selection
```json
{
  "type": "select",
  "name": "model",
  "label": "Select Model",
  "options": [
    { "value": "gpt-4", "label": "GPT-4" },
    { "value": "gpt-3.5-turbo", "label": "GPT-3.5 Turbo" }
  ]
}
```

### radio
Radio button group (single selection)
```json
{
  "type": "radio",
  "name": "format",
  "label": "Output Format",
  "options": [
    { "value": "json", "label": "JSON" },
    { "value": "xml", "label": "XML" },
    { "value": "text", "label": "Plain Text" }
  ],
  "default": "json"
}
```

### checkbox
Boolean toggle
```json
{
  "type": "checkbox",
  "name": "include_headers",
  "label": "Include Headers",
  "description": "Add headers to the output",
  "default": false
}
```

### multiselect
Multiple selection (checkboxes or multi-select dropdown)
```json
{
  "type": "multiselect",
  "name": "features",
  "label": "Select Features",
  "options": [
    { "value": "auth", "label": "Authentication" },
    { "value": "logging", "label": "Logging" },
    { "value": "caching", "label": "Caching" }
  ]
}
```

### textarea
Multi-line text input
```json
{
  "type": "textarea",
  "name": "description",
  "label": "Description",
  "constraints": {
    "minLength": 10,
    "maxLength": 1000
  },
  "placeholder": "Enter detailed description..."
}
```

### slider
Range slider
```json
{
  "type": "slider",
  "name": "confidence",
  "label": "Confidence Level",
  "description": "Minimum confidence threshold",
  "constraints": {
    "min": 0,
    "max": 1,
    "step": 0.1
  },
  "default": 0.8
}
```

### date
Date picker
```json
{
  "type": "date",
  "name": "deadline",
  "label": "Deadline",
  "constraints": {
    "min": "2025-01-01",
    "max": "2026-12-31"
  }
}
```

## Tool Integration

### Tool Registration

Tools must declare support for structured responses:

```json
{
  "id": "custom_tool",
  "name": "Custom Tool",
  "description": "Tool with structured responses",
  "capabilities": ["structured_responses"],
  "response_format": "structured"
}
```

### Tool Implementation Example

```javascript
async function executeTool(params) {
  // Initial call - return form schema
  if (!params.userChoices) {
    return {
      type: "structured_tool_response",
      version: "1.0",
      tool_id: "data_analysis",
      status: "in_progress",
      message: "Please configure your analysis parameters",
      data: {
        schema: {
          title: "Data Analysis Configuration",
          description: "Configure parameters for your data analysis",
          fields: [
            {
              type: "select",
              name: "dataset",
              label: "Select Dataset",
              required: true,
              options: [
                { value: "sales_2024", label: "Sales 2024" },
                { value: "sales_2025", label: "Sales 2025" }
              ]
            },
            {
              type: "radio",
              name: "analysis_type",
              label: "Analysis Type",
              options: [
                { value: "summary", label: "Summary" },
                { value: "trend", label: "Trend Analysis" },
                { value: "comparison", label: "Year Comparison" }
              ]
            },
            {
              type: "checkbox",
              name: "include_charts",
              label: "Include Charts",
              default: true
            }
          ],
          submit_text: "Run Analysis",
          cancel_text: "Cancel"
        },
        values: {},
        metadata: {
          step: 1,
          total_steps: 2
        }
      }
    };
  }
  
  // User submitted form - process with choices
  const analysisResult = await runAnalysis(params.userChoices);
  
  return {
    type: "structured_tool_response",
    version: "1.0",
    tool_id: "data_analysis",
    status: "complete",
    message: "Analysis completed successfully",
    data: {
      result: analysisResult
    }
  };
}
```

## Frontend Implementation

### Component Structure

```javascript
// components/StructuredToolResponse.jsx
function StructuredToolResponse({ response, onSubmit, onCancel }) {
  const { schema, values, metadata } = response.data;
  const [formData, setFormData] = useState(values);
  
  const renderField = (field) => {
    switch (field.type) {
      case 'text': return <TextField field={field} value={formData[field.name]} onChange={handleFieldChange} />;
      case 'number': return <NumberField field={field} value={formData[field.name]} onChange={handleFieldChange} />;
      case 'select': return <SelectField field={field} value={formData[field.name]} onChange={handleFieldChange} />;
      case 'radio': return <RadioField field={field} value={formData[field.name]} onChange={handleFieldChange} />;
      case 'checkbox': return <CheckboxField field={field} value={formData[field.name]} onChange={handleFieldChange} />;
      case 'multiselect': return <MultiSelectField field={field} value={formData[field.name]} onChange={handleFieldChange} />;
      case 'textarea': return <TextareaField field={field} value={formData[field.name]} onChange={handleFieldChange} />;
      case 'slider': return <SliderField field={field} value={formData[field.name]} onChange={handleFieldChange} />;
      case 'date': return <DateField field={field} value={formData[field.name]} onChange={handleFieldChange} />;
      default: return null;
    }
  };
  
  const handleSubmit = () => {
    if (validateForm(schema, formData)) {
      onSubmit({
        ...response,
        data: {
          ...response.data,
          values: formData
        }
      });
    }
  };
  
  return (
    <div className="structured-tool-response">
      <h3>{schema.title}</h3>
      <p>{schema.description}</p>
      
      <div className={`form-layout ${schema.layout}`}>
        {schema.fields.map(field => (
          <div key={field.name} className="form-field">
            <label>{field.label}</label>
            {field.description && <small>{field.description}</small>}
            {renderField(field)}
          </div>
        ))}
      </div>
      
      <div className="form-actions">
        <button onClick={handleSubmit}>{schema.submit_text || 'Submit'}</button>
        <button onClick={onCancel}>{schema.cancel_text || 'Cancel'}</button>
      </div>
      
      {metadata && <div className="progress-info">Step {metadata.step} of {metadata.total_steps}</div>}
    </div>
  );
}
```

### Integration with Chat Interface

```javascript
// In message rendering logic
function renderToolResponse(response) {
  if (response.type === 'structured_tool_response') {
    return (
      <StructuredToolResponse
        response={response}
        onSubmit={(updatedResponse) => handleStructuredResponseSubmit(updatedResponse)}
        onCancel={() => handleStructuredResponseCancel()}
      />
    );
  }
  // Handle other response types
}
```

### Message Submission Flow

```javascript
async function handleStructuredResponseSubmit(structuredResponse) {
  const { tool_id, data } = structuredResponse;
  
  // Send back to LLM with updated parameters
  const prompt = JSON.stringify({
    type: "structured_tool_update",
    tool_id: tool_id,
    user_choices: data.values,
    previous_response: structuredResponse
  });
  
  // This gets processed through the existing tool calling mechanism
  await sendMessage(prompt);
}
```

## State Management

### Redux Slice

```javascript
// store/slices/structuredToolResponsesSlice.js
const structuredToolResponsesSlice = createSlice({
  name: 'structuredToolResponses',
  initialState: {
    activeResponses: {},
    history: []
  },
  reducers: {
    setActiveResponse: (state, action) => {
      state.activeResponses[action.payload.id] = action.payload;
    },
    updateResponse: (state, action) => {
      if (state.activeResponses[action.payload.id]) {
        state.activeResponses[action.payload.id] = {
          ...state.activeResponses[action.payload.id],
          ...action.payload.updates
        };
      }
    },
    removeActiveResponse: (state, action) => {
      delete state.activeResponses[action.payload];
    },
    addToHistory: (state, action) => {
      state.history.push(action.payload);
    }
  }
});
```

## Validation

### Client-side Validation

```javascript
function validateForm(schema, formData) {
  const errors = [];
  
  for (const field of schema.fields) {
    const value = formData[field.name];
    
    // Required field validation
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.label} is required`);
      continue;
    }
    
    // Type-specific validation
    if (field.type === 'number' && field.constraints) {
      if (field.constraints.min !== undefined && value < field.constraints.min) {
        errors.push(`${field.label} must be at least ${field.constraints.min}`);
      }
      if (field.constraints.max !== undefined && value > field.constraints.max) {
        errors.push(`${field.label} must be at most ${field.constraints.max}`);
      }
    }
    
    if (field.type === 'text' && field.constraints) {
      if (field.constraints.pattern) {
        const regex = new RegExp(field.constraints.pattern);
        if (!regex.test(value)) {
          errors.push(`${field.label} does not match the required format`);
        }
      }
      if (field.constraints.minLength && value.length < field.constraints.minLength) {
        errors.push(`${field.label} must be at least ${field.constraints.minLength} characters`);
      }
      if (field.constraints.maxLength && value.length > field.constraints.maxLength) {
        errors.push(`${field.label} must be at most ${field.constraints.maxLength} characters`);
      }
    }
  }
  
  return errors.length === 0;
}
```

## Error Handling

### Error Response Structure

```json
{
  "type": "structured_tool_response",
  "version": "1.0",
  "tool_id": "tool_name",
  "status": "error",
  "message": "Error description",
  "data": {
    "error_code": "VALIDATION_ERROR",
    "error_details": "Specific error information",
    "retry_allowed": true,
    "suggested_fix": "How the user can fix the error"
  }
}
```

## Multi-step Workflows

### Progress Tracking

```json
{
  "data": {
    "schema": { /* Current step schema */ },
    "values": { /* Current step values */ },
    "metadata": {
      "step": 2,
      "total_steps": 4,
      "step_title": "Configure Options",
      "completed_steps": [
        { "step": 1, "title": "Select Dataset", "values": { "dataset": "sales_2024" } }
      ]
    }
  }
}
```

## Examples

### Example 1: Web Search Configuration

```json
{
  "type": "structured_tool_response",
  "version": "1.0",
  "tool_id": "web_search",
  "status": "in_progress",
  "message": "Configure your web search parameters",
  "data": {
    "schema": {
      "title": "Web Search Configuration",
      "fields": [
        {
          "type": "text",
          "name": "query",
          "label": "Search Query",
          "required": true
        },
        {
          "type": "select",
          "name": "time_range",
          "label": "Time Range",
          "options": [
            { "value": "day", "label": "Past 24 hours" },
            { "value": "week", "label": "Past week" },
            { "value": "month", "label": "Past month" },
            { "value": "year", "label": "Past year" }
          ],
          "default": "week"
        },
        {
          "type": "number",
          "name": "max_results",
          "label": "Maximum Results",
          "constraints": { "min": 1, "max": 20 },
          "default": 10
        },
        {
          "type": "checkbox",
          "name": "include_images",
          "label": "Include Images",
          "default": false
        }
      ],
      "submit_text": "Search",
      "cancel_text": "Cancel"
    },
    "values": {},
    "metadata": {}
  }
}
```

### Example 2: Image Generation

```json
{
  "data": {
    "schema": {
      "title": "Image Generation Settings",
      "fields": [
        {
          "type": "textarea",
          "name": "prompt",
          "label": "Prompt",
          "required": true,
          "constraints": { "maxLength": 500 }
        },
        {
          "type": "radio",
          "name": "size",
          "label": "Image Size",
          "options": [
            { "value": "256x256", "label": "Small (256x256)" },
            { "value": "512x512", "label": "Medium (512x512)" },
            { "value": "1024x1024", "label": "Large (1024x1024)" }
          ],
          "default": "512x512"
        },
        {
          "type": "slider",
          "name": "quality",
          "label": "Quality",
          "description": "Higher quality takes longer",
          "constraints": { "min": 1, "max": 10, "step": 1 },
          "default": 7
        }
      ]
    }
  }
}
```

## Security Considerations

1. **Input Sanitization**: All user inputs must be sanitized before processing
2. **Schema Validation**: Validate tool responses against schema before rendering
3. **XSS Prevention**: Escape all dynamic content in UI rendering
4. **Rate Limiting**: Limit number of structured response interactions
5. **Tool Permissions**: Tools with structured responses must be explicitly authorized

## Compatibility

- **Backward Compatible**: Tools without structured responses continue to work as before
- **Opt-in Feature**: Tools must explicitly declare `structured_responses` capability
- **Progressive Enhancement**: UI gracefully degrades if schema parsing fails

## Migration Path

1. Phase 1: Add schema definition and basic rendering for text/select/radio fields
2. Phase 2: Implement remaining field types and validation
3. Phase 3: Add multi-step workflow support
4. Phase 4: Integrate with existing GWDG tools
5. Phase 5: Provide tool development guidelines and examples

## Future Enhancements

- Conditional fields (show/hide based on other field values)
- Custom field components registration
- Form templates and presets
- Bulk editing operations
- Export/import form configurations
- Visual form builder for tool developers