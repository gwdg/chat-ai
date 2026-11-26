import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

import { useBrand } from "../../config/BrandProvider";
import {
  brandConsentGate,
  consentPurposes,
  consentText,
  defaultConsentAnswers,
} from "../../config/consent";
import { acceptBrandConsent } from "../../Redux/reducers/interfaceSettingsSlice";

/**
 * Profile → Consents. Only rendered for a brand that declares a `consentGate`;
 * the purpose switches write a new acceptance record immediately, keeping the
 * gate's version and the original acceptance date.
 */
export default function BrandConsentSettings() {
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const { brand } = useBrand();
  const gate = brandConsentGate(brand);
  const record = useSelector(
    (state) => state.interface_settings?.consent_acceptance?.[brand.id],
  );

  if (!gate) return null;
  const purposes = consentPurposes(gate);
  const answers = { ...defaultConsentAnswers(gate), ...(record?.answers ?? {}) };

  const save = (next) => {
    dispatch(
      acceptBrandConsent({
        brandId: brand.id,
        version: gate.version,
        answers: next,
        acceptedAt: record?.acceptedAt || new Date().toISOString(),
      }),
    );
  };

  return (
    <section
      className="flex flex-col gap-2"
      data-guide="brand-consent-settings"
    >
      <h3 className="px-2 text-sm font-medium text-base-content">
        {consentText(gate.consentsTitle, i18n.language) ||
          t("consent.settings_title")}
      </h3>
      <p className="px-2 text-xs leading-relaxed text-base-content/70">
        {consentText(gate.consentsIntro, i18n.language) ||
          t("consent.settings_intro")}
      </p>
      {purposes.map((purpose) => (
        <div
          key={purpose.id}
          className="flex items-start justify-between gap-3 rounded-box border border-base-300 px-3 py-2"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {consentText(purpose.label, i18n.language) || purpose.id}
            </div>
            {consentText(purpose.description, i18n.language) ? (
              <p className="mt-0.5 text-xs leading-relaxed text-base-content/70">
                {consentText(purpose.description, i18n.language)}
              </p>
            ) : null}
          </div>
          <input
            type="checkbox"
            role="switch"
            aria-label={
              consentText(purpose.label, i18n.language) || purpose.id
            }
            className="toggle toggle-primary toggle-sm mt-1"
            checked={Boolean(answers[purpose.id])}
            onChange={(event) =>
              save({ ...answers, [purpose.id]: event.target.checked })
            }
          />
        </div>
      ))}
      {record?.acceptedAt ? (
        <p className="px-2 text-xs text-base-content/60">
          {t("consent.accepted_on", {
            date: new Date(record.acceptedAt).toLocaleDateString(i18n.language),
          })}
        </p>
      ) : (
        <p className="px-2 text-xs text-warning">
          {t("consent.not_accepted_yet")}
        </p>
      )}
      {Array.isArray(gate.links) && gate.links.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs">
          {gate.links.map((link) =>
            link?.url ? (
              <a
                key={link.id || link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="link link-primary"
              >
                {consentText(link.label, i18n.language) || link.url}
              </a>
            ) : null,
          )}
        </div>
      ) : null}
      {consentText(gate.laterNote, i18n.language) ? (
        <p className="px-2 text-xs text-base-content/60">
          {consentText(gate.laterNote, i18n.language)}
        </p>
      ) : null}
    </section>
  );
}
