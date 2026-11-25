import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  Building2,
  MessageSquareWarning,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useBrand } from "../../config/BrandProvider";
import { hasBrandInstitute } from "../../config/brandPolicy";
import { brandConsentGate } from "../../config/consent";
import { isChatFeedbackEnabled } from "../../apis/feedback";
import {
  selectFeedbackEnabled,
  selectFeedbackFullTranscript,
  setFeedbackEnabled,
  setFeedbackFullTranscript,
} from "../../Redux/reducers/userSettingsReducer";
import { useModal } from "../ModalContext";
import BrandConsentSettings from "./BrandConsentSettings";
import InstituteSection from "./InstituteSection";
import ProfilePreferenceSwitch from "./ProfilePreferenceSwitch";
import UserInfoContainer from "./UserInfoContainer";

/**
 * The Profile tab has four screens, mirroring the Data tab: the user's own
 * account (`User`), the institution that provides this deployment
 * (`Institution`), the feedback this account sent (`Feedback`) and the brand's
 * voluntary consents (`Consents`).
 *
 * The Institution screen is brand data, not user data, so it is a section of its
 * own: it stays available while `/user` is still loading or when the profile
 * route does not answer, and it is absent entirely for a brand that neither
 * describes itself nor narrows anything. Feedback appears only while a receiver
 * is configured, and Consents only for a brand that declares a `consentGate`,
 * because a brand without one has no voluntary purposes to switch on or off.
 */

const PROFILE_SECTIONS = [
  {
    id: "user",
    icon: UserRound,
    labelKey: "user_settings.profile.sections.user",
  },
  {
    id: "institution",
    icon: Building2,
    labelKey: "user_settings.profile.sections.institution",
    brandOnly: true,
  },
  {
    id: "feedback",
    icon: MessageSquareWarning,
    labelKey: "user_settings.profile.sections.feedback",
    feedbackOnly: true,
  },
  {
    id: "consents",
    icon: ShieldCheck,
    labelKey: "user_settings.profile.sections.consents",
    consentOnly: true,
  },
];

/**
 * Answers are rated with the thumbs controls under each message, and the
 * feedback service is sent a changed conversation for analysis. Both follow
 * this switch, so a deployment that offers the feature can still leave the
 * choice to the user; only a deployment without a receiver hides it.
 */
function FeedbackPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const feedbackEnabled = useSelector(selectFeedbackEnabled);
  const fullTranscript = useSelector(selectFeedbackFullTranscript);

  if (!isChatFeedbackEnabled()) return null;

  return (
    <section className="flex flex-col gap-2" data-guide="feedback-preference">
      <ProfilePreferenceSwitch
        label={t("user_settings.chat_preferences.feedback.label")}
        description={t("user_settings.chat_preferences.feedback.description")}
        checked={feedbackEnabled}
        onChange={(checked) => dispatch(setFeedbackEnabled(checked))}
      />
      {feedbackEnabled && (
        <div data-guide="feedback-transcript-preference">
          <ProfilePreferenceSwitch
            label={t("user_settings.chat_preferences.feedback.transcript.label")}
            description={t(
              "user_settings.chat_preferences.feedback.transcript.description",
            )}
            checked={fullTranscript}
            onChange={(checked) => dispatch(setFeedbackFullTranscript(checked))}
          />
        </div>
      )}
    </section>
  );
}

export default function ProfileSettings({
  userData,
  modelsData,
  initialSection = null,
}) {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const { openModal } = useModal();

  const sections = PROFILE_SECTIONS.filter(
    (section) =>
      (!section.brandOnly || hasBrandInstitute(brand)) &&
      (!section.feedbackOnly || isChatFeedbackEnabled()) &&
      (!section.consentOnly || Boolean(brandConsentGate(brand))),
  );
  const resolveSection = (id) =>
    sections.some((section) => section.id === id) ? id : "user";

  const [activeSection, setActiveSection] = useState(() =>
    resolveSection(initialSection),
  );

  useEffect(() => {
    // A deep link (`profile/institution`) can arrive before the brand resolves;
    // apply it as soon as its screen exists. Clicking a tab does not change
    // `initialSection`, so this never overrides a user's choice.
    if (!initialSection) return;
    if (sections.some((section) => section.id === initialSection)) {
      setActiveSection(initialSection);
    }
    // `sections` follows the resolved brand; only its availability matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection, sections.length]);

  // Resolve against the current section list on every render, so a brand that
  // resolves without an Institution screen cannot leave a blank pane.
  const currentSection = resolveSection(activeSection);

  const renderSection = () => {
    if (currentSection === "institution") {
      return (
        <div data-guide="profile-section-institution">
          <InstituteSection modelsData={modelsData} />
        </div>
      );
    }

    if (currentSection === "feedback") {
      return (
        <div
          data-guide="profile-section-feedback"
          className="flex flex-col gap-4"
        >
          <FeedbackPreference />
          <section
            className="rounded-xl border border-base-300 bg-base-100 p-4"
            data-guide="profile-feedback-history"
          >
            <h3 className="flex items-center gap-2 text-sm font-medium text-base-content">
              <MessageSquareWarning className="h-4 w-4 text-accent" />
              {t("user_settings.profile.feedback.label")}
            </h3>
            <p className="mt-1 text-xs text-base-content/70">
              {t("user_settings.profile.feedback.description")}
            </p>
            <button
              type="button"
              className="btn btn-sm mt-3 w-fit"
              onClick={() => openModal("feedbackHistory")}
            >
              {t("user_settings.profile.feedback.open")}
            </button>
          </section>
        </div>
      );
    }

    if (currentSection === "consents") {
      return (
        <div data-guide="profile-section-consents">
          <BrandConsentSettings />
        </div>
      );
    }

    return (
      <div data-guide="profile-section-user" className="flex flex-col gap-5">
        {userData ? (
          <UserInfoContainer userData={userData} />
        ) : (
          <p className="text-sm text-base-content/70">{t("common.loading")}</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label={t("user_settings.profile.sections.label")}
        className="flex flex-wrap gap-1 rounded-xl bg-base-200 p-1"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const selected = section.id === currentSection;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-guide={`profile-subtab-${section.id}`}
              onClick={() => setActiveSection(section.id)}
              className={`flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:flex-none sm:justify-start ${
                selected
                  ? "bg-base-100 text-accent shadow-sm"
                  : "text-base-content/70 hover:bg-base-100/70 hover:text-base-content"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t(section.labelKey)}</span>
            </button>
          );
        })}
      </div>
      {renderSection()}
    </div>
  );
}
