// src/column/columns.js
import React from "react";
import { useTranslation } from "react-i18next";

export const useColumns = () => {
  const { t } = useTranslation();
  return React.useMemo(
    () => [
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
    ],
    [t]
  );
};
