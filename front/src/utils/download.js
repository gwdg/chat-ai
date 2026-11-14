export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 300);
};

export const downloadText = (text, mimeType, filename) =>
  downloadBlob(new Blob([text], { type: mimeType }), filename);

export const downloadSvg = (svg, filename = "diagram.svg") =>
  downloadText(svg, "image/svg+xml;charset=utf-8", filename);

export const downloadHtml = (html, filename = "document.html") =>
  downloadText(html, "text/html;charset=utf-8", filename);

export const downloadCanvas = (canvas, filename = "chart.png") => {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, "image/png");
};

export const renderedFilename = (base, extension) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${base}-${stamp}.${extension}`;
};
