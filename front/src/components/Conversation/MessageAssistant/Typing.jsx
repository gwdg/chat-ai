//Typing animation when waiting for response
function Typing() {
  return (
    <div className="typing bg-base-300 border dark:border-border_dark rounded-2xl">
      <div className="typing__dot dark:bg-bg_chat bg-bg_secondary_dark"></div>
      <div className="typing__dot dark:bg-bg_chat bg-bg_secondary_dark"></div>
      <div className="typing__dot dark:bg-bg_chat bg-bg_secondary_dark"></div>
    </div>
  );
}

export default Typing;
