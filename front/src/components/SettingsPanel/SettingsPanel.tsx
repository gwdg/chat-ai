import { useDispatch } from "react-redux";

import { toggleSettings, toggleSidebar } from "../../Redux/reducers/interfaceSettingsSlice";
import SettingsContent from "./SettingsContent";

export default function SettingsPanel({ localState, setLocalState, userData, modelsData }: { localState: any, setLocalState: any, userData: any, modelsData: any }) {
  /*
  Small Container for the Desktop Extended Sidebar
  */
  return (
    <div
      className="bg-white dark:bg-bg_secondary_dark
              rounded-xl shadow-md dark:shadow-dark
              overflow-hidden
              w-[30rem] min-w-[15rem]"
    >
      <SettingsContent localState={localState} setLocalState={setLocalState} userData={userData} modelsData={modelsData} />
    </div>
  );
}
