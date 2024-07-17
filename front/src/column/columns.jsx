// src/column/columns.js
import React from "react";

export const useColumns = () =>
  React.useMemo(
    () => [
      {
        Header: "Index",
        accessor: "index",
      },
      {
        Header: "Name",
        accessor: "name",
      },
      {
        Header: "Date of Upload",
        accessor: "uploadDate",
      },
      {
        Header: "Action",
        accessor: "action",
      },
    ],
    []
  );
