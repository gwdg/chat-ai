//Arcanas.jsx
import { useState } from "react";
import { Link } from "react-router-dom";

function Arcanas() {
  const [localArcanaList, setLocalArcanaList] = useState([]);

  const addArcanaBlock = () => {
    const newArcana = { id: Date.now(), title: "", description: "", files: [] };
    setLocalArcanaList([...localArcanaList, newArcana]);
  };

  return (
    <div className="home-container">
      {localArcanaList.map((arcana) => (
        <Link key={arcana.id} to={`/arcana/${arcana.id}`}>
          <div className="arcana-block">
            <p>Arcana {arcana.title || `#${arcana.id}`}</p>
          </div>
        </Link>
      ))}
      {localArcanaList.length < 3 && (
        <button className="add-arcana-btn" onClick={addArcanaBlock}>
          +
        </button>
      )}
    </div>
  );
}

export default Arcanas;
