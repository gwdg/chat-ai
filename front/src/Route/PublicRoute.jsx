import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";

import Home from "../Pages/Home";
import CustomInstructions from "../Pages/CustomInstructions";
import Arcana from "../Pages/Arcana";

function PublicRoute() {
  return (
    <div className="no-scrollbar">
      <Router>
        <Routes>
          {/* Redirect any unknown paths to the home page */}
          <Route path="*" element={<Navigate to="/" />} />
          {/* Home page */}
          <Route exact path="/" element={<Navigate to="/chat" />} />
          <Route exact path="/chat" element={<Home />} />
          {/* Custom instructions page */}
          <Route
            exact
            path="/custom-instructions"
            element={<CustomInstructions />}
          />
          {/* List all Arcana entries */}
          <Route exact path="/arcana/:id" element={<Arcana />} />{" "}
          {/* Single Arcana entry by ID */}
        </Routes>
      </Router>
    </div>
  );
}

export default PublicRoute;
