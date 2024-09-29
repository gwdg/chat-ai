# Changelog 

## Version: v0.6.0

### Memory and Performance Improvements:
- **Memory leak resolved**: Issue caused by using `rehype-highlight` was fixed by switching to `react-syntax-highlighter`.
- **Removed unwanted libraries**: Unnecessary libraries were removed to improve performance and reduce bundle size.

### UI and View Enhancements:
- Zoom down to 90%: Adjusted view for better user experience and interface visibility.
- Minor UI changes:
    - Resolved clear history toast issue.
    - Removed edit button from the system prompt UI.
    - Added "Do not show again" option to clear history.

### Feature Enhancements:
- Top_p and Temperature slider added:
    - A slider for `top_p` allows users to adjust the total probability distribution for next token selection, similar to temperature.
    - Fixed and improved sliders for `temperature` and `top_p` to allow for easier customization.
- Custom configuration page integrated: Separate page for custom configuration of `temperature` and `top_p` merged into the main page for a seamless experience.
- Export and Import functionality: Users can export the settings for `temperature` and `top_p` as a JSON file. Imported settings will automatically configure the interface.

### PDF and TXT Export:
- **PDF beautification completed**: Improved the look and layout of exported PDF files.
- **Endnotes with export**: PDF and TXT exports now include `temperature`, `top_p` and model name in the endnotes.

### Additional Features:
- **Prompt resending/editing**: Users can now resend or edit prompts for better control.
- **Unwanted announcement bar removed**: Cleaned up the interface by removing unnecessary elements.