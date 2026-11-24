import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { Check } from "lucide-react";

import BaseModal from "../../modals/BaseModal";
import { useBrand } from "../../config/BrandProvider";
import {
  brandConsentGate,
  consentPurposes,
  consentText,
  defaultConsentAnswers,
  requiresBrandConsent,
} from "../../config/consent";
import { acceptBrandConsent } from "../../Redux/reducers/interfaceSettingsSlice";

/**
 * Mandatory, brand-configured consent dialog.
 *
 * Step 1 shows the terms summary, the external legal links and a required
 * checkbox. Step 2 asks one opt-in question per declared purpose, all off by
 * default. Accepting stores `{ version, answers, acceptedAt }` for the brand in
 * `interface_settings.consent_acceptance`, which is device-local. A brand whose
 * `consentGate` is missing renders nothing, so every other deployment is
 * unchanged.
 */
export default function BrandConsentGate() {
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const { brand } = useBrand();
  const gate = brandConsentGate(brand);

  const record = useSelector(
    (state) => state.interface_settings?.consent_acceptance?.[brand.id],
  );

  const [step, setStep] = useState("terms");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [answers, setAnswers] = useState(() => defaultConsentAnswers(gate));

  const open = requiresBrandConsent(brand, record);
  const purposes = consentPurposes(gate);
  const summary = useMemo(() => {
    const html = consentText(gate?.termsSummary, i18n.language);
    return html ? DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) : "";
  }, [gate, i18n.language]);

  if (!gate || !open) return null;

  const togglePurpose = (id) =>
    setAnswers((current) => ({ ...current, [id]: !current[id] }));

  const accept = () => {
    dispatch(
      acceptBrandConsent({
        brandId: brand.id,
        version: gate.version,
        answers,
        acceptedAt: new Date().toISOString(),
      }),
    );
  };

  return (
    <BaseModal
      isOpen
      isForced
      onClose={() => {}}
      titleNode={consentText(gate.title, i18n.language) || brand.name}
      maxWidth="max-w-2xl"
      contentClassName="px-5 pb-5 pt-1 flex flex-col gap-4 max-h-[75dvh] overflow-y-auto"
    >
      {step === "terms" ? (
        <>
          <p className="text-sm text-base-content/80">
            {consentText(gate.intro, i18n.language)}
          </p>
          <div
            className="rounded-box border border-base-300 bg-base-200/60 p-3 text-sm leading-relaxed
              [&_h3]:font-semibold [&_h3]:text-base-content [&_h3]:mb-2
              [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
              [&_a]:text-accent [&_a:hover]:underline"
            dangerouslySetInnerHTML={{ __html: summary }}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {(Array.isArray(gate.links) ? gate.links : []).map((link) =>
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
          <label className="flex items-start gap-2 rounded-box border border-base-300 p-3 text-sm">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary mt-0.5"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <span>
              {consentText(gate.termsCheckbox, i18n.language) ||
                t("consent.terms_checkbox")}
            </span>
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-base-content/60">
              {termsAccepted ? "" : t("consent.terms_required")}
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!termsAccepted}
              onClick={() => setStep("consents")}
            >
              {t("consent.continue")}
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold">
            {consentText(gate.consentsTitle, i18n.language) ||
              t("consent.settings_title")}
          </h3>
          <p className="text-sm text-base-content/80">
            {consentText(gate.consentsIntro, i18n.language)}
          </p>
          <div className="flex flex-col gap-2">
            {purposes.map((purpose) => (
              <div
                key={purpose.id}
                className="rounded-box border border-base-300 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {consentText(purpose.label, i18n.language) || purpose.id}
                    </div>
                    {consentText(purpose.description, i18n.language) ? (
                      <p className="mt-1 text-xs leading-relaxed text-base-content/70">
                        {consentText(purpose.description, i18n.language)}
                      </p>
                    ) : null}
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    role="switch"
                    aria-label={
                      consentText(purpose.label, i18n.language) || purpose.id
                    }
                    checked={Boolean(answers[purpose.id])}
                    onChange={() => togglePurpose(purpose.id)}
                  />
                </div>
              </div>
            ))}
          </div>
          {consentText(gate.laterNote, i18n.language) ? (
            <p className="text-xs text-base-content/60">
              {consentText(gate.laterNote, i18n.language)}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setStep("terms")}
            >
              {t("consent.back")}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={accept}>
              <Check size={16} />
              {t("consent.save")}
            </button>
          </div>
        </>
      )}
    </BaseModal>
  );
}
