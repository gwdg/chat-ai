import { Trans } from "react-i18next";
import { useModal } from "../../modals/ModalContext"; 
import icon_share_white from "../../assets/icons/share_white.svg";

export default function ShareSettingsButton({ localState, setLocalState}) {
    const { openModal } = useModal();
    // ==== SHARING FUNCTIONALITY ====

    // Generate and copy shareable settings URL
    const handleShareSettings = () => {
        // Validate system prompt exists
        if (!localState.settings.systemPrompt) {
        notifyError("System prompt is missing");
        return;
        }

        try {
        // Prepare settings object for sharing
        const settings = {
            systemPrompt: encodeURIComponent(localState.settings.systemPrompt),
            ["model-name"]: localState.settings["model-name"],
            model: localState.settings.model,
            temperature:
            localState.settings.temperature !== undefined &&
            localState.settings.temperature !== null
                ? Number(localState.settings.temperature)
                : null,
            top_p:
            localState.settings.top_p !== undefined &&
            localState.settings.top_p !== null
                ? Number(localState.settings.top_p)
                : null,
            // Include arcana settings if enabled
            ...(localState.exportOptions.exportArcana &&
            isArcanaSupported && {
                arcana: {
                id: localState.arcana.id,
                // key: localState.arcana.key,
                },
            }),
        };

        // Validate all settings are defined
        if (Object.values(settings).some((value) => value === undefined)) {
            throw new Error("Invalid settings detected");
        }

        // Convert settings to base64 URL
        const settingsString = JSON.stringify(settings);
        const encodedSettings = btoa(settingsString);

        const baseURL = window.location.origin;
        const url = `${baseURL}/chat?settings=${encodedSettings}`;

        // Copy URL to clipboard
        navigator.clipboard
            .writeText(url)
            .then(() => {
            notifySuccess("URL copied successfully");
            })
            .catch((err) => {
            console.error("Failed to copy text: ", err);
            notifyError("Failed to copy URL to clipboard");
            });

        setModalShareSettings(false);
        } catch (error) {
        console.error("Error generating settings URL:", error);
        notifyError("Failed to generate settings URL");
        }
    };

    // Handle share settings modal display
    // TODO use this to handle dont show again
    const handleShareSettingsModal = () => {
        // Check if user has chosen to not show the modal again
        if (localState.dontShow.dontShowAgainShare) {
        handleShareSettings();
        } else {
        setModalShareSettings(true);
        }
    };

    return (
    <button
        className="text-white p-3 bg-green-600 hover:bg-green-550 active:bg-green-700 dark:border-border_dark rounded-lg justify-center items-center md:w-fit shadow-lg dark:shadow-dark border select-none flex gap-2"
        type="reset"
        onClick={() => openModal("shareSettings")}
    >
        {/* <ShareSettingsModal
            isOpen={modalShareSettings}
            onClose={() => setModalShareSettings(false)}
            arcana={localState.arcana}
            exportArcana={localState.exportOptions.exportArcana}
            showModal={setModalShareSettings}
            handleShareSettings={handleShareSettings}
            dontShowAgainShare={localState.dontShow.dontShowAgainShare}
            setLocalState={setLocalState}
            isArcanaSupported={(localState.settings.model?.input?.includes("arcana") || false)}
        /> */}
        <div className="hidden desktop:block text-sm">
        <Trans i18nKey="description.custom9" />
        </div>
        <img
        src={icon_share_white}
        alt="share_icon"
        className="hidden desktop:block h-[16px] w-[16px] cursor-pointer"
        />
        <img
        src={icon_share_white}
        alt="share_icon"
        className="block desktop:hidden h-[20px] w-[20px] cursor-pointer"
        />
    </button>
    )
}