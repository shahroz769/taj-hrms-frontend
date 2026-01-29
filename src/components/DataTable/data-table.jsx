import { useCallback, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
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
  selectable = false,
  selectedIds = [],
  onSelectionChange,
}) => {
  // Calculate total columns including checkbox column
  const totalColumns = selectable ? columns.length + 1 : columns.length;

  // Memoize selection state calculations
  const { allSelected, someSelected } = useMemo(() => {
    const all = data && data.length > 0 && selectedIds.length === data.length;
    const some =
      selectedIds.length > 0 && selectedIds.length < (data?.length || 0);
    return { allSelected: all, someSelected: some };
  }, [data, selectedIds]);

  // Memoized handler for select all toggle
  const handleSelectAll = useCallback(
    (checked) => {
      if (onSelectionChange) {
        if (checked) {
          const allIds = data.map((row) => row._id || row.id);
          onSelectionChange(allIds);
        } else {
          onSelectionChange([]);
        }
      }
    },
    [data, onSelectionChange],
  );

  // Memoized handler for individual row toggle
  const handleRowSelect = useCallback(
    (rowId, checked) => {
      if (onSelectionChange) {
        if (checked) {
          onSelectionChange((prev) => [...prev, rowId]);
        } else {
          onSelectionChange((prev) => prev.filter((id) => id !== rowId));
        }
      }
    },
    [onSelectionChange],
  );

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead className={styles.tableHead}>
          <tr className={styles.tableHeadRow}>
            {selectable && (
              <th
                className={styles.tableHeaderCenter}
                style={{ width: "50px" }}
              >
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={handleSelectAll}
                  className="data-[state=checked]:bg-[#02542D] data-[state=checked]:border-[#02542D]"
                />
              </th>
            )}
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
              <td colSpan={totalColumns} className={styles.stateCell}>
                <div className={styles.stateContainer}>
                  <Spinner className={styles.loader} />
                  <p className={styles.stateText}>{loadingText}</p>
                </div>
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={totalColumns} className={styles.stateCell}>
                <div className={styles.errorContainer}>
                  <p className={styles.errorText}>
                    Error loading data. Please try again.
                  </p>
                </div>
              </td>
            </tr>
          ) : !data || data.length === 0 ? (
            <tr>
              <td colSpan={totalColumns} className={styles.stateCell}>
                <div className={styles.stateContainer}>
                  <p className={styles.stateText}>No data found.</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const rowId = row._id || row.id;
              const isSelected = selectedIds.includes(rowId);
              return (
                <tr key={rowId} className={styles.tableRow}>
                  {selectable && (
                    <td
                      className={styles.tableCellCenter}
                      style={{ width: "50px" }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleRowSelect(rowId, checked)
                        }
                        className="data-[state=checked]:bg-[#02542D] data-[state=checked]:border-[#02542D]"
                      />
                    </td>
                  )}
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
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
