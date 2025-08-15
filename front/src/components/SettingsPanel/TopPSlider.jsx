import { useState } from "react";
import icon_help from "../../assets/icons/help.svg";
import { useModal } from "../../modals/ModalContext";

export default function TopPSlider({ localState, setLocalState}) {
    const [isHoveringTopP, setHoveringTopP] = useState(false);
    const { openModal } = useModal();
    const settings = localState.current_conversation
    ? localState.conversations[localState.current_conversation].settings
    : {"model": {"id": "meta-llama-3.1-8b-instruct"}};
    // Handle top_p setting change
    const handleChangeTopP = (newValue) => {
        // Convert to float and update settings
        const numVal = parseFloat(newValue);
        setLocalState((prev) => ({
            ...prev,
            settings: {
                ...prev.settings,
                top_p: numVal,
            },
        }));
    };

    return (
        <div className="flex flex-col md:flex-row md:gap-4 gap-3 w-full md:items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none min-w-[80px]">
            <p className="text-sm font-medium">top_p</p>
            <img
            src={icon_help}
            alt="help"
            className="h-[16px] w-[16px] cursor-pointer"
            onClick={() => openModal("helpTopP")}
            />
        </div>
        <div className="w-full">
            <div className="relative w-full">
            {/* Slider labels */}
            <div className="select-none flex justify-between text-[10px] text-tertiary mb-2">
                <span>Focused</span>
                <span>Diverse</span>
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
                        ((localState.settings.top_p - 0.05) / 0.95) *
                        100
                    }%`,
                    }}
                />
                </div>

                {/* Tick marks - smaller and cleaner */}
                <div className="absolute top-1/2 transform -translate-y-1/2 w-full flex justify-between px-0.5">
                {[...Array(20)].map((_, i) => (
                    <div
                    key={i}
                    className={`bg-gray-400 dark:bg-gray-500 ${
                        i % 5 === 0 ? "w-0.5 h-3" : "w-px h-2"
                    }`}
                    />
                ))}
                </div>

                {/* Slider input */}
                <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={localState.settings.top_p}
                    className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer"
                    onChange={(event) =>
                        handleChangeTopP(event.target.value)
                    }
                />

                {/* Clean thumb indicator with hover detection */}
                <div
                className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-200 border-2 border-tertiary rounded-full shadow-md transition-all duration-200 hover:scale-110 cursor-pointer pointer-events-none"
                style={{
                    left: `${
                    ((localState.settings.top_p - 0.05) / 0.95) * 100
                    }%`,
                }}
                onMouseEnter={() => setHoveringTopP(true)}
                onMouseLeave={() => setHoveringTopP(false)}
                />

                {/* Invisible larger hover area for the thumb */}
                <div
                className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-8 h-8 cursor-pointer"
                style={{
                    left: `${
                    ((localState.settings.top_p - 0.05) / 0.95) * 100
                    }%`,
                }}
                onMouseEnter={() => setHoveringTopP(true)}
                onMouseLeave={() => setHoveringTopP(false)}
                />

                {/* Hover tooltip */}
                {isHoveringTopP && (
                <div
                    className="absolute -top-10 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
                    style={{
                    left: `${
                        ((localState.settings.top_p - 0.05) / 0.95) *
                        100
                    }%`,
                    }}
                >
                    {Number(localState.settings.top_p).toFixed(2)}
                </div>
                )}
            </div>
            </div>
        </div>
        </div>
    );
}