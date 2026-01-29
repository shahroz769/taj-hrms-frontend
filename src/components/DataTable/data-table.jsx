import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import styles from "./data-table.module.css";

const DataTable = ({
  columns,
  data,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  isLoading,
  isError,
  loadingText = "Loading data...",
}) => {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead className={styles.tableHead}>
          <tr className={styles.tableHeadRow}>
            {columns.map((column, index) => (
              <th
                key={index}
                className={
                  column.align === "right"
                    ? styles.tableHeaderRight
                    : column.align === "center"
                      ? styles.tableHeaderCenter
                      : styles.tableHeader
                }
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={styles.tableBody}>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className={styles.stateCell}>
                <div className={styles.stateContainer}>
                  <Spinner className={styles.loader} />
                  <p className={styles.stateText}>{loadingText}</p>
                </div>
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={columns.length} className={styles.stateCell}>
                <div className={styles.errorContainer}>
                  <p className={styles.errorText}>
                    Error loading data. Please try again.
                  </p>
                </div>
              </td>
            </tr>
          ) : !data || data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.stateCell}>
                <div className={styles.stateContainer}>
                  <p className={styles.stateText}>No data found.</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row._id || row.id} className={styles.tableRow}>
                {columns.map((column, index) => {
                  if (column.key === "actions") {
                    return (
                      <td
                        key={index}
                        className={
                          column.align === "center"
                            ? styles.tableCellCenter
                            : styles.tableCellRight
                        }
                      >
                        <div
                          className={
                            column.align === "center"
                              ? styles.actionsContainerCenter
                              : styles.actionsContainer
                          }
                        >
                          {onEdit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className={styles.actionButton}
                                  onClick={() => onEdit(row)}
                                >
                                  {column.renderEdit(row)}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {onDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className={styles.actionButton}
                                  onClick={() => onDelete(row)}
                                >
                                  {column.renderDelete(row)}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {onApprove &&
                            column.renderApprove &&
                            column.renderApprove(row) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className={styles.actionButton}
                                    onClick={() => onApprove(row)}
                                  >
                                    {column.renderApprove(row)}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Approve</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          {onReject &&
                            column.renderReject &&
                            column.renderReject(row) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className={styles.actionButton}
                                    onClick={() => onReject(row)}
                                  >
                                    {column.renderReject(row)}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Reject</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={index}
                      className={
                        column.fontWeight === "medium"
                          ? styles.tableCellMedium
                          : styles.tableCell
                      }
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
