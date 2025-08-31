

//Demand indicator for each model, used by the ModelSelector
export default function DemandIndicator({ demand, status }) {
  const gray = "bg-slate-300 opacity-40";
  const online = (status === "ready");
  const offline = (status === "offline");
  const loading = (status === "loading");
  const unavailable = !(online || offline || loading);

  const getBarConfig = () => {
    const gray = "bg-slate-300 opacity-40";
    if (!online) return [gray, gray, gray, gray];
    if (demand <= 1) return ["bg-emerald-500", "bg-emerald-500", "bg-emerald-500", "bg-emerald-500"];
    if (demand <= 3) return ["bg-yellow-500", "bg-yellow-500", "bg-yellow-500", gray];
    if (demand <= 5) return ["bg-orange-500", "bg-orange-500", gray, gray];
    return ["bg-red-500", gray, gray, gray];
  };
  const colors = getBarConfig();

  let hoverText = ""
  if (unavailable) {
    hoverText = "Unavailable"
  } else if (loading) {
    hoverText = "Loading"
  }else if (offline) {
    hoverText = "Offline"
  } else {
    hoverText = `Demand: ${demand <= 1 ? "low" : demand <= 3 ? "medium" : demand <= 5 ? "high" : "very high"}`
  }
  return (
    <div className="flex items-center gap-2" data-value="4" data-max="4" data-online="true"
    title={hoverText}>
      <div className="relative inline-flex items-end gap-0.5 h-4" aria-hidden="true">
        <span className={`w-1 rounded-sm transition-all duration-200 h-1.5 opacity-100 ${colors[0]} `}></span>
        <span className={`w-1 rounded-sm transition-all duration-200 h-2 opacity-100 ${colors[1]} `}></span>
        <span className={`w-1 rounded-sm transition-all duration-200 h-3 opacity-100 ${colors[2]} `}></span>
        <span className={`w-1 rounded-sm transition-all duration-200 h-4 opacity-100 ${colors[3]} `}></span>
        {unavailable &&
          /*
            <svg xmlns="http://www.w3.org/2000/svg" class="absolute top-0 left-0 w-2 h-2 text-red-600 cursor-pointer select-none z-10" viewBox="0 0 12 12" fill="currentColor">
              <path d="M1.5 0L6 4.5 10.5 0 12 1.5 7.5 6 12 10.5 10.5 12 6 7.5 1.5 12 0 10.5 4.5 6 0 1.5 1.5 0z"></path>
            </svg>*/
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="h-0.5 w-8 bg-red-500 rotate-40 rounded"></span>
          </div>
        }
        {loading &&
          <svg
           
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-4 h-4"
          >
            <g transform="translate(6, 6) scale(0.2)">
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
          </svg>
        }
      </div>

    </div>
  );
}
