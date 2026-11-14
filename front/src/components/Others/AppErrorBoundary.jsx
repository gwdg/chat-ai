import React from "react";

import i18n from "../../i18n";
import ErrorScreen from "./ErrorScreen";

export default class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled application error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const error = this.state.error;
    return (
      <ErrorScreen
        title={i18n.t("errors.app_title")}
        message={i18n.t("errors.app_message")}
        details={String(error?.stack || error?.message || error)}
        reloadLabel={i18n.t("errors.reload")}
      />
    );
  }
}
