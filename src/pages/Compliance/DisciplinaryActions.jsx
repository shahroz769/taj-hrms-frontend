// React
import React, { useEffect, useMemo, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import PencilIcon from "lucide-react/dist/esm/icons/pencil";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import ToggleLeftIcon from "lucide-react/dist/esm/icons/toggle-left";
import ToggleRightIcon from "lucide-react/dist/esm/icons/toggle-right";
import TrashIcon from "lucide-react/dist/esm/icons/trash";
import { toast } from "sonner";

// Components
import DataTable from "@/components/DataTable/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Services
import {
  createDisciplinaryAction,
  deleteDisciplinaryAction,
  fetchDisciplinaryActions,
  toggleDisciplinaryActionStatus,
  updateDisciplinaryAction,
} from "@/services/disciplinaryActionsApi";
import { fetchWarningTypesList } from "@/services/warningTypesApi";
import { fetchEmployeesList } from "@/services/employeesApi";

// Utils
import { formatDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";

// Styles
import styles from "./DisciplinaryActions.module.css";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Truncate description to first 2 words + ellipsis for table display.
 */
const truncateDescription = (text) => {
  if (!text) return "-";
  const words = text.trim().split(/\s+/);
  if (words.length <= 2) return text;
  return words.slice(0, 2).join(" ") + "...";
};

// ============================================================================
// COMPONENT
// ============================================================================

const DisciplinaryActions = () => {
  // ===========================================================================
  // URL SEARCH PARAMS
  // ===========================================================================
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialLimit = () => {
    const urlLimit = searchParams.get("limit");
    return urlLimit ? Number(urlLimit) : 10;
  };

  const getInitialPage = () => {
    const urlPage = searchParams.get("page");
    return urlPage ? Number(urlPage) : 1;
  };

  const getInitialSearch = () => {
    return searchParams.get("search") || "";
  };

  // ===========================================================================
  // STATE
  // ===========================================================================
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingAction, setEditingAction] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAction, setDeletingAction] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);

  // Form state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedWarningTypeId, setSelectedWarningTypeId] = useState("");
  const [actionDate, setActionDate] = useState(undefined);
  const [description, setDescription] = useState("");
  const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Toggle state
  const [togglingActionId, setTogglingActionId] = useState(null);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    if (searchValue !== "") {
      setPage(1);
    }
  }, [debouncedSearch, searchValue]);

  useEffect(() => {
    const params = {};
    if (limit !== 10) params.limit = limit.toString();
    if (page !== 1) params.page = page.toString();
    if (debouncedSearch) params.search = debouncedSearch;
    setSearchParams(params, { replace: true });
  }, [limit, page, debouncedSearch, setSearchParams]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Fetch Disciplinary Actions
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "disciplinary-actions",
      { limit, page, search: debouncedSearch },
    ],
    queryFn: () =>
      fetchDisciplinaryActions({ limit, page, search: debouncedSearch }),
  });

  // ---------------------------------------------------------------------------
  // Fetch Employees List (for combobox)
  // ---------------------------------------------------------------------------
  const { data: employeesData } = useQuery({
    queryKey: ["employees-list"],
    queryFn: fetchEmployeesList,
    enabled: dialogOpen,
  });

  // ---------------------------------------------------------------------------
  // Fetch Warning Types List (for dropdown)
  // ---------------------------------------------------------------------------
  const { data: warningTypesData } = useQuery({
    queryKey: ["warning-types-list"],
    queryFn: fetchWarningTypesList,
    enabled: dialogOpen,
  });

  const employeesList = useMemo(
    () => employeesData?.employees || [],
    [employeesData],
  );
  const warningTypesList = useMemo(
    () => warningTypesData || [],
    [warningTypesData],
  );

  // ---------------------------------------------------------------------------
  // Create Mutation
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: createDisciplinaryAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disciplinary-actions"] });
      resetForm();
      setDialogOpen(false);
      toast.success("Disciplinary action reported successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to report disciplinary action";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateDisciplinaryAction(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disciplinary-actions"] });
      resetForm();
      setDialogOpen(false);
      toast.success("Disciplinary action updated successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message ||
        "Failed to update disciplinary action";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deleteDisciplinaryAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disciplinary-actions"] });
      setDeleteDialogOpen(false);
      setDeletingAction(null);
      toast.success("Disciplinary action deleted successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message ||
        "Failed to delete disciplinary action";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Toggle Status Mutation
  // ---------------------------------------------------------------------------
  const toggleMutation = useMutation({
    mutationFn: toggleDisciplinaryActionStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disciplinary-actions"] });
      setTogglingActionId(null);
      toast.success("Status toggled successfully");
    },
    onError: (error) => {
      setTogglingActionId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to toggle status";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "employeeName",
      label: "Employee Name",
      fontWeight: "medium",
      render: (row) => row.employee?.fullName || "-",
    },
    {
      key: "employeeID",
      label: "Employee ID",
      render: (row) => row.employee?.employeeID || "-",
    },
    {
      key: "warningType",
      label: "Warning Type",
      render: (row) => row.warningType?.name || "-",
    },
    {
      key: "severity",
      label: "Severity",
      render: (row) => {
        const severity = row.warningType?.severity;
        if (severity === "High") {
          return (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              High
            </Badge>
          );
        }
        if (severity === "Medium") {
          return (
            <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
              Medium
            </Badge>
          );
        }
        if (severity === "Low") {
          return (
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
              Low
            </Badge>
          );
        }
        return "-";
      },
    },
    {
      key: "description",
      label: "Description",
      render: (row) => {
        const full = row.description || "";
        const truncated = truncateDescription(full);
        if (truncated === full) return full || "-";
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={styles.descriptionCell}>{truncated}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="whitespace-pre-wrap">{full}</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: "actionDate",
      label: "Action Date",
      render: (row) => (row.actionDate ? formatDate(row.actionDate) : "-"),
    },
    {
      key: "remainingDays",
      label: "Remaining Days",
      render: (row) => {
        const days = row.remainingDays ?? 0;
        if (row.status === "Inactive") {
          return (
            <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">
              Expired
            </Badge>
          );
        }
        if (days <= 7) {
          return (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              {days} days
            </Badge>
          );
        }
        if (days <= 30) {
          return (
            <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
              {days} days
            </Badge>
          );
        }
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            {days} days
          </Badge>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        if (row.status === "Active") {
          return (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              Active
            </Badge>
          );
        }
        return (
          <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">
            Inactive
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      renderEdit: () => <PencilIcon size={18} />,
      renderDelete: () => <TrashIcon size={18} />,
      renderApprove: (row) => {
        if (togglingActionId === row._id) {
          return <Spinner className="h-4 w-4" />;
        }
        return row.status === "Active" ? (
          <ToggleRightIcon size={18} className="text-green-600" />
        ) : (
          <ToggleLeftIcon size={18} className="text-gray-400" />
        );
      },
    },
  ];

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  const resetForm = () => {
    setErrors({});
    setEditingAction(null);
    setSelectedEmployeeId("");
    setSelectedWarningTypeId("");
    setActionDate(undefined);
    setDescription("");
  };

  const handleEdit = (row) => {
    setEditingAction(row);
    setSelectedEmployeeId(row.employee?._id || "");
    setSelectedWarningTypeId(row.warningType?._id || "");
    setActionDate(row.actionDate ? new Date(row.actionDate) : undefined);
    setDescription(row.description || "");
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingAction(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingAction) {
      deleteMutation.mutate(deletingAction._id);
    }
  };

  const handleToggleStatus = (row) => {
    if (togglingActionId) return;
    setTogglingActionId(row._id);
    toggleMutation.mutate(row._id);
  };

  const handleAddClick = () => {
    setDialogOpen(true);
  };

  // Search
  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setDebouncedSearch("");
    setPage(1);
  };

  // Pagination
  const handleLimitChange = (value) => {
    setLimit(Number(value));
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (data?.pagination && page < data.pagination.totalPages) {
      setPage(page + 1);
    }
  };

  // Form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    const newErrors = {};

    if (!selectedEmployeeId) {
      newErrors.employee = "Please select an employee";
    }

    if (!selectedWarningTypeId) {
      newErrors.warningType = "Please select a warning type";
    }

    if (!actionDate) {
      newErrors.actionDate = "Action date is required";
    }

    if (!description?.trim()) {
      newErrors.description = "Description is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      employee: selectedEmployeeId,
      warningType: selectedWarningTypeId,
      actionDate: actionDate.toISOString(),
      description: description.trim(),
    };

    if (editingAction) {
      updateMutation.mutate({ id: editingAction._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  // Find selected employee label for combobox display
  const selectedEmployeeLabel = useMemo(() => {
    if (!selectedEmployeeId) return "";
    const emp = employeesList.find((e) => e._id === selectedEmployeeId);
    return emp ? `${emp.fullName} (${emp.employeeID})` : "";
  }, [selectedEmployeeId, employeesList]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Disciplinary Actions</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setTimeout(() => {
                resetForm();
              }, 200);
            }
          }}
        >
          <Button
            variant="green"
            className="cursor-pointer"
            onClick={handleAddClick}
          >
            <PlusIcon size={16} />
            Report Disciplinary Action
          </Button>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingAction
                  ? "Edit Disciplinary Action"
                  : "Report Disciplinary Action"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingAction
                  ? "Edit the disciplinary action details below"
                  : "Report a new disciplinary action against an employee"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                {/* Employee Selection (Combobox) */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Employee</Label>
                  <Popover
                    open={employeeComboboxOpen}
                    onOpenChange={setEmployeeComboboxOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={employeeComboboxOpen}
                        className="w-full justify-between font-normal cursor-pointer"
                      >
                        {selectedEmployeeLabel || "Search employee..."}
                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search by name or ID..." />
                        <CommandList>
                          <CommandEmpty>No employee found.</CommandEmpty>
                          <CommandGroup>
                            {employeesList.map((emp) => (
                              <CommandItem
                                key={emp._id}
                                value={`${emp.fullName} ${emp.employeeID}`}
                                onSelect={() => {
                                  setSelectedEmployeeId(
                                    emp._id === selectedEmployeeId
                                      ? ""
                                      : emp._id,
                                  );
                                  setEmployeeComboboxOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <CheckIcon
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedEmployeeId === emp._id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {emp.fullName}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {emp.employeeID}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.employee && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.employee}
                    </p>
                  )}
                </div>

                {/* Warning Type Selection */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Warning Type</Label>
                  <Select
                    value={selectedWarningTypeId}
                    onValueChange={(value) => setSelectedWarningTypeId(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select warning type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {warningTypesList.map((wt) => (
                          <SelectItem key={wt._id} value={wt._id}>
                            {wt.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {errors.warningType && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.warningType}
                    </p>
                  )}
                </div>

                {/* Action Date */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Action Date</Label>
                  <Popover
                    open={datePickerOpen}
                    onOpenChange={setDatePickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal cursor-pointer",
                          !actionDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {actionDate ? formatDate(actionDate) : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={actionDate}
                        onSelect={(date) => {
                          setActionDate(date);
                          setDatePickerOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.actionDate && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.actionDate}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Description</Label>
                  <Textarea
                    placeholder="Enter description of the disciplinary action..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.description}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  variant="green"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Spinner />
                      {editingAction ? "Updating" : "Reporting"}
                    </>
                  ) : editingAction ? (
                    "Update"
                  ) : (
                    "Report"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            placeholder="Search by employee name, ID, or warning type..."
            value={searchValue}
            onChange={handleSearchChange}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupAddon
            align="inline-end"
            className="cursor-pointer hover:text-[#02542D]"
            onClick={handleClearSearch}
          >
            {isFetching && debouncedSearch ? <Spinner /> : <CircleXIcon />}
          </InputGroupAddon>
        </InputGroup>

        <Select
          value={limit.toString()}
          onValueChange={handleLimitChange}
          className={styles.pageLimitSelect}
        >
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Select page limit" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="5">5 items</SelectItem>
              <SelectItem value="10">10 items</SelectItem>
              <SelectItem value="25">25 items</SelectItem>
              <SelectItem value="50">50 items</SelectItem>
              <SelectItem value="100">100 items</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.disciplinaryActions || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onApprove={handleToggleStatus}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading disciplinary actions..."
      />

      {data?.pagination && data.pagination.totalPages > 1 && (
        <Pagination className="pt-5">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={(e) => {
                  e.preventDefault();
                  handlePreviousPage();
                }}
                className={
                  page === 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>

            {(() => {
              const { currentPage, totalPages } = data.pagination;
              const pages = [];

              pages.push(
                <PaginationItem key={1}>
                  <PaginationLink
                    onClick={(e) => {
                      e.preventDefault();
                      handlePageChange(1);
                    }}
                    isActive={currentPage === 1}
                    className="cursor-pointer"
                  >
                    1
                  </PaginationLink>
                </PaginationItem>,
              );

              if (currentPage > 3) {
                pages.push(
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>,
                );
              }

              for (
                let i = Math.max(2, currentPage - 1);
                i <= Math.min(totalPages - 1, currentPage + 1);
                i++
              ) {
                pages.push(
                  <PaginationItem key={i}>
                    <PaginationLink
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(i);
                      }}
                      isActive={currentPage === i}
                      className="cursor-pointer"
                    >
                      {i}
                    </PaginationLink>
                  </PaginationItem>,
                );
              }

              if (currentPage < totalPages - 2) {
                pages.push(
                  <PaginationItem key="ellipsis-end">
                    <PaginationEllipsis />
                  </PaginationItem>,
                );
              }

              if (totalPages > 1) {
                pages.push(
                  <PaginationItem key={totalPages}>
                    <PaginationLink
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(totalPages);
                      }}
                      isActive={currentPage === totalPages}
                      className="cursor-pointer"
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>,
                );
              }

              return pages;
            })()}

            <PaginationItem>
              <PaginationNext
                onClick={(e) => {
                  e.preventDefault();
                  handleNextPage();
                }}
                className={
                  page === data.pagination.totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setTimeout(() => {
              setDeletingAction(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Disciplinary Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the disciplinary action for{" "}
              <span className="font-semibold text-[#02542D]">
                "{deletingAction?.employee?.fullName}"
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/70 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 cursor-pointer"
            >
              {deleteMutation.isPending ? (
                <>
                  <Spinner />
                  Deleting
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DisciplinaryActions;