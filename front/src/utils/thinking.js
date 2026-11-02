const CLOSED_THINK_LITERAL = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
const CLOSED_THINK_ESCAPED =
  /&lt;think\b[^&]*&gt;([\s\S]*?)&lt;\/think&gt;/gi;

const removeClosedThinking = (text) =>
  text
    .replace(CLOSED_THINK_LITERAL, "")
    .replace(CLOSED_THINK_ESCAPED, "");

export const stripThinking = (text = "") => {
  const withoutClosed = removeClosedThinking(text);

  const lastOpen = Math.max(
    withoutClosed.lastIndexOf("<think"),
    withoutClosed.lastIndexOf("&lt;think")
  );

  const stripped =
    lastOpen !== -1 ? withoutClosed.slice(0, lastOpen) : withoutClosed;

  return stripped.trim();
};
