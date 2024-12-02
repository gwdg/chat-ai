import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Trans } from "react-i18next";

const NotFoundPage = () => {
  const navigate = useNavigate();
  const currentConversationId = useSelector(
    (state) => state.conversations.currentConversationId
  );

  return (
    <div className="flex flex-col items-center justify-center h-full overflow-hidden bg-white dark:bg-black text-black dark:text-white select-none">
      <div className="text-center max-w-2xl px-4">
        <p className="text-5xl font-bold mb-6">
          {" "}
          <Trans i18nKey="description.notFound.title"></Trans>
        </p>

        <div className="space-y-4 text-lg mb-6">
          <p className="text-gray-600 dark:text-gray-300">
            <Trans i18nKey="description.notFound.description"></Trans>
          </p>

          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg my-8">
            <p className="text-xl font-semibold mb-3">
              <Trans i18nKey="description.notFound.reasonsTitle"></Trans>
            </p>
            <ul className="text-left text-gray-600 dark:text-gray-300 space-y-2">
              <p>
                <Trans i18nKey="description.notFound.reasons.deleted"></Trans>
              </p>
              <p>
                <Trans i18nKey="description.notFound.reasons.outdatedLink"></Trans>
              </p>
              <p>
                <Trans i18nKey="description.notFound.reasons.incorrectId"></Trans>
              </p>
              <p>
                <Trans i18nKey="description.notFound.reasons.historyCleared"></Trans>
              </p>
            </ul>
          </div>

          <p className="text-gray-600 dark:text-gray-300 mb-8">
            <Trans i18nKey="description.notFound.reassurance"></Trans>
          </p>
        </div>

        <button
          onClick={() =>
            navigate(`/chat/${currentConversationId}`, { replace: true })
          }
          className="px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
        >
          <Trans i18nKey="description.notFound.buttonText"></Trans>
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;
