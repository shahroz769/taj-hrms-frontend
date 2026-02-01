// React
import { useEffect, useState } from "react";

// React Router
import { useSearchParams, Link } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import PencilIcon from "lucide-react/dist/esm/icons/pencil";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import SearchIcon from "lucide-react/dist/esm/icons/search";
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

// Services
import {
  createContract,
  deleteContract,
  fetchContracts,
  updateContract,
} from "@/services/contractsApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "../Setups/DepartmentsSetups.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const Contracts = () => {
  // ===========================================================================
  // URL SEARCH PARAMS
  // ===========================================================================
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------------------------------------------------------------------------
  // Initial Values from URL
  // ---------------------------------------------------------------------------
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

  const getInitialStatus = () => {
    return searchParams.get("status") || "";
  };

  // ===========================================================================
  // STATE
  // ===========================================================================
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingContract, setEditingContract] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContract, setDeletingContract] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);
  const [startDate, setStartDate] = useState(undefined);
  const [endDate, setEndDate] = useState(undefined);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [status, setStatus] = useState(getInitialStatus);
  const [tempStatus, setTempStatus] = useState(getInitialStatus);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [editStatus, setEditStatus] = useState("");

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Debounce search input
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // ---------------------------------------------------------------------------
  // Reset to page 1 when debounced search changes (after user stops typing)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (searchValue !== "") {
      setPage(1);
    }
  }, [debouncedSearch, searchValue]);

  // ---------------------------------------------------------------------------
  // Reset to page 1 when status filter changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setPage(1);
  }, [status]);

  // ---------------------------------------------------------------------------
  // Update URL when limit, page, debouncedSearch, or status changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const params = {};

    if (limit !== 10) {
      params.limit = limit.toString();
    }

    if (page !== 1) {
      params.page = page.toString();
    }

    if (debouncedSearch) {
      params.search = debouncedSearch;
    }

    if (status) {
      params.status = status;
    }

    setSearchParams(params, { replace: true });
  }, [limit, page, debouncedSearch, status, setSearchParams]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Fetch Contracts Query
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["contracts", { limit, page, search: debouncedSearch, status }],
    queryFn: () =>
      fetchContracts({ limit, page, search: debouncedSearch, status }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  // ---------------------------------------------------------------------------
  // Create Contract Mutation
  // ---------------------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setDialogOpen(false);
      setErrors({});
      setEditingContract(null);
      setStartDate(undefined);
      setEndDate(undefined);
      toast.success("Contract created successfully");
    },
    onError: (error) => {
      console.error("Error creating contract:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create contract";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Contract Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateContract(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({
        queryKey: ["attendances", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["contract", variables.id] });
      setDialogOpen(false);
      setErrors({});
      setEditingContract(null);
      setStartDate(undefined);
      setEndDate(undefined);
      toast.success("Contract updated successfully");
    },
    onError: (error) => {
      console.error("Error updating contract:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update contract";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Contract Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deleteContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setDeleteDialogOpen(false);
      setDeletingContract(null);
      toast.success("Contract deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting contract:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete contract";
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

  const renderStatusBadge = (status) => {
    if (status === "Active") {
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          Active
        </Badge>
      );
    }
    if (status === "Completed") {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          Completed
        </Badge>
      );
    }
    if (status === "Suspended") {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          Suspended
        </Badge>
      );
    }
    return null;
  };

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "contractName",
      label: "Contract Name",
    },
    {
      key: "startDate",
      label: "Start Date",
      render: (row) => formatDate(row.startDate),
    },
    {
      key: "endDate",
      label: "End Date",
      render: (row) => formatDate(row.endDate),
    },
    {
      key: "numberOfLabors",
      label: "Labor Qty",
    },
    {
      key: "totalDays",
      label: "Total Days",
    },
    {
      key: "totalDaysWorked",
      label: "Days Worked",
    },
    {
      key: "perLaborCostPerDay",
      label: "Amount Per Labor",
      render: (row) => formatNumber(row.perLaborCostPerDay),
    },
    {
      key: "contractAmount",
      label: "Total Payment",
      render: (row) => formatNumber(row.contractAmount),
    },
    {
      key: "totalIncurredAmount",
      label: "Incurred Payment",
      render: (row) => formatNumber(row.totalIncurredAmount || 0),
    },
    {
      key: "totalAmountPaid",
      label: "Amount Paid",
      render: (row) => formatNumber(row.totalAmountPaid || 0),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => renderStatusBadge(row.status),
    },
    {
      key: "attendance",
      label: "Attendance",
      align: "center",
      render: (row) => (
        <div className="flex justify-center">
          <Button variant="link" asChild>
            <Link to={`/workforce/contracts/${row._id}/attendance`}>View</Link>
          </Button>
        </div>
      ),
    },
    {
      key: "payment",
      label: "Payment",
      align: "center",
      render: (row) => (
        <div className="flex justify-center">
          <Button variant="link" asChild>
            <Link to={`/workforce/contracts/${row._id}/payments`}>View</Link>
          </Button>
        </div>
      ),
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
    setEditingContract(row);
    setStartDate(row.startDate ? new Date(row.startDate) : undefined);
    setEndDate(row.endDate ? new Date(row.endDate) : undefined);
    setEditStatus(row.status || "Active");
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingContract(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingContract) {
      deleteMutation.mutate(deletingContract._id);
    }
  };

  // ---------------------------------------------------------------------------
  // Search Handlers
  // ---------------------------------------------------------------------------
  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setDebouncedSearch("");
    setPage(1);
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
  // Form Submit Handler
  // ---------------------------------------------------------------------------
  const handleCreateContract = (e) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.target);
    const payload = {
      contractName: formData.get("contract-name"),
      numberOfLabors: Number(formData.get("number-of-labors")),
      contractAmount: Number(formData.get("contract-amount")),
      startDate: startDate,
      endDate: endDate,
    };

    // Add status only when editing
    if (editingContract) {
      payload.status = editStatus;
    }

    // Validate
    const newErrors = {};

    if (!payload.contractName?.trim()) {
      newErrors.contractName = "Contract name is required";
    }

    if (isNaN(payload.numberOfLabors) || payload.numberOfLabors <= 0) {
      newErrors.numberOfLabors =
        "Number of labors is required and must be greater than 0";
    } else if (!Number.isInteger(payload.numberOfLabors)) {
      newErrors.numberOfLabors = "Number of labors must be a positive integer";
    }

    if (isNaN(payload.contractAmount) || payload.contractAmount <= 0) {
      newErrors.contractAmount =
        "Contract amount is required and must be greater than 0";
    } else if (!Number.isInteger(payload.contractAmount)) {
      newErrors.contractAmount = "Contract amount must be a positive integer";
    }

    if (!startDate) {
      newErrors.startDate = "Start date is required";
    }

    if (!endDate) {
      newErrors.endDate = "End date is required";
    }

    if (startDate && endDate && endDate <= startDate) {
      newErrors.endDate = "End date must be after start date";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingContract) {
      // Update existing contract
      updateMutation.mutate(
        { id: editingContract._id, payload },
        {
          onSuccess: () => {
            e.target.reset();
          },
        },
      );
    } else {
      // Create new contract
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Contracts Management</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setErrors({});
              setTimeout(() => {
                setEditingContract(null);
                setStartDate(undefined);
                setEndDate(undefined);
                setEditStatus("");
              }, 200);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="green" className="cursor-pointer">
              <PlusIcon size={16} />
              Create Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingContract ? "Edit Contract" : "Create Contract"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingContract
                  ? "Edit the contract information below"
                  : "Create a new contract by entering the required information"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateContract}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Label htmlFor="contract-name" className="text-[#344054]">
                    Contract Name
                  </Label>
                  <Input
                    id="contract-name"
                    name="contract-name"
                    placeholder="Enter contract name"
                    defaultValue={editingContract?.contractName || ""}
                  />
                  {errors.contractName && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.contractName}
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="number-of-labors" className="text-[#344054]">
                    Number of Labors
                  </Label>
                  <Input
                    id="number-of-labors"
                    name="number-of-labors"
                    type="number"
                    min="1"
                    placeholder="Enter number of labors"
                    defaultValue={editingContract?.numberOfLabors || ""}
                  />
                  {errors.numberOfLabors && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.numberOfLabors}
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="contract-amount" className="text-[#344054]">
                    Contract Amount
                  </Label>
                  <Input
                    id="contract-amount"
                    name="contract-amount"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Enter contract amount"
                    defaultValue={editingContract?.contractAmount || ""}
                  />
                  {errors.contractAmount && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.contractAmount}
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <Label className="text-[#344054]">Start Date</Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start font-normal"
                      >
                        <CalendarIcon />
                        {startDate ? (
                          format(startDate, "PPP")
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
                        selected={startDate}
                        defaultMonth={startDate}
                        captionLayout="dropdown"
                        onSelect={(date) => {
                          setStartDate(date);
                          setStartDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.startDate && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.startDate}
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <Label className="text-[#344054]">End Date</Label>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start font-normal"
                      >
                        <CalendarIcon />
                        {endDate ? (
                          format(endDate, "PPP")
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
                        selected={endDate}
                        defaultMonth={endDate}
                        captionLayout="dropdown"
                        onSelect={(date) => {
                          setEndDate(date);
                          setEndDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.endDate && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.endDate}
                    </p>
                  )}
                </div>

                {/* Status - Only show when editing */}
                {editingContract && (
                  <div className="grid gap-3">
                    <Label className="text-[#344054]">Status</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Suspended">Suspended</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
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
                      {editingContract ? "Updating" : "Creating"}
                    </>
                  ) : editingContract ? (
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
        {/* Search */}
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            placeholder="Search Contracts..."
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
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Popover
          open={filterPopoverOpen}
          onOpenChange={(open) => {
            setFilterPopoverOpen(open);
            if (open) {
              // Sync tempStatus with current status when opening
              setTempStatus(status);
            }
          }}
        >
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
                <h4 className="leading-none font-medium">Status Filter</h4>
                <p className="text-muted-foreground text-sm">
                  Filter contracts by status.
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={tempStatus || "all"}
                  onValueChange={(val) => setTempStatus(val === "all" ? "" : val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Suspended">Suspended</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    setTempStatus("");
                    setStatus("");
                    setFilterPopoverOpen(false);
                  }}
                >
                  Clear
                </Button>
                <Button
                  variant="green"
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    setStatus(tempStatus);
                    setFilterPopoverOpen(false);
                  }}
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
        data={data?.contracts || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading contracts..."
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
                </PaginationItem>,
              );

              // Show ellipsis if needed
              if (currentPage > 3) {
                pages.push(
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>,
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
                  </PaginationItem>,
                );
              }

              // Show ellipsis if needed
              if (currentPage < totalPages - 2) {
                pages.push(
                  <PaginationItem key="ellipsis-end">
                    <PaginationEllipsis />
                  </PaginationItem>,
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
              setDeletingContract(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Contract
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the contract{" "}
              <span className="font-semibold text-[#02542D]">
                "{deletingContract?.contractName}"
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

export default Contracts;
