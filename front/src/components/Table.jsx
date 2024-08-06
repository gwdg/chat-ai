import { useTable } from "react-table";
import { useColumns } from "../column/columns";
import icon_delete from "../assets/delete_icon.svg";

const Table = ({ data, handleDeleteFile, isEditing }) => {
  const columns = useColumns(); // Get the columns

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data });

  return (
    <div className="relative">
      <div className="rounded-2xl border dark:border-border_dark shadow-lg bg-white dark:bg-black dark:text-white text-black w-full max-h-[300px] overflow-hidden">
        <div className="overflow-y-auto max-h-[250px] no-scrollbar">
          <table {...getTableProps()} className="w-full table-fixed">
            <thead className="bg-white dark:bg-black dark:border-border_dark border-b sticky top-0 z-10">
              {headerGroups.map((headerGroup, headerGroupIndex) => (
                <tr
                  {...headerGroup.getHeaderGroupProps()}
                  key={"headerGroup" + headerGroupIndex}
                  className="text-gray-700 dark:text-white"
                >
                  {headerGroup.headers.map((column, columnIndex) => {
                    if (column.id === "action") {
                      return (
                        <th
                          {...column.getHeaderProps()}
                          key={"header" + columnIndex}
                          className="px-4 py-2 border-b text-left"
                        ></th>
                      ); // Skip rendering action header if not editing
                    }
                    return (
                      <th
                        {...column.getHeaderProps()}
                        key={"header" + columnIndex}
                        className="px-4 py-2 border-b text-left"
                      >
                        {column.render("Header")}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody
              {...getTableBodyProps()}
              className="bg-white dark:bg-gray-900"
            >
              {rows.map((row, rowIndex) => {
                prepareRow(row);
                return (
                  <tr
                    {...row.getRowProps()}
                    key={rowIndex}
                    className="bg-bg_light dark:bg-bg_dark"
                  >
                    {row.cells.map((cell, cellIndex) => {
                      if (cell.column.id === "action") {
                        return (
                          <td
                            {...cell.getCellProps()}
                            key={cellIndex}
                            className="border-b dark:border-border_dark p-2"
                          >
                            {
                              <button
                                onClick={() => handleDeleteFile(rowIndex)}
                                type="button"
                              >
                                <img
                                  className="cursor-pointer h-5 w-5"
                                  src={icon_delete}
                                  alt="Delete"
                                />
                              </button>
                            }
                          </td>
                        );
                      } else {
                        return (
                          <td
                            {...cell.getCellProps()}
                            key={cellIndex}
                            className="border-b dark:border-border_dark p-4 overflow-hidden whitespace-nowrap truncate"
                          >
                            {cell.render("Cell")}
                          </td>
                        );
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length > 3 && (
        <div className="rounded-b-2xl absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-black to-transparent"></div>
      )}
    </div>
  );
};

export default Table;
