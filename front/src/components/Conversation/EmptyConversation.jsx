import Logo from "../../assets/logos/chat_ai.svg";

export default function EmptyConversation() {

  return (
    <div className="flex flex-col items-center justify-center w-full p-4 select-none">
      <img
        className="max-w-[160px] sm:max-w-[200px] md:max-w-[240px] w-full object-contain filter opacity-80 grayscale drop-shadow-lg"
        src={Logo}
        alt="Chat AI Logo"
      />
    </div>
  );
}
