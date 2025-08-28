import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { Trans } from "react-i18next";
// import { resetStore } from "../Redux/reducers/conversationsSlice";
import { v4 as uuidv4 } from "uuid";
import { persistor } from "../Redux/store/store";
import { setLastConversation, selectLastConversation } from "../Redux/reducers/lastConversationSlice";
import { listConversationMetas } from "../db";

const NotFoundPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const lastConversation = useSelector(selectLastConversation);
  const handleGoToChat = async () => {
    
    // const conversations = await listConversationMetas()

    // // If current conversation exists, go to it
    // if (conversations?.some((conv) => conv.id === lastConversation)) {
    //   console.log("Navigating to last conversation, ", lastConversation);
    //   navigate(`/chat/${lastConversation}`, { replace: true });
    //   return;
    // }

    // If current conversation doesn't exist but others do, go to first one
    // if (conversations.length > 0) {
    //   navigate(`/chat/${conversations[0].id}`, { replace: true });
    //   return;
    // }

    // If no conversations at all, create a new one
    // const newId = uuidv4();
    // dispatch(resetStore(newId));
    // TODO

    // Force persistence to ensure other tabs see this change
    dispatch(setLastConversation(null));
    await persistor.flush();
    // Go to empty chat
    navigate(`/chat`);

    // Navigate to the new conversation
    // navigate(`/chat/${newId}`, { replace: true });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full overflow-hidden bg-white dark:bg-black text-black dark:text-white select-none">
      <div className="text-center max-w-2xl px-4">
        <p className="text-5xl font-bold mb-6">
          <Trans i18nKey="description.notFound.title" />
        </p>

        <div className="space-y-4 text-lg mb-6">
          <p className="text-gray-600 dark:text-gray-300">
            <Trans i18nKey="description.notFound.description" />
          </p>

          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg my-8">
            <p className="text-xl font-semibold mb-3">
              <Trans i18nKey="description.notFound.reasonsTitle" />
            </p>
            <ul className="text-left text-gray-600 dark:text-gray-300 space-y-2">
              <p>
                <Trans i18nKey="description.notFound.reasons.deleted" />
              </p>
              <p>
                <Trans i18nKey="description.notFound.reasons.outdatedLink" />
              </p>
              <p>
                <Trans i18nKey="description.notFound.reasons.incorrectId" />
              </p>
              <p>
                <Trans i18nKey="description.notFound.reasons.historyCleared" />
              </p>
            </ul>
          </div>

          <p className="text-gray-600 dark:text-gray-300 mb-8">
            <Trans i18nKey="description.notFound.reassurance" />
          </p>
        </div>

        <button
          onClick={handleGoToChat}
          className="px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <Trans i18nKey="description.notFound.buttonText" />
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;
