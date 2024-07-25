import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMemo } from "react";
import { Trans } from "react-i18next";

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
      <div className="flex md:flex-row flex-col gap-2 items-center w-full">
        {filteredArcanas.map((arcana, index) => (
          <Link className="w-full" key={index} to={`/arcana/${index + 1}`}>
            <div className="h-[50px] border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark dark:text-white text-black bg-white dark:bg-bg_secondary_dark flex items-center justify-center">
              <p> Arcana {index + 1}</p>
            </div>{" "}
          </Link>
        ))}
        {filteredArcanas.length < 3 && (
          <button
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px]"
            type="button"
            onClick={handleAddArcana}
          >
            <Trans i18nKey="description.add"></Trans>
          </button>
        )}
      </div>
  );
}

export default Arcanas;
