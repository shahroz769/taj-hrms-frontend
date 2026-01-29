// React
import React, { useEffect, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleXIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XCircle,
} from "lucide-react";
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
  createLeavePolicy,
  deleteLeavePolicy,
  fetchLeavePolicies,
  updateLeavePolicy,
  updateLeavePolicyStatus,
} from "@/services/leavePoliciesApi";

// Services
import { fetchLeaveTypesList } from "@/services/leaveTypesApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "./LeavesPolicies.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const LeavesPolicies = () => {
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

  // ===========================================================================
  // STATE
  // ===========================================================================
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingLeavePolicy, setEditingLeavePolicy] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLeavePolicy, setDeletingLeavePolicy] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);
  const [approvingPolicyId, setApprovingPolicyId] = useState(null);
  const [rejectingPolicyId, setRejectingPolicyId] = useState(null);

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
  // Update URL when limit, page, or debouncedSearch changes
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

    setSearchParams(params, { replace: true });
  }, [limit, page, debouncedSearch, setSearchParams]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Fetch Leave Policies Query
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["leavePolicies", { limit, page, search: debouncedSearch }],
    queryFn: () => fetchLeavePolicies({ limit, page, search: debouncedSearch }),
  });

  // ---------------------------------------------------------------------------
  // Fetch Leave Types List Query (lazy loading)
  // ---------------------------------------------------------------------------
  const {
    data: leaveTypesList,
    isLoading: isCheckingLeaveTypes,
    refetch: fetchLeaveTypes,
  } = useQuery({
    queryKey: ["leaveTypesList"],
    queryFn: fetchLeaveTypesList,
    enabled: false,
  });

  // ---------------------------------------------------------------------------
  // Create Leave Policy Mutation
  // ---------------------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: createLeavePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leavePolicies"] });
      setDialogOpen(false);
      setErrors({});
      setEditingLeavePolicy(null);
      toast.success("Leave policy created successfully");
    },
    onError: (error) => {
      console.error("Error creating leave policy:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create leave policy";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Leave Policy Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateLeavePolicy(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leavePolicies"] });
      setDialogOpen(false);
      setErrors({});
      setEditingLeavePolicy(null);
      toast.success("Leave policy updated successfully");
    },
    onError: (error) => {
      console.error("Error updating leave policy:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update leave policy";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Leave Policy Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deleteLeavePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leavePolicies"] });
      setDeleteDialogOpen(false);
      setDeletingLeavePolicy(null);
      toast.success("Leave policy deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting leave policy:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete leave policy";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Approve Policy Mutation
  // ---------------------------------------------------------------------------
  const approveMutation = useMutation({
    mutationFn: ({ id }) => updateLeavePolicyStatus(id, "Approved"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leavePolicies"] });
      setApprovingPolicyId(null);
      toast.success("Leave policy approved successfully");
    },
    onError: (error) => {
      console.error("Error approving leave policy:", error);
      setApprovingPolicyId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to approve leave policy";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Reject Policy Mutation
  // ---------------------------------------------------------------------------
  const rejectMutation = useMutation({
    mutationFn: ({ id }) => updateLeavePolicyStatus(id, "Rejected"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leavePolicies"] });
      setRejectingPolicyId(null);
      toast.success("Leave policy rejected successfully");
    },
    onError: (error) => {
      console.error("Error rejecting leave policy:", error);
      setRejectingPolicyId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to reject leave policy";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "name",
      label: "Policy Name",
    },
    {
      key: "createdBy",
      label: "Created By",
      render: (row) => row.createdBy || "-",
    },
    {
      key: "createdAt",
      label: "Creation Date",
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: "yearlyOffs",
      label: "Yearly Offs",
      render: (row) => {
        const totalDays = row.entitlements?.reduce(
          (sum, entitlement) => sum + (entitlement.days || 0),
          0,
        );
        return totalDays || 0;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const status = row.status;
        if (status === "Approved") {
          return (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              Approved
            </Badge>
          );
        }
        if (status === "Rejected") {
          return (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              Rejected
            </Badge>
          );
        }
        // Default: Pending
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            Pending
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
        if (row.status !== "Pending" && row.status !== "Rejected") return null;
        if (approvingPolicyId === row._id) {
          return <Spinner className="h-4 w-4" />;
        }
        return <CheckCircle2 size={18} />;
      },
      renderReject: (row) => {
        if (row.status !== "Pending") return null;
        if (rejectingPolicyId === row._id) {
          return <Spinner className="h-4 w-4" />;
        }
        return <XCircle size={18} />;
      },
    },
  ];

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Edit & Delete Handlers
  // ---------------------------------------------------------------------------
  const handleEdit = async (row) => {
    // Fetch leave types first
    const result = await fetchLeaveTypes();

    if (result.isError) {
      const errorMessage =
        result.error?.response?.data?.message || "Failed to fetch leave types";
      toast.error(errorMessage);
      return;
    }

    if (!result.data || result.data.length === 0) {
      toast.error("Add leave type first");
      return;
    }

    // Set editing state
    setEditingLeavePolicy(row);
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingLeavePolicy(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingLeavePolicy) {
      deleteMutation.mutate(deletingLeavePolicy._id);
    }
  };

  // ---------------------------------------------------------------------------
  // Approve & Reject Handlers
  // ---------------------------------------------------------------------------
  const handleApprove = (row) => {
    // Prevent multiple clicks while pending
    if (approvingPolicyId || rejectingPolicyId) return;

    setApprovingPolicyId(row._id);
    approveMutation.mutate({ id: row._id });
  };

  const handleReject = (row) => {
    // Prevent multiple clicks while pending
    if (approvingPolicyId || rejectingPolicyId) return;

    setRejectingPolicyId(row._id);
    rejectMutation.mutate({ id: row._id });
  };

  // ---------------------------------------------------------------------------
  // Add Leave Policy Handler
  // ---------------------------------------------------------------------------
  const handleAddLeavePolicyClick = async () => {
    const result = await fetchLeaveTypes();

    if (result.isError) {
      const errorMessage =
        result.error?.response?.data?.message || "Failed to fetch leave types";
      toast.error(errorMessage);
      return;
    }

    if (!result.data || result.data.length === 0) {
      toast.error("Add leave type first");
      return;
    }

    // If leave types exist, open the dialog
    setDialogOpen(true);
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
  const handleCreateLeavePolicy = (e) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.target);

    // Collect leave policy name
    const policyName = formData.get("leave-policy-name");

    // Collect leave type days dynamically
    const entitlements = [];
    const newErrors = {};

    // Validate policy name
    if (!policyName?.trim()) {
      newErrors.name = "Leave policy name is required";
    }

    // Process each leave type
    if (leaveTypesList && leaveTypesList.length > 0) {
      leaveTypesList.forEach((leaveType) => {
        const daysValue = formData.get(`leave-days-${leaveType._id}`);

        // Skip empty values - they are allowed
        if (daysValue === null || daysValue === "" || daysValue === undefined) {
          // Empty values are allowed, just skip this leave type
          return;
        }

        const days = Number(daysValue);

        // Check if it's a valid number
        if (isNaN(days) || !Number.isInteger(days)) {
          newErrors[`leaveType-${leaveType._id}`] =
            `Days must be a valid number`;
        }
        // Check if it's negative
        else if (days < 0) {
          newErrors[`leaveType-${leaveType._id}`] = `Days cannot be negative`;
        }
        // Check if it exceeds 30
        else if (days > 30) {
          newErrors[`leaveType-${leaveType._id}`] = `Days cannot exceed 30`;
        }
        // Valid: add to entitlements (0 is allowed)
        else {
          entitlements.push({
            leaveType: leaveType._id,
            days: days,
          });
        }
      });
    }

    // If there are validation errors, show them and stop
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build the payload
    const payload = {
      name: policyName,
      entitlements: entitlements,
    };

    if (editingLeavePolicy) {
      // Update existing leave policy
      updateMutation.mutate(
        { id: editingLeavePolicy._id, payload },
        {
          onSuccess: () => {
            e.target.reset();
          },
        },
      );
    } else {
      // Create new leave policy
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
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Leaves Policies Setup</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setErrors({});
              setTimeout(() => {
                setEditingLeavePolicy(null);
              }, 200);
            }
          }}
        >
          <Button
            variant="green"
            className="cursor-pointer"
            onClick={handleAddLeavePolicyClick}
            disabled={isCheckingLeaveTypes}
          >
            {isCheckingLeaveTypes ? <Spinner /> : <PlusIcon size={16} />}
            Add Leave Policy
          </Button>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingLeavePolicy ? "Edit Leave Policy" : "Add Leave Policy"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingLeavePolicy
                  ? "Edit the leave policy information below"
                  : "Create a new leave policy by entering the name and employee limits"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateLeavePolicy}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Label htmlFor="leave-policy-name" className="text-[#344054]">
                    Leave Policy Name
                  </Label>
                  <Input
                    id="leave-policy-name"
                    name="leave-policy-name"
                    placeholder="Enter leave policy name"
                    defaultValue={editingLeavePolicy?.name || ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>

                {/* Dynamic Days Inputs for Each Leave Type */}
                {leaveTypesList && leaveTypesList.length > 0 && (
                  <div className="grid gap-3">
                    {leaveTypesList.map((leaveType) => {
                      // Find existing entitlement days for edit mode
                      const existingEntitlement =
                        editingLeavePolicy?.entitlements?.find(
                          (ent) =>
                            ent.leaveType?._id === leaveType._id ||
                            ent.leaveType === leaveType._id,
                        );
                      const defaultDays = existingEntitlement?.days ?? "";

                      return (
                        <div key={leaveType._id} className="grid gap-2">
                          <Label
                            htmlFor={`leave-days-${leaveType._id}`}
                            className="text-[#344054] text-sm"
                          >
                            {leaveType.name} Leaves
                          </Label>
                          <Input
                            id={`leave-days-${leaveType._id}`}
                            name={`leave-days-${leaveType._id}`}
                            placeholder={`Enter days for ${leaveType.name} leaves`}
                            defaultValue={defaultDays}
                          />
                          {errors[`leaveType-${leaveType._id}`] && (
                            <p className="text-sm text-red-500 mt-1">
                              {errors[`leaveType-${leaveType._id}`]}
                            </p>
                          )}
                        </div>
                      );
                    })}
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
                      {editingLeavePolicy ? "Updating" : "Creating"}
                    </>
                  ) : editingLeavePolicy ? (
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

      {/* Controls */}
      <div className={styles.controls}>
        {/* Search */}
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            placeholder="Search Leaves Policies..."
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
      </div>

      <DataTable
        columns={columns}
        data={data?.leavePolicies || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading leave policies..."
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
              setDeletingLeavePolicy(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Leave Policy
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the leave policy{" "}
              <span className="font-semibold text-[#02542D]">
                "{deletingLeavePolicy?.name}"
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

export default LeavesPolicies;
