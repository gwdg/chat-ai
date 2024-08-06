// Importing necessary modules
import { Form, Formik, useFormik } from "formik"; // Form handling
import * as yup from "yup"; // Schema validation
import { Trans, useTranslation } from "react-i18next"; // Translation
import { Link } from "react-router-dom"; // Navigation

import Layout from "../components/Layout"; // Custom layout component

// Assets
const emptyStar = "/src/assets/star.svg"; // Empty star icon
const filledStar = "/src/assets/filled-star.svg"; // Filled star icon
import dropdown from "../assets/icon_dropdown.svg"; // Dropdown icon
import cross from "../assets/cross.svg"; // Close icon

// Feedback component
function Feedback() {
  // i18n object
  const { t } = useTranslation();

  // Validation schema to validate fields
  const validationSchema = yup.object({
    ratings: yup.number(), // Rating
    title: yup.string().required(() => t("description.feedback1")), // Title
    category: yup.string().required(() => t("description.feedback2")), // Category
    feedback: yup.string().required(() => t("description.feedback3")), // Feedback
  });

  // Feedback options
  const categoryOptions = [
    { value: "Bug", label: t("description.bug") },
    { value: "Suggestion", label: t("description.suggestion") },
    { value: "Other", label: t("description.other") },
  ];

  // Initialising formik variable
  const formik = useFormik({
    initialValues: {
      ratings: 0,
      title: "",
      category: "",
      feedback: "",
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
    },
  });

  return (
    <Layout>
      {/* Feedback component */}
      <div className="h-full flex flex-col md:flex-row overflow-auto mx-auto">
        <div className="flex justify-center w-full">
          <div className="md:p-6 py-4 px-3 border dark:border-border_dark rounded-2xl m-3 md:m-0 shadow-lg dark:shadow-dark bg-white dark:bg-black md:min-w-[700px] h-fit md:w-fit w-full">
            {/* Feedback inputs */}
            <Formik enableReinitialize={true} onSubmit>
              <Form onSubmit={formik.handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    {/* Title and close button */}
                    <p className="md:text-4xl text-3xl text-tertiary">
                      <Trans i18nKey="description.feedback4"></Trans>
                    </p>
                    <Link to={"/chat"} target="">
                      <img
                        src={cross}
                        alt="cross"
                        className="h-[45px] w-[45px] cursor-pointer"
                      />
                    </Link>
                  </div>

                  {/* Ratings */}
                  <div className="flex flex-col gap-[10px]">
                    <label className="dark:text-white text-black">
                      <Trans i18nKey="description.feedback6"></Trans>
                    </label>
                    <div className="flex gap-4 items-center">
                      {[...Array(5)].map((_, i) => {
                        const ratingValue = i + 1;
                        return (
                          <img
                            key={i}
                            src={
                              formik.values.ratings >= ratingValue
                                ? filledStar
                                : emptyStar
                            }
                            onClick={() =>
                              formik.setFieldValue("ratings", ratingValue)
                            }
                            alt="star"
                            className="cursor-pointer w-7 h-7"
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="flex flex-col gap-[10px]">
                    <label className="dark:text-white text-black">
                      <Trans i18nKey="description.feedback7"></Trans>
                    </label>
                    <div className="relative dark:text-white text-black">
                      <select
                        className="block w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-bg_secondary_dark shadow-lg dark:shadow-dark"
                        name="category"
                        value={formik.values.category}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                      >
                        <option value="">
                          <Trans i18nKey="description.feedback10"></Trans>
                        </option>
                        {/* Mapping over category options */}
                        {categoryOptions.map((option) => (
                          <option key={option} value={option}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {/* Dropdown icon */}
                      <div className="absolute right-0 flex items-center pr-[10px] pointer-events-none bottom-2 ">
                        <img
                          src={dropdown}
                          alt="drop-down"
                          className="h-[30px] w-[30px] cursor-pointer"
                        />
                      </div>
                    </div>
                    {/* Display error message if any */}
                    {formik.errors.category && formik.touched.category ? (
                      <p className="text-red-600 text-12-500 ">
                        {formik.errors.category}
                      </p>
                    ) : null}
                  </div>

                  {/* Title */}
                  <div className="flex flex-col gap-[10px]">
                    <label className="dark:text-white text-black">
                      <Trans i18nKey="description.feedback8"></Trans>
                    </label>
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

                  {/* Feedback */}
                  <div className="flex flex-col gap-[10px]">
                    <label className="dark:text-white text-black">
                      <Trans i18nKey="description.feedback9"></Trans>
                    </label>
                    <textarea
                      className="p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark dark:text-white text-black bg-white dark:bg-bg_secondary_dark w-full min-h-[200px]"
                      type="text"
                      name="feedback"
                      placeholder={t("description.feedback12")}
                      value={formik.values.feedback}
                      onBlur={formik.handleBlur}
                      onChange={formik.handleChange}
                    />
                    {/* Display error message if any */}
                    {formik.errors.feedback && formik.touched.feedback ? (
                      <p className="text-red-600 text-12-500 ">
                        {formik.errors.feedback}
                      </p>
                    ) : null}
                  </div>

                  {/* submit */}
                  <div className="flex justify-end w-full">
                    <button
                      className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full  min-w-[150px] select-none "
                      type="submit"
                    >
                      <Trans i18nKey="description.feedback5"></Trans>
                    </button>
                  </div>
                </div>
              </Form>
            </Formik>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Feedback;
