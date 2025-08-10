import { useState } from "react";
import help from "../../../assets/icon_help.svg";
import { useModal } from "../../../modals/ModalContext"; 

export default function TemperatureSlider({ localState, setLocalState}) {
    const { openModal } = useModal();
    const [isHovering, setHovering] = useState(false);
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
            <img
            src={help}
            alt="help"
            className="h-[16px] w-[16px] cursor-pointer"
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
                className="h-full bg-tertiary rounded-full transition-all duration-200"
                style={{
                    width: `${
                    (localState.settings.temperature / 2) * 100
                    }%`,
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

            {/* Slider input - for clicking on track */}
            <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={localState.settings.temperature}
                className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer"
                onChange={(event) =>
                handleChangeTemp(event.target.value)
                }
            />

            {/* Draggable thumb indicator with hover detection */}
            <div
                className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-6 h-6 cursor-grab active:cursor-grabbing flex items-center justify-center"
                style={{
                left: `${
                    (localState.settings.temperature / 2) * 100
                }%`,
                }}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                onMouseDown={(e) => {
                e.preventDefault();
                const slider =
                    e.currentTarget.parentElement.querySelector(
                    'input[type="range"]'
                    );
                if (slider) {
                    const rect = slider.getBoundingClientRect();
                    const handleMouseMove = (moveEvent) => {
                    const x = moveEvent.clientX - rect.left;
                    const percentage = Math.max(
                        0,
                        Math.min(1, x / rect.width)
                    );
                    const newValue = percentage * 2; // 0 to 2 range
                    const steppedValue =
                        Math.round(newValue * 10) / 10; // Round to nearest 0.1
                    handleChangeTemp(steppedValue.toString());
                    };

                    const handleMouseUp = () => {
                    document.removeEventListener(
                        "mousemove",
                        handleMouseMove
                    );
                    document.removeEventListener(
                        "mouseup",
                        handleMouseUp
                    );
                    };

                    document.addEventListener(
                    "mousemove",
                    handleMouseMove
                    );
                    document.addEventListener(
                    "mouseup",
                    handleMouseUp
                    );
                }
                }}
            >
                <div className="w-4 h-4 bg-white dark:bg-gray-200 border-2 border-tertiary rounded-full shadow-md transition-all duration-200 hover:scale-110" />
            </div>

            {/* Hover tooltip */}
            {isHovering && (
                <div
                className="absolute -top-10 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-10"
                style={{
                    left: `${
                    (localState.settings.temperature / 2) * 100
                    }%`,
                }}
                >
                {Number(localState.settings.temperature).toFixed(1)}
                </div>
            )}
            </div>
        </div>
        </div>
        </div>
  );
}