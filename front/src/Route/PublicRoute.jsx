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

function PublicRoute() {
  return (
    <ZoomWrapper>
      <div className="no-scrollbar h-full">
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
            <Route exact path="/arcana/:index" element={<Arcana />} />
          </Routes>
        </Router>
      </div>
    </ZoomWrapper>
  );
}

export default PublicRoute;
