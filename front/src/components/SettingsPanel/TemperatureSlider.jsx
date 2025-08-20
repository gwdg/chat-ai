import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useModal } from "../../modals/ModalContext";

export default function TemperatureSlider({ localState, setLocalState }) {
  const { openModal } = useModal();
  const [isHovering, setHovering] = useState(false);
  const settings = localState.settings;

  // Handle temperature setting change
  const handleChangeTemp = (newValue) => {
    // Convert to float and update settings
    const numVal = parseFloat(newValue);
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        temperature: numVal,
      },
    }));
  };

  return (
    <div className="flex flex-col md:flex-row md:gap-4 gap-3 w-full md:items-center">
      <div className="flex-shrink-0 flex items-center gap-2 select-none min-w-[80px]">
        <p className="text-sm font-medium">temp</p>
        <HelpCircle
          className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
          alt="help"
          onClick={() => openModal("helpTemperature")}
        />
      </div>
      <div className="w-full">
        <div className="relative w-full">
          {/* Slider labels */}
          <div className="select-none flex justify-between text-[10px] text-tertiary mb-2">
            <span>Logical</span>
            <span>Creative</span>
          </div>

          {/* Clean slider track */}
          <div className="relative">
            {/* Background track - thin line */}
            <div className="w-full h-1 bg-gray-300 dark:bg-gray-600 rounded-full">
              {/* Progress fill - thin colored line */}
              <div
                className="h-full bg-tertiary rounded-full transition-all duration-150"
                style={{
                  width: `${(settings?.temperature / 2) * 100}%`,
                }}
              />
            </div>

            {/* Tick marks - smaller and cleaner */}
            <div className="absolute top-1/2 transform -translate-y-1/2 w-full flex justify-between px-0.5 pointer-events-none">
              {[...Array(21)].map((_, i) => (
                <div
                  key={i}
                  className={`bg-gray-400 dark:bg-gray-500 ${
                    i % 5 === 0 ? "w-0.5 h-3" : "w-px h-2"
                  }`}
                />
              ))}
            </div>

            {/* Slider input - handles both clicking and dragging */}
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings?.temperature}
              className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer"
              onChange={(event) => handleChangeTemp(event.target.value)}
            />

            {/* Visual thumb indicator */}
            <div
              className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-200 border-2 border-tertiary rounded-full shadow-md transition-all duration-150 hover:scale-110 pointer-events-none"
              style={{
                left: `${(settings?.temperature / 2) * 100}%`,
              }}
            />

            {/* Larger hover area for tooltip */}
            <div
              className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-8 h-8 pointer-events-none"
              style={{
                left: `${(settings?.temperature / 2) * 100}%`,
              }}
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            />

            {/* Hover tooltip */}
            {isHovering && (
              <div
                className="absolute -top-10 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-10"
                style={{
                  left: `${(settings?.temperature / 2) * 100}%`,
                }}
              >
                {Number(settings?.temperature).toFixed(1)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
