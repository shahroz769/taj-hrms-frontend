// React
import { useEffect, useState } from "react";

// React Router
import { useParams, useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import PencilIcon from "lucide-react/dist/esm/icons/pencil";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import SlidersHorizontalIcon from "lucide-react/dist/esm/icons/sliders-horizontal";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

// Services
import {
  createAttendance,
  deleteAttendance,
  fetchAttendancesByContract,
  updateAttendance,
} from "@/services/contractAttendancesApi";
import { getContractById } from "@/services/contractsApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "../Setups/DepartmentsSetups.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const ContractAttendance = () => {
  const { id: contractId } = useParams();

  // ===========================================================================
  // URL SEARCH PARAMS
  // ===========================================================================
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------------------------------------------------------------------------
  // Initial Values from URL
  // ---------------------------------------------------------------------------
  const getInitialLimit = () => {
    const urlLimit = searchParams.get("limit");
    return urlLimit ? Number(urlLimit) : 50;
  };

  const getInitialPage = () => {
    const urlPage = searchParams.get("page");
    return urlPage ? Number(urlPage) : 1;
  };

  const getInitialStartDate = () => {
    return searchParams.get("startDate") || "";
  };

  const getInitialEndDate = () => {
    return searchParams.get("endDate") || "";
  };

  // ===========================================================================
  // STATE
  // ===========================================================================
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAttendance, setDeletingAttendance] = useState(null);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);
  const [attendanceDate, setAttendanceDate] = useState(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [laborersPresent, setLaborersPresent] = useState("");

  // Filter state
  const [filterStartDate, setFilterStartDate] = useState(getInitialStartDate);
  const [filterEndDate, setFilterEndDate] = useState(getInitialEndDate);
  const [tempFilterStartDate, setTempFilterStartDate] = useState(
    getInitialStartDate
  );
  const [tempFilterEndDate, setTempFilterEndDate] = useState(
    getInitialEndDate
  );
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [filterStartDateOpen, setFilterStartDateOpen] = useState(false);
  const [filterEndDateOpen, setFilterEndDateOpen] = useState(false);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Reset to page 1 when filters change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setPage(1);
  }, [filterStartDate, filterEndDate]);

  // ---------------------------------------------------------------------------
  // Update URL when limit, page, or filters change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const params = {};

    if (limit !== 50) {
      params.limit = limit.toString();
    }

    if (page !== 1) {
      params.page = page.toString();
    }

    if (filterStartDate) {
      params.startDate = filterStartDate;
    }

    if (filterEndDate) {
      params.endDate = filterEndDate;
    }

    setSearchParams(params, { replace: true });
  }, [limit, page, filterStartDate, filterEndDate, setSearchParams]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Fetch Contract Query
  // ---------------------------------------------------------------------------
  const { data: contract, isLoading: isLoadingContract } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => getContractById(contractId),
    enabled: !!contractId,
    staleTime: 0, // Always consider data stale to get fresh data
    refetchOnMount: "always", // Always refetch when component mounts
  });

  // ---------------------------------------------------------------------------
  // Fetch Attendances Query
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "attendances",
      contractId,
      { limit, page, startDate: filterStartDate, endDate: filterEndDate },
    ],
    queryFn: () =>
      fetchAttendancesByContract(contractId, {
        limit,
        page,
        startDate: filterStartDate,
        endDate: filterEndDate,
      }),
    enabled: !!contractId,
    staleTime: 0, // Always consider data stale to get fresh data
    refetchOnMount: "always", // Always refetch when component mounts
  });

  // ---------------------------------------------------------------------------
  // Create Attendance Mutation
  // ---------------------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: createAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendances", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      setDialogOpen(false);
      setErrors({});
      setEditingAttendance(null);
      setAttendanceDate(undefined);
      toast.success("Attendance created successfully");
    },
    onError: (error) => {
      console.error("Error creating attendance:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create attendance";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Attendance Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAttendance(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendances", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      setDialogOpen(false);
      setErrors({});
      setEditingAttendance(null);
      setAttendanceDate(undefined);
      toast.success("Attendance updated successfully");
    },
    onError: (error) => {
      console.error("Error updating attendance:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update attendance";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Attendance Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deleteAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendances", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      setDeleteDialogOpen(false);
      setDeletingAttendance(null);
      toast.success("Attendance deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting attendance:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete attendance";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return Math.round(num).toLocaleString("en-US");
  };

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "date",
      label: "Date",
      render: (row) => formatDate(row.date),
    },
    {
      key: "laborersPresent",
      label: "Laborers Present",
    },
    {
      key: "dayCost",
      label: "Day Cost",
      render: (row) => formatNumber(row.dayCost),
    },
    {
      key: "createdAt",
      label: "Marked At",
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      renderEdit: () => <PencilIcon size={18} />,
      renderDelete: () => <TrashIcon size={18} />,
    },
  ];

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Edit & Delete Handlers
  // ---------------------------------------------------------------------------
  const handleEdit = (row) => {
    setEditingAttendance(row);
    setAttendanceDate(row.date ? new Date(row.date) : undefined);
    setLaborersPresent(row.laborersPresent?.toString() || "");
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingAttendance(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingAttendance) {
      deleteMutation.mutate(deletingAttendance._id);
    }
  };

  // ---------------------------------------------------------------------------
  // Pagination Handlers
  // ---------------------------------------------------------------------------
  const handleLimitChange = (value) => {
    setLimit(Number(value));
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (data?.pagination && page < data.pagination.totalPages) {
      setPage(page + 1);
    }
  };

  // ---------------------------------------------------------------------------
  // Filter Handlers
  // ---------------------------------------------------------------------------
  const handleApplyFilters = () => {
    setFilterStartDate(tempFilterStartDate);
    setFilterEndDate(tempFilterEndDate);
    setFilterPopoverOpen(false);
  };

  const handleClearFilters = () => {
    setTempFilterStartDate("");
    setTempFilterEndDate("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterPopoverOpen(false);
  };

  // ---------------------------------------------------------------------------
  // Form Submit Handler
  // ---------------------------------------------------------------------------
  const handleCreateAttendance = (e) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.target);
    const payload = {
      contractId: contractId,
      date: attendanceDate,
      laborersPresent: Number(formData.get("laborers-present")),
    };

    // Validate
    const newErrors = {};

    if (!attendanceDate) {
      newErrors.date = "Date is required";
    }

    if (isNaN(payload.laborersPresent)) {
      newErrors.laborersPresent = "Number of laborers present is required";
    } else if (payload.laborersPresent < 0) {
      newErrors.laborersPresent = "Number of laborers cannot be negative";
    } else if (!Number.isInteger(payload.laborersPresent)) {
      newErrors.laborersPresent =
        "Number of laborers must be a non-negative integer";
    }

    // Validate date is within contract range
    if (attendanceDate && contract) {
      const selectedDate = new Date(attendanceDate);
      const contractStart = new Date(contract.startDate);
      const contractEnd = new Date(contract.endDate);
      selectedDate.setHours(0, 0, 0, 0);
      contractStart.setHours(0, 0, 0, 0);
      contractEnd.setHours(0, 0, 0, 0);

      if (selectedDate < contractStart || selectedDate > contractEnd) {
        newErrors.date = `Date must be between ${formatDate(contract.startDate)} and ${formatDate(contract.endDate)}`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingAttendance) {
      // Update existing attendance
      updateMutation.mutate(
        { id: editingAttendance._id, payload },
        {
          onSuccess: () => {
            e.target.reset();
          },
        }
      );
    } else {
      // Create new attendance
      mutation.mutate(payload, {
        onSuccess: () => {
          e.target.reset();
        },
      });
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  if (isLoadingContract) {
    return (
      <div className={styles.container}>
        <div className="flex items-center justify-center h-64">
          <Spinner />
          <span className="ml-2">Loading contract data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Contract Attendance</h1>
          {contract && (
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                {contract.contractName}
              </Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
              </Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                {contract.numberOfLabors} Laborers
              </Badge>
            </div>
          )}
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setErrors({});
              setTimeout(() => {
                setEditingAttendance(null);
                setAttendanceDate(undefined);
                setLaborersPresent("");
              }, 200);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="green" className="cursor-pointer">
              <PlusIcon size={16} />
              Add Attendance
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingAttendance ? "Edit Attendance" : "Add Attendance"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingAttendance
                  ? "Edit the attendance record"
                  : "Add a new attendance record"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAttendance}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Date</Label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start font-normal"
                      >
                        <CalendarIcon />
                        {attendanceDate ? (
                          format(attendanceDate, "PPP")
                        ) : (
                          <span>Select date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={attendanceDate}
                        defaultMonth={attendanceDate}
                        captionLayout="dropdown"
                        fromDate={contract ? new Date(contract.startDate) : undefined}
                        toDate={contract ? new Date(contract.endDate) : undefined}
                        onSelect={(date) => {
                          setAttendanceDate(date);
                          setDatePickerOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.date && (
                    <p className="text-sm text-red-500 mt-1">{errors.date}</p>
                  )}
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="laborers-present" className="text-[#344054]">
                    Laborers Present
                  </Label>
                  <Input
                    id="laborers-present"
                    name="laborers-present"
                    type="number"
                    min="0"
                    placeholder="Enter number of laborers present"
                    value={laborersPresent}
                    onChange={(e) => setLaborersPresent(e.target.value)}
                  />
                  {errors.laborersPresent && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.laborersPresent}
                    </p>
                  )}
                </div>

                {attendanceDate && contract && laborersPresent && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Estimated Day Cost:</span>{" "}
                      {formatNumber(
                        (Number(laborersPresent) || 0) * (contract.perLaborCostPerDay || 0)
                      )}
                    </p>
                  </div>
                )}
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
                  disabled={mutation.isPending || updateMutation.isPending}
                  className="cursor-pointer"
                >
                  {mutation.isPending || updateMutation.isPending ? (
                    <>
                      <Spinner />
                      {editingAttendance ? "Updating" : "Creating"}
                    </>
                  ) : editingAttendance ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className={styles.controls}>
        {/* Page Limit */}
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
              <SelectItem value="0">All items</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Filters */}
        <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Filters"
              className="cursor-pointer"
            >
              <SlidersHorizontalIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">Date Filters</h4>
                <p className="text-muted-foreground text-sm">
                  Filter attendance by date range.
                </p>
              </div>
              <div className="grid gap-2">
                {/* Start Date */}
                <div className="grid gap-2">
                  <Label>Start Date</Label>
                  <Popover
                    open={filterStartDateOpen}
                    onOpenChange={setFilterStartDateOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start font-normal"
                      >
                        <CalendarIcon />
                        {tempFilterStartDate ? (
                          format(new Date(tempFilterStartDate), "PPP")
                        ) : (
                          <span>Select start date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto overflow-hidden p-0"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={
                          tempFilterStartDate
                            ? new Date(tempFilterStartDate + "T00:00:00")
                            : undefined
                        }
                        captionLayout="dropdown"
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, "0");
                            const day = String(date.getDate()).padStart(2, "0");
                            setTempFilterStartDate(`${year}-${month}-${day}`);
                          } else {
                            setTempFilterStartDate("");
                          }
                          setFilterStartDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date */}
                <div className="grid gap-2">
                  <Label>End Date</Label>
                  <Popover
                    open={filterEndDateOpen}
                    onOpenChange={setFilterEndDateOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start font-normal"
                      >
                        <CalendarIcon />
                        {tempFilterEndDate ? (
                          format(new Date(tempFilterEndDate), "PPP")
                        ) : (
                          <span>Select end date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto overflow-hidden p-0"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={
                          tempFilterEndDate
                            ? new Date(tempFilterEndDate + "T00:00:00")
                            : undefined
                        }
                        captionLayout="dropdown"
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, "0");
                            const day = String(date.getDate()).padStart(2, "0");
                            setTempFilterEndDate(`${year}-${month}-${day}`);
                          } else {
                            setTempFilterEndDate("");
                          }
                          setFilterEndDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer"
                  onClick={handleClearFilters}
                >
                  Clear
                </Button>
                <Button
                  variant="green"
                  className="flex-1 cursor-pointer"
                  onClick={handleApplyFilters}
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <DataTable
        columns={columns}
        data={data?.attendances || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading attendance records..."
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

            {/* Render page numbers */}
            {(() => {
              const { currentPage, totalPages } = data.pagination;
              const pages = [];

              // Always show first page
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
                </PaginationItem>
              );

              // Show ellipsis if needed
              if (currentPage > 3) {
                pages.push(
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              // Show pages around current page
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
                  </PaginationItem>
                );
              }

              // Show ellipsis if needed
              if (currentPage < totalPages - 2) {
                pages.push(
                  <PaginationItem key="ellipsis-end">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              // Always show last page if there's more than one page
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
                  </PaginationItem>
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
              setDeletingAttendance(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Attendance
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the attendance record for{" "}
              <span className="font-semibold text-[#02542D]">
                {deletingAttendance?.date &&
                  formatDate(deletingAttendance.date)}
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

export default ContractAttendance;
