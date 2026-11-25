import { Building2, ExternalLink, Lock, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useBrand } from "../../config/BrandProvider";
import {
  brandInstituteLinks,
  brandRestrictionSummary,
  hasBrandRestrictions,
} from "../../config/brandPolicy";
import { localizeBrandValue } from "../../config/brands";

const asText = (value, language) => {
  const localized = localizeBrandValue(value, language);
  return typeof localized === "string" ? localized.trim() : "";
};

/**
 * The "Institution" block of the Profile tab. A deployment can serve several
 * institutions, each narrowing the service (fixed model, disabled modules, no
 * options that leave the institution). This is where the user sees what applies
 * to them and who provides it — brand-defined, never user-editable.
 *
 * A brand with neither `institute` nor `restrictions` renders nothing, so the
 * default Chat AI profile is unchanged.
 */
export default function InstituteSection({ modelsData }) {
  const { t, i18n } = useTranslation();
  const { brand } = useBrand();
  const institute = brand?.institute;
  const restrictions = brandRestrictionSummary(brand);
  const restricted = hasBrandRestrictions(brand);
  const links = brandInstituteLinks(brand);

  if (!institute && !restricted) return null;

  const modelName = (id) =>
    modelsData?.find((model) => model?.id === id)?.name || id;
  const moduleLabel = (id) =>
    t(`user_settings.account.institute.modules.${id}`, { defaultValue: id });
  const featureLabel = (id) =>
    t(`user_settings.account.institute.features.${id}`, { defaultValue: id });
  const externalLabel = (id) =>
    t(`user_settings.account.institute.external.${id}`, { defaultValue: id });
  const lockLabel = (id) =>
    t(`user_settings.account.institute.locks.${id}`, { defaultValue: id });
  const uiLabel = (id) =>
    t(`user_settings.account.institute.ui.${id}`, { defaultValue: id });

  const rows = [];
  if (restrictions.model.fixed) {
    rows.push({
      id: "model",
      label: t("user_settings.account.institute.model"),
      value: t("user_settings.account.institute.model_fixed", {
        model: modelName(restrictions.model.fixed),
      }),
    });
  } else if (restrictions.model.allowed) {
    rows.push({
      id: "model",
      label: t("user_settings.account.institute.model"),
      value: t("user_settings.account.institute.model_allowed", {
        models: restrictions.model.allowed.map(modelName).join(", "),
      }),
    });
  }
  if (restrictions.modules.length) {
    rows.push({
      id: "modules",
      label: t("user_settings.account.institute.modules_label"),
      value: restrictions.modules.map(moduleLabel).join(", "),
    });
  }
  if (restrictions.features.length) {
    rows.push({
      id: "features",
      label: t("user_settings.account.institute.features_label"),
      value: restrictions.features.map(featureLabel).join(", "),
    });
  }
  if (restrictions.external.length) {
    rows.push({
      id: "external",
      label: t("user_settings.account.institute.external_label"),
      value: restrictions.external.map(externalLabel).join(", "),
    });
  }
  // A fixed model already has its own row ("Fixed to …"), so it is not repeated
  // in the list of fixed settings.
  const lockedSettings = restrictions.locks.filter(
    (id) => !(id === "model" && restrictions.model.fixed),
  );
  if (lockedSettings.length) {
    rows.push({
      id: "locks",
      label: t("user_settings.account.institute.locks_label"),
      value: lockedSettings.map(lockLabel).join(", "),
    });
  }
  if (restrictions.ui.length) {
    rows.push({
      id: "ui",
      label: t("user_settings.account.institute.ui_label"),
      value: restrictions.ui.map(uiLabel).join(", "),
    });
  }

  const name = asText(institute?.name, i18n.language) || brand?.name || "";
  const unit = asText(institute?.unit, i18n.language);
  const description = asText(institute?.description, i18n.language);
  const notice = asText(brand?.restrictions?.notice, i18n.language);
  const contact = typeof institute?.contact === "string" ? institute.contact : "";

  return (
    <section
      className="border-t border-base-300 pt-4"
      aria-labelledby="institute-section-title"
      data-guide="institute-section"
    >
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 shrink-0 text-base-content/70" aria-hidden="true" />
        <h3
          id="institute-section-title"
          className="text-sm font-semibold text-base-content"
        >
          {t("user_settings.account.institute.title")}
        </h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-base-content/70">
        {t("user_settings.account.institute.description")}
      </p>

      <div className="mt-3 flex flex-col gap-1">
        {name && <p className="text-sm font-medium text-base-content">{name}</p>}
        {unit && <p className="text-xs text-base-content/70">{unit}</p>}
        {description && (
          <p className="text-xs leading-relaxed text-base-content/70">
            {description}
          </p>
        )}
      </div>

      {notice && (
        <p className="mt-3 rounded-lg border border-base-300 bg-base-200/60 p-3 text-xs leading-relaxed text-base-content/80">
          {notice}
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 rounded-lg border border-base-300 bg-base-200/40 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-base-content">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("user_settings.account.institute.limitations")}
          </p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.id} className="min-w-0" data-institute-limit={row.id}>
                <dt className="text-xs font-medium text-base-content/70">
                  {row.label}
                </dt>
                <dd className="mt-0.5 break-words text-sm text-base-content">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {(links.length > 0 || contact) && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-base-content">
            {t("user_settings.account.institute.links")}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {contact && (
              <li>
                <a
                  href={contact}
                  className="inline-flex items-center gap-1.5 text-xs text-accent underline-offset-2 hover:underline"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t("user_settings.account.institute.contact")}
                </a>
              </li>
            )}
            {links.map((link, index) => {
              const label =
                asText(link.label, i18n.language) ||
                asText(link.title, i18n.language) ||
                link.url;
              const linkDescription = asText(link.description, i18n.language);
              return (
                <li key={link.id ?? `${link.url}-${index}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-xs text-accent underline-offset-2 hover:underline"
                  >
                    <ExternalLink
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {label}
                  </a>
                  {linkDescription && (
                    <span className="ml-5 text-xs text-base-content/70">
                      {linkDescription}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
