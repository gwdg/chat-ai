import SettingsContent from "./SettingsContent";

export default function SettingsPanel({
  localState,
  setLocalState,
  userData,
  modelsData,
  videoQueue,
  videoToolEnabled,
}: {
  localState: any,
  setLocalState: any,
  userData: any,
  modelsData: any,
  videoQueue: any,
  videoToolEnabled: boolean
}) {
  /*
  Small Container for the Desktop Extended Sidebar
  */
  return (
    <div
      className="bg-white dark:bg-bg_secondary_dark
              rounded-xl shadow-md dark:shadow-dark
              overflow-hidden
              w-[30rem] min-w-[15rem] h-full"
    >
      <SettingsContent
        localState={localState}
        setLocalState={setLocalState}
        userData={userData}
        modelsData={modelsData}
        videoQueue={videoQueue}
        videoToolEnabled={videoToolEnabled}
      />
    </div>
  );
}
