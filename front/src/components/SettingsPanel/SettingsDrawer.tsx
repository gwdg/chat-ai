import { useDispatch, useSelector } from "react-redux";
import SettingsPanel from "./SettingsPanel";
import { selectShowSettings, toggleSettings } from "../../Redux/reducers/interfaceSettingsSlice";
import SettingsContent from "./SettingsContent";

export default function SettingsDrawer({ localState, setLocalState, userData, modelsData }) {
  
  const dispatch = useDispatch();
  const showSettings = useSelector(selectShowSettings);
  return (
    <>
      {/* Backdrop */}
      {showSettings && (
        <div
          className="fixed inset-0 z-30 backdrop-blur-sm bg-black/5 dark:bg-gray/30  transition-opacity"
          onClick={() => dispatch(toggleSettings())} // clicking backdrop closes drawer
        />
      )}

      {/* Drawer */}
      {/* height is: screenheight-header_size which is h-14 */}
      <div
        id="sidebardrawer"
        className={`fixed w-[80vw] md:w-[55vw] max-w-md top-0 right-0 pt-0 md:pt-4 z-40 h-dvh overflow-y-auto transition-transform duration-200
          ${showSettings ? "translate-x-0" : "translate-x-full"} 
          bg-white dark:bg-bg_secondary_dark shadow-lg `}
      >
        <SettingsContent localState={localState} setLocalState={setLocalState}  userData={userData} modelsData={modelsData} />
      </div>
    </>
  );
}
