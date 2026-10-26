import { useNavigate } from "react-router-dom";
import { Trans } from "react-i18next";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full overflow-hidden bg-base-100 text-base-content select-none">
      <div className="text-center max-w-2xl px-4">
        <p className="text-5xl font-bold mb-6">
          {" "}
          <Trans i18nKey="landing.title"></Trans>
        </p>

        <div className="space-y-4 text-lg mb-6">
          <p className="text-base-content/70">
            <Trans i18nKey="landing.description"></Trans>
          </p>

          <div className="bg-base-200 p-6 rounded-lg my-8">
            <p className="text-xl font-semibold mb-3">
              <Trans i18nKey="landing.reasonsTitle"></Trans>
            </p>
            <ul className="text-left text-base-content/70 space-y-2">
              <p>
                <Trans i18nKey="landing.reasons.deleted"></Trans>
              </p>
              <p>
                <Trans i18nKey="landing.reasons.outdatedLink"></Trans>
              </p>
              <p>
                <Trans i18nKey="landing.reasons.incorrectId"></Trans>
              </p>
              <p>
                <Trans i18nKey="landing.reasons.historyCleared"></Trans>
              </p>
            </ul>
          </div>

          <p className="text-base-content/70 mb-8">
            <Trans i18nKey="landing.reassurance"></Trans>
          </p>
        </div>

        <button
          onClick={() =>
            (window.location.href = "/")
          }
          className="px-8 py-4 bg-info text-white rounded-lg hover:bg-info/90 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <Trans i18nKey="landing.buttonText"></Trans>
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
