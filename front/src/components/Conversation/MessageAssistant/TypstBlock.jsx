import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { selectRenderTypst } from "../../../Redux/reducers/userSettingsReducer";
import { grantWasmConsent } from "../../../hooks/useWasmConsent";
import { downloadSvg, renderedFilename } from "../../../utils/download";
import Code from "./Code";
import RenderToolbar from "./RenderToolbar";
import {
  TYPST_DOWNLOAD_MB,
  TypstDocumentView,
  useTypstDocument,
} from "./TypstDocument";
import WasmDownloadPrompt from "./WasmDownloadPrompt";

const TypstBlock = memo(
  ({ content, language = "typst", defaultRender = true }) => {
    const { t } = useTranslation();
    const renderTypst = useSelector(selectRenderTypst);
    const [showCode, setShowCode] = useState(!(defaultRender && renderTypst));
    // The compiler, its consent prompt and the shared SVG cache live in
    // TypstDocument, so a workspace file and a fenced block that show the same
    // source compile once and ask once.
    const { svg, loading, error, consent } = useTypstDocument(
      content,
      !showCode,
    );

    useEffect(() => {
      setShowCode(!(defaultRender && renderTypst));
    }, [defaultRender, renderTypst]);

    const codeContent = String(content || "").replace(/\n$/, "");

    return (
      <div className="relative my-2">
        <RenderToolbar
          showCode={showCode}
          onToggle={() => setShowCode((prev) => !prev)}
          renderLabel={t("conversation.typst_block.render")}
          showCodeLabel={t("conversation.typst_block.show_code")}
          onDownload={
            !showCode && svg
              ? () => downloadSvg(svg, renderedFilename("typst", "svg"))
              : undefined
          }
          downloadLabel={t("conversation.download_rendered")}
        />

        {showCode ? (
          <div className="pt-3">
            <Code language={language}>{codeContent}</Code>
          </div>
        ) : !consent && codeContent.trim() ? (
          <WasmDownloadPrompt
            feature={t("wasm_download.feature_typst")}
            sizeMb={TYPST_DOWNLOAD_MB}
            onConfirm={() => grantWasmConsent("typst")}
            onCancel={() => setShowCode(true)}
          />
        ) : error ? (
          <div className="pt-3 p-2 text-error">
            {t("typst.render_error")}
            <pre className="mt-2 text-xs bg-base-200 p-2 rounded overflow-x-auto">
              {codeContent}
            </pre>
          </div>
        ) : loading && !svg ? (
          <div className="pt-3 p-2">{t("typst.rendering")}</div>
        ) : svg ? (
          <div className="mt-2 overflow-x-auto rounded-lg bg-base-100 p-4 text-base-content">
            <TypstDocumentView svg={svg} />
          </div>
        ) : (
          <div className="pt-3" />
        )}
      </div>
    );
  },
);

TypstBlock.displayName = "TypstBlock";

export default TypstBlock;
