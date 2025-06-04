// utils/appContext.js
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const getAppContext = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const currentConversationId = useSelector(
    (state) => state.conversations.currentConversationId
  );

  return {
    t,
    dispatch,
    searchParams,
    location,
    navigate,
    currentConversationId,
  };
};

export default getAppContext;