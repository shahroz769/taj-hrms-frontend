import { Loader2 } from "lucide-react";
import styles from "./data-table.module.css";

const DataTable = ({ columns, data, onEdit, onDelete, isLoading, isError }) => {
  if (isLoading) {
    return (
      <div className={styles.stateContainer}>
        <Loader2 className={styles.loader} />
        <p className={styles.stateText}>Loading departments...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>Error loading departments. Please try again.</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.stateContainer}>
        <p className={styles.stateText}>No departments found.</p>
      </div>
    );
  }

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
                    : styles.tableHeader
                }
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={styles.tableBody}>
          {data.map((row) => (
            <tr key={row._id || row.id} className={styles.tableRow}>
              {columns.map((column, index) => {
                if (column.key === "actions") {
                  return (
                    <td key={index} className={styles.tableCellRight}>
                      <div className={styles.actionsContainer}>
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
                            className={styles.actionButtonDelete}
                            onClick={() => onDelete(row)}
                          >
                            {column.renderDelete(row)}
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
