// components/Arcanas.jsx
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { Trans } from "react-i18next";
import dropdown from "../assets/icon_dropdown.svg";
import { fetchArcanaInfo, createArcana } from "../apis/ArcanaApis";

function Arcanas() {
  const [arcanas, setArcanas] = useState([]);
  const [selectedArcana, setSelectedArcana] = useState(null); // Updated to store the selected arcana
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchArcanas = async () => {
      try {
        const response = await fetchArcanaInfo();
        const fetchedArcanas = response.folders;
        setArcanas(fetchedArcanas); // Directly setting the fetched folders

        if (fetchedArcanas.length > 0) {
          setSelectedArcana(fetchedArcanas[0]); // Set the first arcana as selected initially
        }
      } catch (error) {
        console.error("Error fetching Arcanas:", error);
      }
    };

    fetchArcanas();
  }, []);

  // Create a new Arcana and navigate to its details page
  const handleAddArcana = useCallback(async () => {
    if (arcanas.length >= 3) {
      alert("You can only create up to 3 Arcanas.");
      return;
    }

    try {
      const newArcana = await createArcana();

      // If creation is successful, refetch arcanas and select the newly added one
      if (newArcana) {
        const response = await fetchArcanaInfo();
        const updatedArcanas = response.folders;
        setArcanas(updatedArcanas);
        navigate(
          `/collection/${
            updatedArcanas
              .find((a) => a.name === newArcana.name)
              .name.split(" ")[1]
          }`
        );
      }
    } catch (error) {
      console.error("Error creating Arcana:", error);
    }
  }, [arcanas, navigate]);

  // Select an Arcana from the list
  const handleArcanaSelect = useCallback((arcana) => {
    setSelectedArcana(arcana);
    setIsOpen(false);
  }, []);

  // Navigate to edit the selected arcana
  const handleEditClick = useCallback(() => {
    if (selectedArcana) {
      navigate(`/collection/${selectedArcana.name.split(" ")[1]}`); // Navigate using the exact arcana number
    }
  }, [selectedArcana, navigate]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex md:flex-row flex-col gap-2 items-center w-full">
      {arcanas.length > 0 && (
        <div className="relative w-full flex flex-col" ref={dropdownRef}>
          <div
            className="text-tertiary mt-1 cursor-pointer text-xl w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark flex justify-between items-center"
            onClick={toggleOpen}
          >
            <span>
              {selectedArcana ? selectedArcana.name : "Select Arcana"}
            </span>
            <img
              src={dropdown}
              alt="dropdown"
              className="h-[30px] w-[30px] cursor-pointer"
            />
          </div>
          {isOpen && (
            <div className="absolute z-50 top-full mt-2 w-full rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark">
              {arcanas.map((arcana) => (
                <div
                  key={arcana.id}
                  className="text-tertiary block text-xl w-full p-2 cursor-pointer"
                  onClick={() => handleArcanaSelect(arcana)}
                >
                  {arcana.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {(arcanas.length === 0 || arcanas.length < 3) && (
          <button
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
            type="button"
            onClick={handleAddArcana}
          >
            <Trans i18nKey="description.add">Add Arcana</Trans>
          </button>
        )}

        {selectedArcana && (
          <button
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none flex gap-2"
            type="button"
            onClick={handleEditClick}
          >
            <Trans i18nKey="description.edit">Edit</Trans>
          </button>
        )}
      </div>
    </div>
  );
}

export default Arcanas;
