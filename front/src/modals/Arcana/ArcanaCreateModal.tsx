import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trans } from "react-i18next";

import BaseModal from "../BaseModal";
import { arcanasProvider, refreshArcanas } from "../../workspace/arcanas";

/**
 * Create one saia-rag collection.
 *
 * The service creates the collection for the caller, who becomes its owner.
 * A shared collection cannot be created here (sharing happens afterwards), so
 * the name and an optional description are the only inputs. The description is
 * stored with the collection, so the agent can tell what it is for when it
 * chooses between several.
 */
export default function ArcanaCreateModal({
  isOpen,
  onClose,
  notifySuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  notifySuccess?: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const trimmed = name.trim();

  const create = async () => {
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    try {
      await arcanasProvider().createCollection(trimmed, description.trim());
      await refreshArcanas();
      notifySuccess?.(t("arcanas.created", { name: trimmed }));
      setName("");
      setDescription("");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      titleKey="arcanas.create_title"
      maxWidth="max-w-md"
    >
      <p className="mb-3 text-xs text-base-content/70">
        <Trans i18nKey="arcanas.create_hint" />
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label className="form-control w-full">
          <span className="mb-1 block text-xs font-medium">
            {t("arcanas.name_label")}
          </span>
          <input
            className="input input-sm w-full"
            autoFocus
            value={name}
            placeholder={t("arcanas.name_placeholder")}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="form-control w-full">
          <span className="mb-1 block text-xs font-medium">
            {t("arcanas.description_label")}
          </span>
          <textarea
            className="textarea textarea-sm w-full text-xs"
            rows={2}
            maxLength={280}
            value={description}
            placeholder={t("arcanas.description_placeholder")}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />
          <span className="mt-1 block text-[11px] text-base-content/60">
            {t("arcanas.description_hint")}
          </span>
        </label>
        {error && <p className="text-xs text-error">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={busy}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!trimmed || busy}
          >
            {busy ? t("arcanas.creating") : t("arcanas.create")}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
