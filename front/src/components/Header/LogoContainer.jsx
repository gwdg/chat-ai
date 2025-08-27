import Logo from "../../assets/logos/chat_ai.svg";
import { Link } from "react-router-dom";

export default function LogoContainer({ isMobile = false }) {
  return !isMobile ? (
    <Link to={"https://chat-ai.academiccloud.de/"}>
    <div className="flex items-center dark:border-gray-700">
      <img
        className="h-8 w-auto object-contain"
        src={Logo}
        alt="Chat AI Logo"
      />
    </div>
    </Link>
  ) : (
    <Link to={"https://chat-ai.academiccloud.de/"}>
    <div className="flex-shrink-0">
      <img
        className="h-6 min-[400px]:h-7 min-[500px]:h-8 w-auto object-contain"
        src={Logo}
        alt="Chat AI Logo"
      />
    </div>
    </Link>
  );
}