import { Trans } from "react-i18next";

export default function Motto() {

  return (
    <div className="flex flex-col items-center justify-center w-full pt-20 select-none">
      <p className="filter text-center text-black dark:text-white opacity-50 drop-shadow-lg">
        <Trans i18nKey="conversation.empty_message" />
      </p>
    </div>
  );
}