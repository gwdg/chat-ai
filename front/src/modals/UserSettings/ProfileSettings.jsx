import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, UserRound } from "lucide-react";

import { useBrand } from "../../config/BrandProvider";
import { hasBrandInstitute } from "../../config/brandPolicy";
import InstituteSection from "./InstituteSection";
import UserInfoContainer from "./UserInfoContainer";

/**
 * The Profile tab has two screens, mirroring the Data tab: the user's own account
 * (`User`) and the institution that provides this deployment (`Institution`).
 *
 * The Institution screen is brand data, not user data, so it is a section of its
 * own: it stays available while `/user` is still loading or when the profile
 * route does not answer, and it is absent entirely for a brand that neither
 * describes itself nor narrows anything.
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
];

export default function ProfileSettings({
  userData,
  modelsData,
  initialSection = null,
}) {
  const { t } = useTranslation();
  const { brand } = useBrand();

  const sections = PROFILE_SECTIONS.filter(
    (section) => !section.brandOnly || hasBrandInstitute(brand),
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

    return (
      <div data-guide="profile-section-user">
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
