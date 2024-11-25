//When user hovers on button specifically with icons this component helps as tooltip
function Tooltip({ text, children }) {
  return (
    <div className="relative cursor-pointer group h-fit flex justify-center items-center">
      <div className="border dark:border-border_dark absolute z-10 hidden group-hover:block bg-white dark:bg-black text-black dark:text-white text-xs rounded p-1  bottom-full mb-2 whitespace-no-wrap">
        {text}
      </div>
      {children}
    </div>
  );
}

export default Tooltip;
