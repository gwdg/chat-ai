import { useState } from "react";
import { useModal } from "../../modals/ModalContext";
import { HelpCircle } from "lucide-react";

export default function TopPSlider({ localState, setLocalState }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const { openModal } = useModal();

  const [value, setValue] = useState(localState?.settings?.top_p || 0.5)

  const handleChangeTopP = (newValue) => {
    const numVal = parseFloat(newValue);
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        top_p: numVal,
      },
      flush: true,
    }));
  };

  const progressPercentage = ((value - 0.05) / 0.95) * 100;
  const showValue = isHovering || isDragging || isClicked;

  const handleMouseDown = () => {
    setIsDragging(true);
    setIsClicked(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    handleChangeTopP(value);
    setTimeout(() => setIsClicked(false), 2000);
  };

  const handleTouchStart = () => {
    setIsClicked(true);
    setIsDragging(true);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTimeout(() => setIsClicked(false), 3000);
  };

  return (
    <div className="flex flex-col md:flex-row w-full md:items-center">
      <div className="flex-shrink-0 flex items-center gap-2 select-none min-w-[80px]">
        <p className="text-sm font-medium">top_p</p>
        <HelpCircle
          className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
          alt="help"
          onClick={() => openModal("helpTopP")}
        />
      </div>

      <div className="w-full">
        <div className="select-none flex justify-between text-[10px] text-tertiary">
          <span>Focused</span>
          <span>Diverse</span>
        </div>

        <div className="relative w-full h-6 flex items-center">
          <div className="w-full h-1 bg-gray-300 dark:bg-gray-600 rounded-full">
            <div
              className="h-full bg-tertiary rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            value={value}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => setValue(e.target.value)}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          />

          <div
            className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 pointer-events-none"
            style={{ left: `${progressPercentage}%` }}
          >
            {showValue && (
              <div className="absolute -top-9 left-1/2 transform -translate-x-1/2 bg-white dark:bg-bg_dark text-tertiary text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                {Number(value).toFixed(2)}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-l-transparent border-r-transparent border-t-white dark:border-t-bg_dark"></div>
              </div>
            )}

            <div
              className={`w-4 h-4 bg-white dark:bg-gray-200 border-2 border-tertiary rounded-full shadow-md ${
                showValue ? "scale-125" : ""
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
