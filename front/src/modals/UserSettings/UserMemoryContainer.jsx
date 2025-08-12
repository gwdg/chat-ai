import { selectAllMemories } from "../../Redux/reducers/userMemorySlice";
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
                className="w-full sm:max-w-[200px] p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
                onClick={() => openModal("userMemory", { localState })}
                >
                <span className="text-sm">🧠</span>
                <span className="text-sm">
                    <Trans i18nKey="description.settings.manageMemory" defaultValue="Manage Memory" />
                </span>
                <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">
                    {memories.length}
                </span>
                </button>
            </div>
        </div>
    )
}