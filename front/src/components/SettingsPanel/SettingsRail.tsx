import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faChevronLeft, faPlus, faSearch, faEdit, faGear } from "@fortawesome/free-solid-svg-icons";
import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import {
  selectDarkMode,
  selectShowSettings,
  selectShowSidebar,
  toggleSidebar,
} from "../../Redux/reducers/interfaceSettingsSlice";

import ChatAiLogo from "../../assets/logos/chat_ai.svg";
import ChatAiLogoMini from "../../assets/logos/chat_ai_small.ico";
import { useDispatch, useSelector } from "react-redux";
import { createConversation } from "../../db";
import { useNavigate } from "react-router";
import {
  getDefaultConversation,
  getDefaultSettings,
} from "../../utils/conversationUtils";

import { Sidebar } from "lucide-react";
import { useWindowSize } from "../../hooks/useWindowSize";

import gwdgLogoSmall from "../../assets/logos/gwdg_sm.png";
import kisskiLogoSmall from "../../assets/logos/kisski_sm.png";

import gwdgLogo from "../../assets/logos/gwdg.png";
import kisskiLogo from "../../assets/logos/kisski.png";
import LanguageSelector from "../Footer/LanguageSelector";
import ThemeToggle from "../Header/ThemeToggle";
import UserContainer from "../Header/UserContainer";
import WarningExternalModel from "../Header/WarningExternalModel";
import VideoQueueRailButton from "./VideoQueueRailButton";

export default function SidebarRail({localState, setLocalState, userData, modelsData, onOpen, videoQueue, videoToolEnabled, onOpenVideoQueue }: { localState: any; setLocalState: any; userData: any; modelsData: any; onOpen: () => void; videoQueue: any; videoToolEnabled: boolean; onOpenVideoQueue: () => void }) {

  const { isTouch } = useWindowSize();
  return (
    <div
      className="bg-white dark:bg-bg_secondary_dark
              rounded-xl shadow-md
              overflow-hidden
              "
    >
      <div className="h-full flex flex-col items-center gap-2">
          

          <div className="mt-2 mb-2 flex flex-col gap-3 items-center">
            
            {/*<Settings Toggle />*/}
            <button
              onClick={() => onOpen?.()}
              className="h-10 w-10 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer"
              title="Expand"
            >
              <FontAwesomeIcon size="xl" className="text-tertiary" icon={faGear} />
            </button>

            {/* User profile  */}
            <UserContainer
              localState={localState}
              setLocalState={setLocalState}
              userData={userData}
              modelsData={modelsData}
            />

            <WarningExternalModel localState={localState} userData={userData} />
            <VideoQueueRailButton videoQueue={videoQueue} enabled={videoToolEnabled} onOpen={onOpenVideoQueue} />
          </div>
          {/** 
          <div id="placeholder" className="group flex-1 w-full hover:bg-light_hover dark:hover:bg-dark_hover cursor-pointer grid place-items-center"
            onClick={() => onOpen?.()}
          >
            <button
              className={`
                translate-y-[-10vh]
                h-10 w-10 inset-0 grid place-items-center rounded-xl
                transition duration-200 opacity-0 
                group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-dark_hover cursor-pointer
                ${isTouch ? "opacity-100" : "opacity-0"}`}
              title="Expand"
            >
              <FontAwesomeIcon size="xl" className=" text-tertiary" icon={faChevronLeft} />
            </button>
          </div>*/}
          
          {/* <div className="mt-2 items-center flex flex-col gap-2 mx-1 pb-2 p-1 ">
            {/* Logo 
            <img
              className="h-10 w-10 object-contain"
              src={gwdgLogoSmall}
              alt="Chat AI Logo"
            />
            <img
              className="h-10 w-10 object-contain"
              src={kisskiLogoSmall}
              alt="Chat AI Logo"
            />
          </div>*/}        
          
          
        </div>
      
    </div>
  );
}
