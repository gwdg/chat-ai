import { useRef, useEffect, useState } from "react";
import { useFormik } from "formik";
import * as yup from "yup";
import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Layout from "../components/Layout";
import cross from "../assets/cross.svg";
import edit_icon from "../assets/edit_icon.svg";
import { useDispatch, useSelector } from "react-redux";
import {
  setIcon,
  setTitle,
  setDescription,
  setFiles,
} from "../Redux/actions/arcanaAction";
import books from "../assets/icons_arcana/books.svg";
import filesIcon from "../assets/icons_arcana/files.svg";
import notes from "../assets/icons_arcana/notes.svg";
import personal from "../assets/icons_arcana/personal.svg";
import reports from "../assets/icons_arcana/reports.svg";
import studies from "../assets/icons_arcana/studies.svg";
import work from "../assets/icons_arcana/work.svg";
import FilesTable from "../components/FilesTable";
import Help_Model from "../model/Help_Modal";

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
  const [isEditing, setIsEditing] = useState(false);
  const [showHelpModel, setShowHelpModel] = useState(false);

  const popupRef = useRef(null);
  const { index } = useParams();
  const arcanaIndex = parseInt(index, 10) - 1;
  const dispatch = useDispatch();
  const arcanas = useSelector((state) => state.arcana);
  const arcana = arcanas[arcanaIndex] || {
    icon: icons[0].name,
    title: "",
    description: "",
    files: [],
  };
  const validationSchema = yup.object({
    title: yup.string().required(() => t("description.arcana_req_title")),
    description: yup
      .string()
      .required(() => t("description.arcana_req_description")),
  });
  const [selectedIcon, setSelectedIcon] = useState(
    icons.find((icon) => icon.name === arcana.icon)?.icon || icons[0].icon
  );
  const [selectedIconName, setSelectedIconName] = useState(
    icons.find((icon) => icon.name === arcana.icon)?.name || icons[0].name
  );
  const isDarkMode = useSelector((state) => state.theme.isDarkMode);
  const toastClass = isDarkMode ? "dark-toast" : "light-toast";
  const navigate = useNavigate();

  const formik = useFormik({
    initialValues: {
      title: arcana.title || "",
      description: arcana.description || "",
    },
    validationSchema: validationSchema,
    onSubmit: () => {
      // Handle form submission
    },
  });

  useEffect(() => {
    if (arcanaIndex !== undefined) {
      dispatch(setIcon({ index: arcanaIndex, icon: selectedIconName }));
    }
  }, [selectedIconName, arcanaIndex, dispatch]);

  useEffect(() => {
    if (arcanaIndex !== undefined) {
      dispatch(setTitle({ index: arcanaIndex, title: formik.values.title }));
    }
  }, [formik.values.title, arcanaIndex, dispatch]);

  useEffect(() => {
    if (arcanaIndex !== undefined) {
      dispatch(
        setDescription({
          index: arcanaIndex,
          description: formik.values.description,
        })
      );
    }
  }, [formik.values.description, arcanaIndex, dispatch]);

  useEffect(() => {
    if (arcanaIndex !== undefined) {
      dispatch(setFiles({ index: arcanaIndex, files: arcana.files }));
    }
  }, [arcana.files, arcanaIndex, dispatch]);

  const handleIconClick = (icon) => {
    dispatch(setIcon({ index: arcanaIndex, icon: icon.name }));
    setSelectedIcon(icon.icon);
    setSelectedIconName(icon.name);
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

  const notifySuccess = (message) =>
    toast.success(message, {
      autoClose: 200,
      className: toastClass,
      onClose: () => {
        navigate("/chat");
      },
    });

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
                      {" "}
                      <img
                        src={selectedIcon}
                        alt="Selected Icon"
                        className="w-12 h-12 cursor-pointer"
                        onClick={togglePopup}
                      />
                      <p className="md:text-4xl text-3xl text-tertiary">
                        Arcana {arcanaIndex + 1}
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
                    <Link to="/arcana">
                      <img src={cross} alt="cross" className="h-[30px]" />
                    </Link>
                  </div>
                </div>
              </div>
              <form onSubmit={formik.handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 ">
                    <label className="dark:text-white text-black">
                      <Trans i18nKey="description.arcana_title"></Trans>
                    </label>
                    <input
                      className="p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark dark:text-white text-black bg-white dark:bg-bg_secondary_dark w-full"
                      type="text"
                      name="title"
                      placeholder={t("description.arcana_enter_title")}
                      value={formik.values.title}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    {formik.touched.title && formik.errors.title ? (
                      <p className="text-red-500">{formik.errors.title}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 ">
                    <label className="dark:text-white text-black">
                      <Trans i18nKey="description.arcana_description"></Trans>
                    </label>
                    <textarea
                      className="p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark dark:text-white text-black bg-white dark:bg-bg_secondary_dark w-full"
                      name="description"
                      placeholder={t("description.arcana_enter_description")}
                      value={formik.values.description}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    {formik.touched.description && formik.errors.description ? (
                      <p className="text-red-500">
                        {formik.errors.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 ">
                    <FilesTable
                      arcanaIndex={arcanaIndex}
                      isEditing={isEditing}
                    />
                  </div>
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
                        onClick={toggleEdit}
                      >
                        <Trans i18nKey="description.save"></Trans>
                      </button>
                    ) : null}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div>
        <ToastContainer />
      </div>
      <div>
        <ToastContainer />
      </div>
      <ToastContainer />{" "}
      {showHelpModel ? <Help_Model showModal={setShowHelpModel} /> : null}
    </Layout>
  );
}

export default Arcana;
