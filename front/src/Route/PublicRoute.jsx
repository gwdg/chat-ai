import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";

import Home from "../Pages/Home";
// import CustomInstructions from "../Pages/CustomInstructions";
import Arcana from "../Pages/Arcana";
import ZoomWrapper from "../components/ZoomWrapper";
import { useSelector } from "react-redux";

function PublicRoute() {
  // Assume a condition to check for dark mode; you can replace it with your theme logic
  const isDarkMode = useSelector((state) => state.theme.isDarkMode);

  return (
    <ZoomWrapper>
      {/* Applying scrollbar classes conditionally based on theme */}
      <div
        className={`h-full ${isDarkMode ? "darkScrollbar" : "lightScrollbar"}`}
      >
        <Router>
          <Routes>
            <Route path="*" element={<Navigate to="/" />} />
            <Route exact path="/" element={<Navigate to="/chat" />} />
            <Route exact path="/chat" element={<Home />} />
            {/* <Route
            exact
            path="/custom-instructions"
            element={<CustomInstructions />}
          /> */}
            <Route exact path="/collection/:index" element={<Arcana />} />
          </Routes>
        </Router>
      </div>
    </ZoomWrapper>
  );
}

export default PublicRoute;
