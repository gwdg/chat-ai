//Arcana.jsx

import { Form, Formik, useFormik } from "formik";
import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as yup from "yup";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useRef, useEffect, useState } from "react";
import Layout from "../components/Layout";
import cross from "../assets/cross.svg";
import edit_icon from "../assets/edit_icon.svg";
import { useSelector } from "react-redux";

import books from "../assets/icons_arcana/books.svg";
import files from "../assets/icons_arcana/files.svg";
import notes from "../assets/icons_arcana/notes.svg";
import personal from "../assets/icons_arcana/personal.svg";
import reports from "../assets/icons_arcana/reports.svg";
import studies from "../assets/icons_arcana/studies.svg";
import work from "../assets/icons_arcana/work.svg";
import FilesTable from "../components/FilesTable";
import Help_Model from "../model/Help_Modal";

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
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isDarkMode = useSelector((state) => state.theme.isDarkMode);

  const [selectedIcon, setSelectedIcon] = useState(icons[0].icon);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showHelpModel, setShowHelpModel] = useState(false);
  const [localFiles, setLocalFiles] = useState([]);

  const popupRef = useRef(null);

  useEffect(() => {
    if (arcana) {
      setSelectedIcon(arcana.icon || icons[0].icon);
      setLocalFiles(arcana.files || []);
    }
  }, [arcana]);

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

  let toastClass = isDarkMode ? "dark-toast" : "light-toast";

  const validationSchema = yup.object({
    title: yup.string().required(() => t("description.arcana_req_title")),
    description: yup
      .string()
      .required(() => t("description.arcana_req_description")),
  });

  const notifySuccess = (message) =>
    toast.success(message, {
      autoClose: 200,
      className: toastClass,
      onClose: () => {
        navigate("/arcanas");
      },
    });

  const handleFileUpload = (file) => {
    setLocalFiles((prevFiles) => [...prevFiles, file]);
  };

  const handleDeleteFile = (fileIndex) => {
    setLocalFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== fileIndex)
    );
  };

  const formik = useFormik({
    initialValues: {
      title: arcana ? arcana.title : "",
      description: arcana ? arcana.description : "",
    },
    validationSchema: validationSchema,
    onSubmit: (values) => {
      notifySuccess("Arcana updated successfully!");
      toggleEdit();
    },
  });

  return (
    <Layout>
      <div className="h-full flex flex-col md:flex-row overflow-auto mx-auto">
        <div className="flex justify-center w-full">
          <div className="md:p-6 py-4 px-3 border dark:border-border_dark rounded-2xl md:ml-4 md:mb-4 m-4 shadow-lg dark:shadow-dark bg-white dark:bg-black md:min-w-[700px] h-fit w-full">
            <Formik enableReinitialize={true} onSubmit={formik.handleSubmit}>
              <Form onSubmit={formik.handleSubmit}>
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
                            {arcana ? arcana.title : "New Arcana"}
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
                      <Link to={"/arcanas"} target="">
                        <img
                          src={cross}
                          alt="cross"
                          className="h-[45px] w-[45px] cursor-pointer"
                        />
                      </Link>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[10px] max-w-[400px]">
                    <label className="dark:text-white text-black">
                      <Trans i18nKey="description.arcana_title"></Trans>
                    </label>
                    <input
                      className="p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark dark:text-white text-black bg-white dark:bg-bg_secondary_dark w-full"
                      type="text"
                      name="title"
                      placeholder={t("description.arcana_enter_title")}
                      value={formik.values.title}
                      onBlur={formik.handleBlur}
                      onChange={formik.handleChange}
                      disabled={!isEditing}
                    />
                    {formik.errors.title && formik.touched.title ? (
                      <p className="text-red-600 text-12-500 ">
                        {formik.errors.title}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-[10px] max-w-[400px]">
                    <label className="dark:text-white text-black">
                      <Trans i18nKey="description.arcana_enter_description"></Trans>
                    </label>
                    <textarea
                      className="p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark dark:text-white text-black bg-white dark:bg-bg_secondary_dark w-full"
                      type="text"
                      name="description"
                      placeholder={t("description.arcana_enter_description")}
                      value={formik.values.description}
                      onBlur={formik.handleBlur}
                      onChange={formik.handleChange}
                      disabled={!isEditing}
                    />
                    {formik.errors.description && formik.touched.description ? (
                      <p className="text-red-600 text-12-500 ">
                        {formik.errors.description}
                      </p>
                    ) : null}
                  </div>
                  <FilesTable
                    files={localFiles}
                    onUpload={handleFileUpload}
                    onDelete={handleDeleteFile}
                    isEditing={isEditing}
                  />
                  <div className="flex flex-col md:flex-row justify-between gap-2 items-center w-full">
                    <button
                      className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px]"
                      type="button"
                      onClick={() => setShowHelpModel(true)}
                    >
                      <Trans i18nKey="description.help"></Trans>
                    </button>
                    {isEditing ? (
                      <button
                        className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px]"
                        type="submit"
                      >
                        <Trans i18nKey="description.save"></Trans>
                      </button>
                    ) : null}
                  </div>
                </div>
              </Form>
            </Formik>
          </div>
        </div>
      </div>
      <div>
        <ToastContainer />
      </div>
      <div className="">
        {showHelpModel ? <Help_Model showModal={setShowHelpModel} /> : null}
      </div>
    </Layout>
  );
}

export default Arcana;
