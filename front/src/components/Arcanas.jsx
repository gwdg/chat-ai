import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMemo } from "react";

function Arcanas() {
  const arcanas = useSelector((state) => state.arcana);

  // Memoize filteredArcanas
  const filteredArcanas = useMemo(
    () =>
      arcanas.filter(
        (arcana) =>
          arcana.title || arcana.description || arcana.files.length > 0
      ),
    [arcanas]
  );

  const navigate = useNavigate();

  const handleAddArcana = () => {
    // Redirect to the next arcana index if there are less than 3
    if (filteredArcanas.length < 3) {
      navigate(`/arcana/${filteredArcanas.length + 1}`);
    }
  };

  return (
      <div className="p-6">
        <h1 className="text-3xl mb-4">Arcanas</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredArcanas.map((arcana, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 border rounded-lg shadow-md p-4"
            >
              <Link
                to={`/arcana/${index + 1}`}
                className="text-blue-500 text-lg font-semibold"
              >
                Arcana {index + 1}
              </Link>
            </div>
          ))}
          {filteredArcanas.length < 3 && (
            <div
              className="bg-white dark:bg-gray-800 border rounded-lg shadow-md p-4 flex items-center justify-center"
              onClick={handleAddArcana}
              role="button"
            >
              <button className="bg-blue-500 text-white p-2 rounded">+</button>
            </div>
          )}
        </div>
      </div>
  );
}

export default Arcanas;
