import React from "react";

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-600 dark:text-red-400">
          Something went wrong rendering this content.
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
