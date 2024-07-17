// Importing necessary modules
import { Form, Formik, useFormik } from "formik"; // Form handling
import { Trans, useTranslation } from "react-i18next"; // Translation
import { Link, useNavigate } from "react-router-dom"; // Navigation
import * as yup from "yup"; // Schema validation
import Slider from "@mui/material/Slider"; // Slider component
import { ToastContainer, toast } from "react-toastify"; // Toast notifications
import "react-toastify/dist/ReactToastify.css"; // Toast styling

import React, { useRef, useEffect, useState } from "react";
import Layout from "../components/Layout";
import cross from "../assets/cross.svg"; // Close icon
import edit_icon from "../assets/edit_icon.svg"; // Edit icon
import { useDispatch, useSelector } from "react-redux"; // Redux hooks

import books from "../assets/icons_aracana/books.svg";
import files from "../assets/icons_aracana/files.svg";
import notes from "../assets/icons_aracana/notes.svg";
import personal from "../assets/icons_aracana/personal.svg";
import reports from "../assets/icons_aracana/reports.svg";
import studies from "../assets/icons_aracana/studies.svg";
import work from "../assets/icons_aracana/work.svg";
import FilesTable from "../components/FilesTable";

const icons = [
  { name: "Books", icon: books },
  { name: "Files", icon: files },
  { name: "Notes", icon: notes },
  { name: "Personal", icon: personal },
  { name: "Reports", icon: reports },
  { name: "Studies", icon: studies },
  { name: "Work", icon: work },
];

function Arcana() {
  // i18n object
  const { t } = useTranslation();
  const [selectedIcon, setSelectedIcon] = useState(icons[0].icon);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const popupRef = useRef(null);

  const handleIconClick = (icon) => {
    setSelectedIcon(icon);
    setIsPopupOpen(false);
  };

  const togglePopup = () => {
    setIsPopupOpen(!isPopupOpen);
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // Event listener for closing popup when clicking outside
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

  // Redux state selectors
  const isDarkMode = useSelector((state) => state.theme.isDarkMode);

  //Theme for toast
  let toastClass = isDarkMode ? "dark-toast" : "light-toast";

  // Navigation function
  const navigate = useNavigate();

  // Validation schema for form fields
  const validationSchema = yup.object({
    title: yup.string().required(() => t("description.custom6")),
    description: yup.string().required(() => t("description.custom6")),
  });

  // Toast notification function for success
  const notifySuccess = (message) =>
    toast.success(message, {
      autoClose: 200,
      className: toastClass,
      onClose: () => {
        navigate("/chat");
        location.reload();
      },
    });

  // Formik form initialization
  const formik = useFormik({
    initialValues: {
      title: "",
      description: "",
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      // Dispatching action to update custom description
    },
  });

  return (
    <Layout>
      {/* Custom description component */}
      <div className="h-full flex flex-col md:flex-row overflow-auto mx-auto">
        <div className="flex justify-center w-full">
          <div className="md:p-6 py-4 px-3 border dark:border-border_dark rounded-2xl md:ml-4 md:mb-4 m-4 shadow-lg dark:shadow-dark bg-white dark:bg-black md:min-w-[700px] h-fit w-full">
            <Formik enableReinitialize={true} onSubmit>
              <Form onSubmit={formik.handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    {/* Section title and close button */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 items-center">
                        <div className="relative flex gap-4 items-center">
                          <img
                            src={selectedIcon}
                            alt="Selected Icon"
                            className="w-12 h-12 cursor-pointer"
                            onClick={togglePopup}
                          />{" "}
                          <p className="md:text-4xl text-3xl text-tertiary">
                            Arcana 1
                          </p>
                          {!isEditing ? (
                            <img
                              src={edit_icon}
                              alt="edit_icon"
                              onClick={toggleEdit}
                              className="h-[30px] w-[30px] cursor-pointer"
                            />
                          ) : null}
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
                                    className="w-12 h-12 cursor-pointer transition-transform transform hover:scale-110"
                                    onClick={() => handleIconClick(icon.icon)}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Link to={"/chat"} target="">
                        <img
                          src={cross}
                          alt="cross"
                          className="h-[45px] w-[45px] cursor-pointer"
                        />
                      </Link>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[10px] max-w-[400px]">
                    <label className="dark:text-white text-black">Title</label>
                    <input
                      className="p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark dark:text-white text-black bg-white dark:bg-bg_secondary_dark w-full"
                      type="text"
                      name="title"
                      placeholder={t("description.feedback11")}
                      value={formik.values.title}
                      onBlur={formik.handleBlur}
                      onChange={formik.handleChange}
                    />
                    {/* Display error message if any */}
                    {formik.errors.title && formik.touched.title ? (
                      <p className="text-red-600 text-12-500 ">
                        {formik.errors.title}
                      </p>
                    ) : null}
                  </div>
                  {/* Custom description input*/}
                  <div className="flex flex-col gap-[10px] max-w-[400px]">
                    <label className="dark:text-white text-black">
                      Description
                    </label>
                    <textarea
                      className="p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark dark:text-white text-black bg-white dark:bg-bg_secondary_dark w-full"
                      type="text"
                      name="description"
                      placeholder={t("description.custom4")}
                      value={formik.values.description}
                      onBlur={formik.handleBlur}
                      onChange={formik.handleChange}
                    />
                    {/* Display error message if any */}
                    {formik.errors.description && formik.touched.description ? (
                      <p className="text-red-600 text-12-500 ">
                        {formik.errors.description}
                      </p>
                    ) : null}
                  </div>
                  <FilesTable isEditing={isEditing} />
                  {/* Submit button */}
                  {isEditing ? (
                    <div className="flex flex-col md:flex-row justify-end gap-2 items-center w-full">
                      <button
                        className="text-white p-3 bg-tertiary dark:border-border_dark  rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px]"
                        type="submit"
                        onClick={toggleEdit}
                      >
                        Save
                      </button>
                    </div>
                  ) : null}
                </div>
              </Form>
            </Formik>
          </div>
        </div>
      </div>
      {/* Toast container for notifications */}
      <div>
        <ToastContainer />
      </div>

      {/* Pop-up clear cache*/}
      <div className="">
        {/* {showCacheModel ? (
          <Clear_Catch_Model
            showModal={setShowCacheModel}
            clearCatch={clearCatch}
          />
        ) : null} */}
      </div>
    </Layout>
  );
}

export default Arcana;
