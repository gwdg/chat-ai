import { useState, useEffect } from "react";
import ContainerModal from "./ContainerModal";
import cross from "../assets/cross.svg";

const PreviewImageModal = ({ file, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setIsLoading(true);
    setError(null);
  }, [file]);

  const handleZoom = (type) => {
    setScale((prev) => {
      if (type === "in" && prev < 3) return prev + 0.5;
      if (type === "out" && prev > 0.5) return prev - 0.5;
      return prev;
    });
  };

  return (
    <ContainerModal showModal={onClose}>
      <div className="dark:border-border_dark rounded-2xl bg-white dark:bg-black p-4 w-[90vw] sm:w-[70vw] max-w-[1000px] max-h-[95vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4 px-2">
          <p className="text-lg font-medium text-tertiary truncate max-w-[80%] dark:text-gray-200">
            {typeof file === "string" ? "Image Preview" : file.name}
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleZoom("out")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-tertiary dark:text-gray-300"
              disabled={scale <= 0.5}
              aria-label="Zoom out"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20 12H4"
                />
              </svg>
            </button>
            <span className="text-sm text-tertiary dark:text-gray-400">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => handleZoom("in")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-tertiary dark:text-gray-300"
              disabled={scale >= 3}
              aria-label="Zoom in"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
            <img
              src={cross}
              alt="close"
              className="h-[30px] w-[30px] cursor-pointer hover:opacity-80 transition-opacity"
              onClick={onClose}
            />
          </div>
        </div>

        <div className="relative flex justify-center items-center overflow-auto max-h-[80vh]">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600" />
            </div>
          )}

          {error && (
            <div className="text-red-500 dark:text-red-400 text-center p-4">
              Failed to load image. Please try again.
            </div>
          )}

          <div className="relative" style={{ transform: `scale(${scale})` }}>
            <img
              src={typeof file === "string" ? file : file.text}
              alt="Preview"
              className="max-h-[85vh] max-w-full object-contain transition-transform duration-200"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError(true);
              }}
            />
          </div>
        </div>
      </div>
    </ContainerModal>
  );
};

export default PreviewImageModal;
