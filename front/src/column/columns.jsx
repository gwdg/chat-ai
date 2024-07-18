import { useTranslation } from "react-i18next";

export const useColumns = () => {
  const { t } = useTranslation();

  const columns = [
    {
      Header: t("description.table_text1"),
      accessor: "index",
    },
    {
      Header: t("description.table_text2"),
      accessor: "name",
    },
    {
      Header: t("description.table_text3"),
      accessor: "uploadDate",
    },
    {
      Header: "Action",
      accessor: "action",
    },
  ];

  return columns;
};
