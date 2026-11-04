import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { Trans } from "react-i18next";
import { persistor } from "../Redux/store/store";
import { setLastConversation, selectLastConversation } from "../Redux/reducers/lastConversationSlice";

const NotFoundPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const lastConversation = useSelector(selectLastConversation);
  const handleGoToChat = async () => {
    // Force persistence to ensure other tabs see this change
    dispatch(setLastConversation(null));
    await persistor.flush();
    // Go to empty chat
    navigate(`/chat`);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full overflow-hidden bg-base-100 text-base-content">
      <div className="text-center max-w-2xl px-4">
        <p className="text-5xl font-bold mb-6">
          <Trans i18nKey="not_found.title" />
        </p>

        <div className="space-y-4 text-lg mb-6">
          <p className="text-base-content/70">
            <Trans i18nKey="not_found.description" />
          </p>

          <div className="bg-base-200 p-6 rounded-lg my-8">
            <p className="text-xl font-semibold mb-3">
              <Trans i18nKey="not_found.reasonsTitle" />
            </p>
            <ul className="text-left text-base-content/70 space-y-2">
              <p>
                <Trans i18nKey="not_found.reasons.deleted" />
              </p>
              <p>
                <Trans i18nKey="not_found.reasons.outdatedLink" />
              </p>
              <p>
                <Trans i18nKey="not_found.reasons.incorrectId" />
              </p>
              <p>
                <Trans i18nKey="not_found.reasons.historyCleared" />
              </p>
            </ul>
          </div>

          <p className="text-base-content/70 mb-8">
            <Trans i18nKey="not_found.reassurance" />
          </p>
        </div>

        <button
          onClick={handleGoToChat}
          className="btn btn-info btn-lg shadow-lg"
        >
          <Trans i18nKey="not_found.buttonText" />
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;
