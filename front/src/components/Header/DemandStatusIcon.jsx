import React from "react";

const DemandStatusIcon = ({ demand = 0, status = "ready", className = "" }) => {
  const getBarsConfig = () => {
    const emptyBars = { activeBars: 4, color: "#E0E0E0" };
    if (status !== "ready") return emptyBars;
    switch (true) {
      case demand <= 1:
        return { activeBars: 4, color: "#4CAF50" };
      case demand <= 3:
        return { activeBars: 3, color: "#FFC107" };
      case demand <= 5:
        return { activeBars: 2, color: "#FF9800" };
      default:
        return { activeBars: 1, color: "#F44336" };
    }
  };

  const { activeBars, color } = getBarsConfig();

  return (
    <svg viewBox="-20 -20 140 140" className={`h-[22px] w-[22px] ${className}`}>
      {[...Array(4)].map((_, index) => (
        <rect
          key={index}
          x={10 + index * 22}
          y={70 - index * 20}
          width="15"
          height={20 + index * 20}
          fill={status === "ready" && index < activeBars ? color : "#E0E0E0"}
        />
      ))}

      {status === "loading" && (
        <g transform="translate(22, 22) scale(1.2)">
          <circle
            cx="0"
            cy="0"
            r="25"
            fill="none"
            stroke="#009EE0"
            strokeWidth="7"
          />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="-15"
            stroke="#009EE0"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <line
            x1="0"
            y1="0"
            x2="15"
            y2="0"
            stroke="#009EE0"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </g>
      )}

      {status === "unavailable" && (
        <g transform="translate(22, 22) scale(1)">
          <line
            x1="-20"
            y1="-20"
            x2="20"
            y2="20"
            stroke="#F44336"
            strokeWidth="7"
            strokeLinecap="square"
          />
          <line
            x1="20"
            y1="-20"
            x2="-20"
            y2="20"
            stroke="#F44336"
            strokeWidth="7"
            strokeLinecap="square"
          />
        </g>
      )}
    </svg>
  );
};

export default DemandStatusIcon;
