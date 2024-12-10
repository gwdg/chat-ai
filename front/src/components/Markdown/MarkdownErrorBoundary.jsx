import React from "react";
import PropTypes from "prop-types";

class MarkdownErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Markdown Error:", error, errorInfo);
    // You can add your error reporting service here
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-black dark:text-white p-2 whitespace-pre-wrap break-words">
          {this.props.fallback || this.props.children}
        </div>
      );
    }

    return this.props.children;
  }
}

MarkdownErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node,
};

export default MarkdownErrorBoundary;
