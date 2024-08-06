// components/Arcanas.jsx
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { Trans } from "react-i18next";
import dropdown from "../assets/icon_dropdown.svg";
import { setSelectedArcana } from "../Redux/actions/arcanaSelectAction";
import { setItem, resetArcanas } from "../Redux/actions/arcanaAction";

function Arcanas() {
  const arcanas = useSelector((state) => state.arcana);
  const selectedArcana = useSelector((state) => state.selectedArcana);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const filteredArcanas = useMemo(
    () =>
      arcanas.filter(
        (arcana) =>
          arcana.title || arcana.description || arcana.files.length > 0
      ),
    [arcanas]
  );

  useEffect(() => {
    if (filteredArcanas.length > 0) {
      if (selectedArcana === 0 || selectedArcana > filteredArcanas.length) {
        dispatch(setSelectedArcana(1));
      }
    } else {
      dispatch(setSelectedArcana(0));
      dispatch(resetArcanas());
    }
  }, [filteredArcanas, selectedArcana, dispatch]);

  const handleAddArcana = useCallback(() => {
    const newIndex = arcanas.findIndex(
      (arcana) =>
        !arcana.title && !arcana.description && arcana.files.length === 0
    );
    if (newIndex !== -1 && newIndex < 3) {
      dispatch(
        setItem({
          index: newIndex,
          data: { icon: "", title: "", description: "", files: [] },
        })
      );
      navigate(`/arcana/${newIndex + 1}`);
      dispatch(setSelectedArcana(newIndex + 1));
    }
  }, [arcanas, navigate, dispatch]);

  const handleArcanaSelect = useCallback(
    (index) => {
      dispatch(setSelectedArcana(index + 1));
      setIsOpen(false);
    },
    [dispatch]
  );

  const handleEditClick = useCallback(() => {
    if (filteredArcanas.length > 0) {
      // Ensure the selected arcana is within the valid range
      const validArcanaIndex = Math.max(
        1,
        Math.min(selectedArcana, filteredArcanas.length)
      );
      navigate(`/arcana/${validArcanaIndex}`);
    }
  }, [selectedArcana, filteredArcanas, navigate]);

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
      {filteredArcanas.length > 0 ? (
        <div className="relative w-full flex flex-col" ref={dropdownRef}>
          <div
            className="text-tertiary mt-1 cursor-pointer text-xl w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark flex justify-between items-center"
            onClick={toggleOpen}
          >
            <span> {`Arcana ${selectedArcana}`}</span>
            <img
              src={dropdown}
              alt="dropdown"
              className="h-[30px] w-[30px] cursor-pointer"
            />
          </div>
          {isOpen && (
            <div className="absolute z-50 top-full mt-2 w-full rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark">
              {filteredArcanas.map((arcana, index) => (
                <div
                  key={index}
                  className={`text-tertiary block text-xl w-full p-2 cursor-pointer ${
                    index === 0 ? "rounded-t-2xl" : ""
                  } ${
                    index === filteredArcanas.length - 1 ? "rounded-b-2xl" : ""
                  }`}
                  onClick={() => handleArcanaSelect(index)}
                >
                  {`Arcana ${arcana.id}`}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex gap-2">
        {filteredArcanas.length < 3 && (
          <button
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
            type="button"
            onClick={handleAddArcana}
          >
            <Trans i18nKey="description.add"></Trans>
          </button>
        )}

        {filteredArcanas.length > 0 && selectedArcana > 0 && (
          <button
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none  flex gap-2"
            type="button"
            onClick={handleEditClick}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

export default Arcanas;
