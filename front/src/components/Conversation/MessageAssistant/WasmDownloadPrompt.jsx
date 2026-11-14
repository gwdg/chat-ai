import { useTranslation } from "react-i18next";

const formatSize = (sizeMb) =>
  Number(sizeMb).toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function WasmDownloadPrompt({
  feature,
  sizeMb,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <p className="font-medium text-warning">
        {t("wasm_download.title", { feature })}
      </p>
      <p className="mt-1 text-base-content/80">
        {t("wasm_download.body")}
      </p>
      <p className="mt-2 font-semibold text-base-content">
        {t("wasm_download.size", { size: formatSize(sizeMb) })}
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-sm" onClick={onCancel}>
          {t("wasm_download.keep_code")}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-warning"
          onClick={onConfirm}
        >
          {t("wasm_download.confirm")}
        </button>
      </div>
    </div>
  );
}
