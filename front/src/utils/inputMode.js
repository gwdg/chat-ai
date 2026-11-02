// True on devices whose primary pointer is coarse (phones, tablets), where
// soft keyboards have no Shift key, so Enter must insert a newline there.
export const isTouchInput = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(pointer: coarse)").matches;
