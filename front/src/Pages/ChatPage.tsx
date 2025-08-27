
import { useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  getDefaultConversation,
} from "../utils/conversationUtils";

import { useSyncConversation } from "../hooks/useSyncConversation";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { useWindowSize } from "../hooks/useWindowSize";

import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import ModelSelectorWrapper from "../components/Header/ModelSelectorWrapper";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import Header from "../components/Header/Header";
import SettingsWrapper from "../components/SettingsPanel/SettingsWrapper";
import Conversation from "../components/Conversation/Conversation";
import { useEffect, useState } from "react";
import { setCurrentConversation } from "../Redux/reducers/currentConversationSlice";

import { Navigate, useNavigate } from "react-router";

import { validate as validateUUID, version as versionUUID } from "uuid";
function validateConversationId(conversationId: string): boolean {
  return validateUUID(conversationId) && versionUUID(conversationId) === 4;
}

export default function ChatPage() {
  const { conversationId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isMobile } = useWindowSize();

  if(conversationId !== undefined && !validateConversationId(conversationId)) {
    console.error("Invalid conversationId:", conversationId);
    navigate("/notfound");
    return <div>Invalid conversation ID. Redirecting...</div>; // as a Fallback: this will actually not render due to the navigate
  }

  const [localState, setLocalState] = useState(() => getDefaultConversation());

  useSyncConversation({
    localState,
    setLocalState,
    conversationId,
  });


  useEffect(() => {
    if (conversationId) {
      dispatch(setCurrentConversation(conversationId));
    }
  }, [conversationId]);

  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();


  return (
    <div className={`h-[calc(100%-55px)] min-h-screen overflow-hidden 
                  grid 
                  grid-cols-1 grid-rows-[auto_1fr_auto]
                  md:grid-cols-[auto_1fr_auto] md:grid-rows-[1fr_auto]
                  md:gap-x-6 gap-y-1 md:pt-1
                  bg-gray-100 dark:bg-bg_dark`}
    >
      <Header
        className="md:hidden"
        localState={localState}
        setLocalState={setLocalState}
        modelsData={modelsData}
        userData={userData}
      />
      
      {/* Sidebar left */}
      <SidebarWrapper 
        localState={localState} 
        setLocalState={setLocalState} 
        userData={userData} 
        modelsData={modelsData} 
      />

      {/* Conversation */}
      <Conversation
        localState={localState}
        setLocalState={setLocalState}
        userData={userData}
        modelsData={modelsData}
      />

      {/* Sidebar right*/}
      <SettingsWrapper 
        localState={localState}
        setLocalState={setLocalState}
        userData={userData}
        modelsData={modelsData}
      />
      {/*<SidebarRight
        localState={localState}
        setLocalState={setLocalState}
        userData={userData}
        modelsData={modelsData}
      /> */}
      

      <CollapsibleFooter className="row-start-3 col-span-full"/>
    </div>
  );
}
