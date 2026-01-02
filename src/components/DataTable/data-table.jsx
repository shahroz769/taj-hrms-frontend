import { Spinner } from "@/components/ui/spinner";
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
                  <p className={styles.stateText}>Loading shifts...</p>
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
                            <button
                              className={styles.actionButton}
                              onClick={() => onEdit(row)}
                            >
                              {column.renderEdit(row)}
                            </button>
                          )}
                          {onDelete && (
                            <button
                              className={styles.actionButton}
                              onClick={() => onDelete(row)}
                            >
                              {column.renderDelete(row)}
                            </button>
                          )}
                          {onApprove && column.renderApprove && column.renderApprove(row) && (
                            <button
                              className={styles.actionButton}
                              onClick={() => onApprove(row)}
                            >
                              {column.renderApprove(row)}
                            </button>
                          )}
                          {onReject && column.renderReject && column.renderReject(row) && (
                            <button
                              className={styles.actionButton}
                              onClick={() => onReject(row)}
                            >
                              {column.renderReject(row)}
                            </button>
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
