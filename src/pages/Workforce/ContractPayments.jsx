// React
import { useEffect, useState } from "react";

// React Router
import { useParams, useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
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
import { Textarea } from "@/components/ui/textarea";

// Services
import {
  createPayment,
  deletePayment,
  fetchPaymentsByContract,
  getPaymentSummary,
  updatePayment,
} from "@/services/contractPaymentsApi";
import { getContractById } from "@/services/contractsApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "../Setups/DepartmentsSetups.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const ContractPayments = () => {
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
    return urlLimit ? Number(urlLimit) : 10;
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
  const [editingPayment, setEditingPayment] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);
  const [paymentDate, setPaymentDate] = useState(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

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

    if (limit !== 10) {
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
    staleTime: 0,
    refetchOnMount: "always",
  });

  // ---------------------------------------------------------------------------
  // Fetch Payment Summary Query
  // ---------------------------------------------------------------------------
  const { data: summary } = useQuery({
    queryKey: ["paymentSummary", contractId],
    queryFn: () => getPaymentSummary(contractId),
    enabled: !!contractId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // ---------------------------------------------------------------------------
  // Fetch Payments Query
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "payments",
      contractId,
      { limit, page, startDate: filterStartDate, endDate: filterEndDate },
    ],
    queryFn: () =>
      fetchPaymentsByContract(contractId, {
        limit,
        page,
        startDate: filterStartDate,
        endDate: filterEndDate,
      }),
    enabled: !!contractId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // ---------------------------------------------------------------------------
  // Create Payment Mutation
  // ---------------------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", contractId] });
      queryClient.invalidateQueries({ queryKey: ["paymentSummary", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      setDialogOpen(false);
      setErrors({});
      setEditingPayment(null);
      setPaymentDate(undefined);
      setAmountPaid("");
      setPaymentNote("");
      toast.success("Payment created successfully");
    },
    onError: (error) => {
      console.error("Error creating payment:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create payment";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Payment Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePayment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", contractId] });
      queryClient.invalidateQueries({ queryKey: ["paymentSummary", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      setDialogOpen(false);
      setErrors({});
      setEditingPayment(null);
      setPaymentDate(undefined);
      setAmountPaid("");
      setPaymentNote("");
      toast.success("Payment updated successfully");
    },
    onError: (error) => {
      console.error("Error updating payment:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update payment";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Payment Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deletePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", contractId] });
      queryClient.invalidateQueries({ queryKey: ["paymentSummary", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      setDeleteDialogOpen(false);
      setDeletingPayment(null);
      toast.success("Payment deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting payment:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete payment";
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
      key: "paymentDate",
      label: "Payment Date",
      render: (row) => formatDate(row.paymentDate),
    },
    {
      key: "amountPaid",
      label: "Amount Paid",
      render: (row) => formatNumber(row.amountPaid),
    },
    {
      key: "paymentNote",
      label: "Payment Note",
      render: (row) => row.paymentNote || "-",
    },
    {
      key: "createdBy",
      label: "Created By",
    },
    {
      key: "createdAt",
      label: "Created At",
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
    setEditingPayment(row);
    setPaymentDate(row.paymentDate ? new Date(row.paymentDate) : undefined);
    setAmountPaid(row.amountPaid?.toString() || "");
    setPaymentNote(row.paymentNote || "");
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingPayment(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingPayment) {
      deleteMutation.mutate(deletingPayment._id);
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
  const handleCreatePayment = (e) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.target);
    const payload = {
      contractId: contractId,
      paymentDate: paymentDate,
      amountPaid: Number(formData.get("amount-paid")),
      paymentNote: formData.get("payment-note")?.trim() || "",
    };

    // Validate
    const newErrors = {};

    if (!paymentDate) {
      newErrors.paymentDate = "Payment date is required";
    }

    if (isNaN(payload.amountPaid) || payload.amountPaid <= 0) {
      newErrors.amountPaid = "Amount paid is required and must be greater than 0";
    } else if (!Number.isInteger(payload.amountPaid)) {
      newErrors.amountPaid = "Amount paid must be a positive integer";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingPayment) {
      // Update existing payment
      updateMutation.mutate(
        { id: editingPayment._id, payload },
        {
          onSuccess: () => {
            e.target.reset();
          },
        }
      );
    } else {
      // Create new payment
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
          <h1 className={styles.title}>Contract Payments</h1>
          {contract && (
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                {contract.contractName}
              </Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
              </Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                Contract Amount: {formatNumber(contract.contractAmount)}
              </Badge>
            </div>
          )}
          {summary && (
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                Total Paid: {formatNumber(summary.totalAmountPaid)}
              </Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                Remaining: {formatNumber(summary.remainingAmount)}
              </Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                Percentage Paid: {summary.percentagePaid?.toFixed(2)}%
              </Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                Payment Count: {summary.paymentCount}
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
                setEditingPayment(null);
                setPaymentDate(undefined);
                setAmountPaid("");
                setPaymentNote("");
              }, 200);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="green" className="cursor-pointer">
              <PlusIcon size={16} />
              Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingPayment ? "Edit Payment" : "Add Payment"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingPayment
                  ? "Edit the payment record"
                  : "Add a new payment record"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePayment}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Payment Date</Label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start font-normal"
                      >
                        <CalendarIcon />
                        {paymentDate ? (
                          format(paymentDate, "PPP")
                        ) : (
                          <span>Select date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={paymentDate}
                        defaultMonth={paymentDate}
                        captionLayout="dropdown"
                        onSelect={(date) => {
                          setPaymentDate(date);
                          setDatePickerOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.paymentDate && (
                    <p className="text-sm text-red-500 mt-1">{errors.paymentDate}</p>
                  )}
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="amount-paid" className="text-[#344054]">
                    Amount Paid
                  </Label>
                  <Input
                    id="amount-paid"
                    name="amount-paid"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Enter amount paid"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                  />
                  {errors.amountPaid && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.amountPaid}
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="payment-note" className="text-[#344054]">
                    Payment Note (Optional)
                  </Label>
                  <Textarea
                    id="payment-note"
                    name="payment-note"
                    placeholder="Enter payment note (e.g., payment method, reference number)"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    rows={3}
                  />
                </div>

                {summary && amountPaid && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">New Total Paid:</span>{" "}
                      {formatNumber(
                        (editingPayment
                          ? summary.totalAmountPaid - editingPayment.amountPaid
                          : summary.totalAmountPaid) + (Number(amountPaid) || 0)
                      )}
                    </p>
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">New Remaining:</span>{" "}
                      {formatNumber(
                        summary.contractAmount -
                          ((editingPayment
                            ? summary.totalAmountPaid - editingPayment.amountPaid
                            : summary.totalAmountPaid) +
                            (Number(amountPaid) || 0))
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
                      {editingPayment ? "Updating" : "Creating"}
                    </>
                  ) : editingPayment ? (
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
                  Filter payments by payment date range.
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
        data={data?.payments || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading payment records..."
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
              setDeletingPayment(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Payment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the payment record for{" "}
              <span className="font-semibold text-[#02542D]">
                {deletingPayment?.paymentDate &&
                  formatDate(deletingPayment.paymentDate)}
              </span>{" "}
              with amount{" "}
              <span className="font-semibold text-[#02542D]">
                {deletingPayment?.amountPaid &&
                  formatNumber(deletingPayment.amountPaid)}
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

export default ContractPayments;
