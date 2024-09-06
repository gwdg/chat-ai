// components/Arcanas.jsx
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { Trans } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import Skeleton from "react-loading-skeleton"; // Import Skeleton
import "react-loading-skeleton/dist/skeleton.css"; // Import Skeleton styles
import dropdown from "../assets/icon_dropdown.svg";
import { fetchArcanaInfo, createArcana } from "../apis/ArcanaApis";
import { setSelectedArcana } from "../Redux/actions/arcanaSelectAction"; // Action to set selected Arcana

function Arcanas({ notifyError, notifySuccess }) {
  const [arcanas, setArcanas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const selectedArcanaId = useSelector((state) => state.selectedArcana); // Get the selected Arcana by ID
  const isDarkMode = useSelector((state) => state.theme.isDarkMode);

  // Fetch Arcanas only once when the component mounts
  useEffect(() => {
    const fetchArcanas = async () => {
      try {
        setIsLoading(true); // Set loading true only before the first fetch
        const response = await fetchArcanaInfo();
        const fetchedArcanas = response.folders;
        setArcanas(fetchedArcanas);
        setIsLoading(false);

        // Retrieve the stored selection from local storage or default to "No Selection"
        const storedArcanaId = localStorage.getItem("selectedArcanaId");
        if (storedArcanaId && storedArcanaId !== "null") {
          dispatch(setSelectedArcana(storedArcanaId));
        } else {
          dispatch(setSelectedArcana(null)); // No selection initially
        }
      } catch (error) {
        console.error("Error fetching Arcanas:", error);
        notifyError("Error fetching Arcanas");
        setIsLoading(false);
      }
    };

    // Ensure fetch is called only once
    if (isLoading) {
      fetchArcanas();
    }
  }, [dispatch, notifyError, isLoading]);

  // Create a new Arcana and navigate to its details page
  const handleAddArcana = useCallback(async () => {
    if (arcanas.length >= 3) {
      notifyError("You can only create up to 3 Arcanas.");
      return;
    }

    try {
      const newArcana = await createArcana();

      if (newArcana) {
        const response = await fetchArcanaInfo();
        const updatedArcanas = response.folders;
        setArcanas(updatedArcanas);
        dispatch(setSelectedArcana(newArcana.id)); // Set the new arcana by ID
        localStorage.setItem("selectedArcanaId", newArcana.id); // Persist selection
        notifySuccess("Arcana created successfully!");
        navigate(`/collection/${newArcana.name.split(" ")[1]}`);
      }
    } catch (error) {
      console.error("Error creating Arcana:", error);
      notifyError("Error creating Arcana");
    }
  }, [arcanas, dispatch, navigate, notifyError, notifySuccess]);

  // Handle Arcana selection
  const handleArcanaSelect = useCallback(
    (id) => {
      dispatch(setSelectedArcana(id));
      localStorage.setItem("selectedArcanaId", id); // Save selection to local storage
      setIsOpen(false);
    },
    [dispatch]
  );

  // Handle Edit Click
  const handleEditClick = useCallback(() => {
    const selectedArcana = arcanas.find(
      (arcana) => arcana.id === selectedArcanaId
    );
    if (selectedArcana) {
      navigate(`/collection/${selectedArcana.name.split(" ")[1]}`);
    }
  }, [arcanas, selectedArcanaId, navigate]);

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
    <div className="flex gap-2 items-center w-full">
      {isLoading ? (
        // Customized skeleton loader with narrow strips
        <div className="w-full">
          <Skeleton
            height={10}
            count={2}
            baseColor={isDarkMode ? "#3a3a3a" : "#e0e0e0"} // Darker gray for dark mode, lighter gray for light mode
            highlightColor={isDarkMode ? "#525252" : "#f0f0f0"} // Slightly lighter gray for highlight
            className="mb-1"
          />
        </div>
      ) : arcanas.length > 0 ? (
        <>
          <div className="relative w-full flex flex-col" ref={dropdownRef}>
            <div
              className="text-tertiary mt-1 cursor-pointer text-xl w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark flex justify-between items-center"
              onClick={toggleOpen}
            >
              <span>
                {selectedArcanaId === null
                  ? "No Selection"
                  : arcanas.find((arcana) => arcana.id === selectedArcanaId)
                      ?.name || "Select Arcana"}
              </span>
              <img
                src={dropdown}
                alt="dropdown"
                className="h-[30px] w-[30px] cursor-pointer"
              />
            </div>
            {isOpen && (
              <div className="absolute z-50 top-full mt-2 w-full rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark">
                <div
                  className="text-tertiary block text-xl w-full p-2 cursor-pointer"
                  onClick={() => handleArcanaSelect(null)} // Set "No Selection"
                >
                  No Selection
                </div>
                {arcanas.map((arcana) => (
                  <div
                    key={arcana.id}
                    className="text-tertiary block text-xl w-full p-2 cursor-pointer"
                    onClick={() => handleArcanaSelect(arcana.id)}
                  >
                    {arcana.name}
                  </div>
                ))}
              </div>
            )}
          </div>

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

            {selectedArcanaId && (
              <button
                className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none flex gap-2"
                type="button"
                onClick={handleEditClick}
              >
                <Trans i18nKey="description.edit">Edit</Trans>
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-gray-500 dark:text-gray-300">
          No Arcanas available.
        </p>
      )}
    </div>
  );
} 

export default Arcanas;
