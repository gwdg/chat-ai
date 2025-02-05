function Tooltip({ text, children }) {
  return (
    <div className="relative cursor-pointer group h-fit flex justify-center items-center">
      <div className="fixed transform -translate-y-[120%] z-50 bg-white dark:bg-black text-black dark:text-white text-xs rounded p-1 border dark:border-border_dark max-w-[150px] break-words hidden group-hover:block">
        {text}
      </div>
      {children}
    </div>
  );
}

export default Tooltip;
