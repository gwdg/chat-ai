// Importing necessary modules
import { Form, Formik, useFormik } from "formik"; // Form handling
import { Trans, useTranslation } from "react-i18next"; // Translation
import { Link, useNavigate } from "react-router-dom"; // Navigation
import * as yup from "yup"; // Schema validation
import Slider from "@mui/material/Slider"; // Slider component
import "react-toastify/dist/ReactToastify.css"; // Toast styling

import Layout from "../components/Layout"; // Custom layout component
import cross from "../assets/cross.svg"; // Close icon
import { useDispatch, useSelector } from "react-redux"; // Redux hooks
import { setInstructions } from "../Redux/actions/customInsAction"; // Redux action
import { useState } from "react"; // State management
import { setTemperatureGlobal } from "../Redux/actions/temperatureAction"; // Redux action
import { persistor } from "../Redux/store/store";
import Clear_Cache_Model from "../model/Clear_Cache_Model";
import { useToast } from "../hooks/useToast";

// CustomInstructions component
function CustomInstructions() {
  // i18n object
  const { t } = useTranslation();

  // Redux state selectors
  const customInstructions = useSelector((state) => state.instructions);
  const temperatureGlobal = useSelector((state) => state.temperature);
  const { notifySuccess } = useToast();

  // State for temperature
  const [temperature, setTemperature] = useState(temperatureGlobal);
  const [showCacheModel, setShowCacheModel] = useState(false);

  // Dispatch function
  const dispatch = useDispatch();

  // Navigation function
  const navigate = useNavigate();

  // Validation schema for form fields
  const validationSchema = yup.object({
    instructions: yup.string().required(() => t("description.custom6")),
  });

  // Formik form initialization
  const formik = useFormik({
    initialValues: {
      instructions: customInstructions,
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      // Dispatching action to update custom instructions
      dispatch(setInstructions(values.instructions));
      // navigate("/chat");
      navigate("/chat", { state: { from: "/custom-instructions" } });
    },
  });

  // Function to handle temperature change
  const handleChange = (event, newValue) => {
    setTemperature(newValue);
    dispatch(setTemperatureGlobal(newValue));
  };

  const resetDefault = () => {
    setTemperature(1);
    formik.setFieldValue("instructions", "You are a helpful assistant");
    dispatch(setTemperatureGlobal(1));
    dispatch(setInstructions("You are a helpful assistant"));
  };

  const clearCache = () => {
    persistor.purge();
    notifySuccess("Catch cleared successfully");
  };

  return (
    <Layout>
      {/* Custom instructions component */}
      <div className="h-full flex flex-col md:flex-row overflow-auto mx-auto">
        <div className="flex justify-center w-full">
          <div className="md:p-6 py-4 px-3 border dark:border-border_dark rounded-2xl md:ml-4 md:mb-4 m-4 shadow-lg dark:shadow-dark bg-white dark:bg-black md:min-w-[700px] h-fit md:w-fit w-full">
            <Formik enableReinitialize={true} onSubmit>
              <Form onSubmit={formik.handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    {/* Section title and close button */}
                    <div className="flex items-center justify-between">
                      <p className="md:text-4xl text-3xl text-tertiary">
                        <Trans i18nKey="description.custom1"></Trans>
                      </p>
                      <Link to={"/chat"} target="">
                        <img
                          src={cross}
                          alt="cross"
                          className="h-[45px] w-[45px] cursor-pointer"
                        />
                      </Link>
                    </div>

                    {/* Instruction hint */}
                    <p className="text-red-600">
                      <Trans i18nKey="description.custom2"></Trans>
                    </p>
                  </div>

                  {/* Temperature slider */}
                  <div className="flex flex-col gap-[10px]">
                    <label className="dark:text-white text-black">
                      <Trans i18nKey="description.temperature"></Trans>
                    </label>
                    <div className="px-2">
                      {" "}
                      <Slider
                        aria-label="Temperature"
                        defaultValue={1}
                        value={temperature}
                        onChange={handleChange}
                        valueLabelDisplay="auto"
                        shiftStep={20}
                        step={0.1}
                        marks
                        min={0}
                        max={2}
                      />
                    </div>
                  </div>

                  {/* Custom instructions input*/}
                  <div className="flex flex-col gap-[10px]">
                    <label className="dark:text-white text-black">
                      <Trans i18nKey="description.custom3"></Trans>
                    </label>
                    <textarea
                      className="p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark dark:text-white text-black bg-white dark:bg-bg_secondary_dark w-full min-h-[350px]"
                      type="text"
                      name="instructions"
                      placeholder={t("description.custom4")}
                      value={formik.values.instructions}
                      onBlur={formik.handleBlur}
                      onChange={formik.handleChange}
                    />
                    {/* Display error message if any */}
                    {formik.errors.instructions &&
                    formik.touched.instructions ? (
                      <p className="text-red-600 text-12-500 ">
                        {formik.errors.instructions}
                      </p>
                    ) : null}
                  </div>

                  {/* Submit button */}
                  <div className="flex flex-col md:flex-row justify-end gap-2 items-center w-full">
                    {/* Opens clear cache model */}
                    <button
                      className="text-white p-3 bg-red-600 dark:border-border_dark  rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
                      type="reset"
                      onClick={() => {
                        setShowCacheModel(true);
                      }}
                    >
                      <Trans i18nKey="description.custom8"></Trans>
                    </button>
                    {/* Resets settings, and clears redux */}
                    <button
                      className="text-black p-3 bg-bg_reset_default dark:border-border_dark  rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
                      onClick={resetDefault}
                      type="reset"
                    >
                      <Trans i18nKey="description.custom7"></Trans>
                    </button>
                    {/* Applies changes */}
                    <button
                      className="text-white p-3 bg-tertiary dark:border-border_dark  rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
                      type="submit"
                    >
                      <Trans i18nKey="description.custom5"></Trans>
                    </button>
                  </div>
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
        {showCacheModel ? (
          <Clear_Cache_Model
            showModel={setShowCacheModel}
            clearCache={clearCache}
          />
        ) : null}
      </div>
    </Layout>
  );
}

export default CustomInstructions;
