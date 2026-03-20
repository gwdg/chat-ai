# Structured Tool Responses - UI Test Tool Guide

## Overview

A comprehensive UI test tool has been created to verify and validate the Structured Tool Responses feature. This tool allows you to test various field types, validation scenarios, and custom configurations.

## Accessing the Test Tool

Navigate to: **`http://localhost:8080/test-structured-responses`**

Run the development server first:
```bash
cd front
npm run dev
```

## Test Tool Features

### 1. Example Selection
- Pre-built test cases for common use cases:
  - Web Search Configuration
  - Image Generation
  - Data Analysis

### 2. Custom JSON Testing
- Paste or type custom JSON responses
- Real-time JSON validation
- Invalid JSON detection with warnings

### 3. Raw JSON Display
- Toggle to view the raw JSON schema
- Helpful for debugging understanding structure

### 4. Real-time Form Rendering
- Instant rendering of selected example
- Interactive form components
- Submission and cancel handlers

### 5. Field Type Status
- Visual indicator of supported field types
- Phase 1 (green): Text, Number, Select, Radio
- Phase 2 (yellow): Checkbox, Textarea, Slider, Multiselect

## Test Scenarios

### Scenario 1: Required Field Validation
Tests that required fields are properly validated.

**Steps:**
1. Select "Web Search Configuration"
2. Leave the search query empty
3. Click "Search" button
4. **Expected:** Validation error showing "Search Query is required"

### Scenario 2: Number Constraint Validation
Tests numeric field constraints (min, max, step).

**Steps:**
1. Select "Web Search Configuration"
2. Set "Maximum Results" to 25 (exceeds max of 20)
3. Click "Search" button
4. **Expected:** Validation error showing constraint violation

### Scenario 3: Form Submission
Tests successful form submission and data handling.

**Steps:**
1. Select any example (e.g., "Image Generation")
2. Fill in all required fields
3. Click submit button
4. **Expected:** Alert showing submitted data in console

### Scenario 4: Custom Invalid JSON
Tests error handling for invalid JSON input.

**Steps:**
1. Check "Use Custom JSON"
2. Enter invalid JSON: `{ invalid: json }` (missing quotes)
3. **Expected:** "Invalid JSON" warning appears below textarea

### Scenario 5: Layout Testing
Tests different form layouts.

**Steps:**
1. Select "Data Analysis Configuration"
2. Verify grid layout (2 columns on desktop)
3. **Expected:** Fields displayed in 2-column grid layout

## Testing Checklist

### Basic Functionality
- [ ] Test tool loads successfully at `/test-structured-responses`
- [ ] Example dropdown works and changes form
- [ ] Custom JSON checkbox toggles textarea
- [ ] Raw JSON toggle shows/hides JSON code block

### Form Rendering
- [ ] Web Search example renders correctly
- [ ] Image Generation example renders correctly
- [ ] Data Analysis example renders correctly
- [ ] All field types display properly

### Validation
- [ ] Required field validation shows error
- [ ] Number constraints are enforced (min, max, step)
- [ ] Error messages are clear and helpful
- [ ] Errors clear when fields are corrected

### Interactions
- [ ] Submit button triggers alert with data
- [ ] Cancel button clears form
- [ ] Form data updates in real-time
- [ ] Dark mode compatibility works

### Custom JSON
- [ ] Valid custom JSON renders correctly
- [ ] Invalid JSON shows warning
- [ ] Syntax errors are caught

## Testing with Browser DevTools

### Console Logging
When submitting the form, check the browser console (F12) for:
```javascript
// Expected output:
Form submitted: {
  id: 'test-response',
  type: 'structured_tool_response',
  tool_id: 'web_search',
  data: {
    values: { ... }
  }
}
```

### Network Inspector
Monitor network requests when submitting to verify:
- No API calls are made (test tool is client-side only)
- Redux actions are dispatched correctly

### React DevTools
Inspect component state:
- `formData` - Current form values
- `errors` - Validation errors
- `submitting` - Loading state

## Integration Testing

To test in actual chat context:

1. Start the backend and frontend
2. Set up a tool that returns structured responses
3. Send a message that triggers the tool
4. Verify the form renders correctly in chat
5. Fill and submit the form
6. Check that data is sent back to the LLM

### Example Tool Test

Copy this as a tool response:

```json
{
  "type": "structured_tool_response",
  "version": "1.0",
  "tool_id": "test_tool",
  "status": "in_progress",
  "message": "Test configuration",
  "data": {
    "schema": {
      "title": "Test Form",
      "description": "This is a test form",
      "fields": [
        {
          "type": "text",
          "name": "test_field",
          "label": "Test Field",
          "required": true
        }
      ],
      "submit_text": "Submit Test",
      "cancel_text": "Cancel"
    },
    "values": {}
  }
}
```

## Troubleshooting

### Test Tool Not Loading
- Check development server is running: `npm run dev`
- Verify correct URL: `http://localhost:8080/test-structured-responses`
- Check browser console for errors

### Form Not Rendering
- Ensure JSON is valid (check "Invalid JSON" warning)
- Verify schema structure matches specification
- Check browser console for component errors

### Validation Not Working
- Verify field constraints are set correctly in schema
- Check that `required` flag is properly set
- Ensure validation utilities are imported correctly

### Submission Not Working
- Check browser console for error messages
- Verify onSubmit handler is connected
- Ensure Redux store is properly configured

## Reporting Issues

If you find issues during testing:

1. **Document the scenario** with steps to reproduce
2. **Screenshot the error** or unexpected behavior
3. **Check browser console** for error messages
4. **Test with different examples** to isolate the issue
5. **Report in GitHub issues** with full details

## Next Steps After Testing

After successful testing:

1. ✅ Confirm all Phase 1 field types work correctly
2. ✅ Verify validation is comprehensive
3. ✅ Test integration with actual chat flow
4. ✅ Document any discovered bugs
5. 📋 Plan Phase 2 implementation (additional field types)
6. 📋 Consider user feedback for improvements

## Contact

For questions or support:
- Review the main specification: `docs/structured-tool-responses-spec.md`
- Check implementation guide: `docs/implementation-guide.md`
- Examples available in: `utils/structuredToolExamples.js`