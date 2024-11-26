// Arcana.jsx
import { useRef, useEffect, useState, useCallback } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify"; // Import toast and ToastContainer
import "react-toastify/dist/ReactToastify.css"; // Import toastify CSS for styling
import Layout from "../components/Layout/Layout";
import cross from "../assets/cross.svg";
import books from "../assets/icons_arcana/books.svg";
import filesIcon from "../assets/icons_arcana/files.svg";
import notes from "../assets/icons_arcana/notes.svg";
import personal from "../assets/icons_arcana/personal.svg";
import reports from "../assets/icons_arcana/reports.svg";
import studies from "../assets/icons_arcana/studies.svg";
import work from "../assets/icons_arcana/work.svg";
import FilesTable from "../components/Arcanas/FilesTable";
import Help_Model from "../model/Help_Model";
import { getArcana, deleteArcana, buildArcana } from "../apis/ArcanaApis"; // Import buildArcana function
import { useSelector } from "react-redux";
import Delete_Arcana_Model from "../model/Delete_Arcana_Model";

const icons = [
  { name: "Books", icon: books },
  { name: "Files", icon: filesIcon },
  { name: "Notes", icon: notes },
  { name: "Personal", icon: personal },
  { name: "Reports", icon: reports },
  { name: "Studies", icon: studies },
  { name: "Work", icon: work },
];

function Arcana() {
  const { t } = useTranslation();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showHelpModel, setShowHelpModel] = useState(false);
  const [showDeleteModel, setShowDeleteModel] = useState(false);

  const popupRef = useRef(null);
  const { index } = useParams();
  const folderName = `Arcana ${index}`;
  const navigate = useNavigate();
  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  let toastClass = isDarkModeGlobal ? "dark-toast" : "light-toast";

  const [arcanaDetails, setArcanaDetails] = useState({
    icon: icons[0].name,
    name: folderName,
    files: [],
  });

  const [selectedIcon, setSelectedIcon] = useState(icons[0].icon);
  const [selectedIconName, setSelectedIconName] = useState(icons[0].name);

  // Fetch the folder details when the component loads
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const details = await getArcana(folderName);
        setArcanaDetails(details);
        setSelectedIcon(
          icons.find((icon) => icon.name === details.icon)?.icon ||
            icons[0].icon
        );
        setSelectedIconName(
          icons.find((icon) => icon.name === details.icon)?.name ||
            icons[0].name
        );
      } catch (error) {
        console.error("Error fetching Arcana details:", error);
        toast.error("Failed to fetch Arcana details.", {
          className: toastClass,
          autoClose: 1000,
        });
      }
    };

    // Fetch details if the index is valid
    if (index > 0 && index <= 3) {
      fetchDetails();
    }
  }, [folderName, index]);

  // Handle delete action
  const handleDelete = useCallback(async () => {
    try {
      await deleteArcana(folderName);
      navigate("/arcanas");
    } catch (error) {
      console.error("Error deleting Arcana:", error);
      toast.error("Failed to delete Arcana.", {
        className: toastClass,
        autoClose: 1000,
        onClose: () => {
          setShowDeleteModel(false);
        },
      });
    }
  }, [folderName, navigate]);

  // Handle the build operation
  const handleBuild = useCallback(async () => {
    try {
      const success = await buildArcana(folderName);
      if (success) {
        toast.success("Arcana built successfully!", {
          className: toastClass,
          autoClose: 1000,
        });
      }
    } catch (error) {
      if (error.message === "Indexing already in progress") {
        toast.warn("Indexing already in progress, please wait.", {
          className: toastClass,
          autoClose: 1000,
        });
      } else {
        toast.error("Error building Arcana: " + error.message, {
          className: toastClass,
          autoClose: 1000,
        });
      }
    }
  }, [folderName, toastClass]);

  const handleIconClick = useCallback((icon) => {
    setSelectedIcon(icon.icon);
    setSelectedIconName(icon.name);
    setIsPopupOpen(false);
  }, []);

  const togglePopup = useCallback(() => {
    setIsPopupOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setIsPopupOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <Layout>
      <div className="h-full flex flex-col md:flex-row overflow-auto mx-auto">
        <div className="flex justify-center w-full">
          <div className="md:p-6 py-4 px-3 border dark:border-border_dark rounded-2xl md:ml-4 md:mb-4 m-4 shadow-lg dark:shadow-dark bg-white dark:bg-black md:min-w-[700px] h-fit w-full">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex gap-4 items-center">
                    <div className="relative flex gap-4 items-center">
                      <img
                        src={selectedIcon}
                        alt="Selected Icon"
                        className="w-12 h-12 cursor-pointer"
                        onClick={togglePopup}
                      />
                      <p className="md:text-4xl text-3xl text-tertiary">
                        {arcanaDetails.name}
                      </p>
                      {isPopupOpen && (
                        <div
                          ref={popupRef}
                          className="absolute top-14 left-0 z-10 bg-bg_light dark:bg-bg_dark border border-gray-300 p-4 rounded-2xl shadow-lg"
                        >
                          <div className="grid grid-cols-3 gap-4">
                            {icons.map((icon) => (
                              <img
                                key={icon.name}
                                src={icon.icon}
                                alt={icon.name}
                                className="w-12 h-12 cursor-pointer"
                                onClick={() => handleIconClick(icon)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Link to="/arcanas">
                      <img src={cross} alt="cross" className="h-[30px]" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Render FilesTable with the correct folderName */}
              <div className="flex flex-col gap-2">
                <FilesTable
                  folderName={arcanaDetails.name}
                  filesFromAPI={arcanaDetails.files}
                />
              </div>

              <div className="flex flex-col md:flex-row justify-between gap-2 items-center w-full">
                <button
                  className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
                  type="button"
                  onClick={() => setShowHelpModel(true)}
                >
                  <Trans i18nKey="description.help"></Trans>
                </button>
                <div className="flex flex-col md:flex-row md:gap-4 gap-2 items-center">
                  <button
                    className="text-white p-3 bg-red-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
                    type="button"
                    onClick={() => setShowDeleteModel(true)}
                  >
                    Delete Arcana
                  </button>
                  <button
                    className="text-white p-3 bg-blue-500 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
                    type="button"
                    onClick={handleBuild}
                  >
                    <Trans i18nKey="description.build">Build Arcana</Trans>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />

      {showDeleteModel ? (
        <Delete_Arcana_Model
          showModel={setShowDeleteModel}
          handleDelete={handleDelete}
        />
      ) : null}
      {showHelpModel ? <Help_Model showModel={setShowHelpModel} /> : null}
    </Layout>
  );
}

export default Arcana;
