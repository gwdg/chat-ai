// jsPDF optionally imports html2canvas for its HTML export helper. This app
// does not use that helper; alias it here so the rasterizer is not bundled.
export default function html2canvasUnavailable() {
  throw new Error("html2canvas is not bundled");
}
