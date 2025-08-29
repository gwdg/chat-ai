import { useTranslation } from "react-i18next";

export default function Motto() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center w-full pt-20">
      <p className="filter text-black dark:text-white opacity-50 drop-shadow-lg">
        Your conversations are never stored on our servers.
        {/* TODO do translation */}
      </p>
    </div>
  );
}