import { useEffect, useRef, useState } from "react";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { abortRequest } from "../../apis/chatCompletions";
import { useToast } from "../../hooks/useToast";
import icon_attach from "../../assets/icons/attach.svg";
import { useAttachments } from "../../hooks/useAttachments";
//Assets
import { Paperclip, FilePlus2, CirclePlus } from "lucide-react";

export default function AttachButton({
    localState, 
    setLocalState,
}) {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();
    const hiddenFileInput = useRef(null);

    const { addAttachments } = useAttachments();

    const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;

    // Trigger file input click
    const handleClick = () => {
        hiddenFileInput.current.value = null;
        hiddenFileInput.current.click();
    };

    // Handle text and CSV file uploads
    const handleFilesChange = async (e) => {
        addAttachments({
            localState,
            setLocalState,
            selectedFiles: e.target.files,
        });
    };


    return (
        <>
            
            {/* Attach button */}
            <Tooltip text={t("description.attachFile")}>
                {/* Hidden file input for attachments */}
                <input
                    type="file"
                    ref={hiddenFileInput}
                    multiple
                    //accept=".txt, .csv, .pdf, .md, .xlsx, .xls, .docx, .py, .js, .java, .cpp, .c, .h, .cs, .rb, .php, .go, .rs, .swift, .kt, .ts, .jsx, .tsx, .html, .json, .tex, .xml, .yaml, .yml, .ini, .toml, .properties, .css, .scss, .sass, .less, .sh, .ps1, .pl, .lua, .r, .m, .mat, .asm, .sql, .ipynb, .rmd, .dockerfile, .proto, .cfg, .bat, */*"
                    onChange={handleFilesChange}
                    className="hidden"
                />
                <Paperclip
                    className="cursor-pointer flex h-[25px] w-[25px] text-[#009EE0]"
                    onClick={handleClick}
                    disabled={loading}
                    alt="upload"
                />
            </Tooltip>
        </>
    );
}