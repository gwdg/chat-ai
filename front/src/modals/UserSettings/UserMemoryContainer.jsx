import { selectAllMemories } from "../../Redux/reducers/userSettingsReducer";
import { useSelector, useDispatch } from "react-redux";
import { useModal } from "../ModalContext"; 
import { Trans, useTranslation } from "react-i18next";

export default function UserMemoryContainer ({localState}) {
    const memories = useSelector(selectAllMemories);
    const { openModal } = useModal();

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <p className="text-sm font-medium dark:text-white">
                <Trans i18nKey="description.settings.userMemory" defaultValue="User Memory" />
                </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                <Trans
                i18nKey="description.settings.userMemoryDescription"
                defaultValue="Manage your personal memories..."
                values={{ count: memories.length }}
                />
            </p>
            <div className="w-full flex justify-center">
                <button
                    className="w-full sm:max-w-[240px] px-5 py-3
                            bg-blue-700 hover:bg-blue-800
                            text-white font-medium rounded-lg
                            flex items-center justify-center gap-2
                            shadow-md hover:shadow-lg
                            active:scale-95 transition-all duration-200 text-sm"
                    onClick={() => openModal("userMemory", { localState })}
                >
                    {/* Icon */}
                    <span className="text-base leading-none">🧠</span>

                    {/* Label */}
                    <span>
                    <Trans
                        i18nKey="description.settings.manageMemory"
                        defaultValue="Manage Memory"
                    />
                    </span>

                    {/* Counter badge */}
                    <span className="text-xs bg-blue-500 px-2 py-0.5 rounded-full font-semibold shadow-inner">
                    {memories.length}
                    </span>
                </button>
            </div>
        </div>
    )
}