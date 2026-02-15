// React
import React, { useEffect, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import PencilIcon from "lucide-react/dist/esm/icons/pencil";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import TrashIcon from "lucide-react/dist/esm/icons/trash";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
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
  createAllowancePolicy,
  deleteAllowancePolicy,
  fetchAllowancePolicies,
  updateAllowancePolicy,
  updateAllowancePolicyStatus,
} from "@/services/allowancePoliciesApi";

import { fetchAllowanceComponentsList } from "@/services/allowanceComponentsApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "./AllowancePolicies.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const AllowancePolicies = () => {
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
  const [editingAllowancePolicy, setEditingAllowancePolicy] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAllowancePolicy, setDeletingAllowancePolicy] = useState(null);
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
  // Fetch Allowance Policies Query
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["allowancePolicies", { limit, page, search: debouncedSearch }],
    queryFn: () =>
      fetchAllowancePolicies({ limit, page, search: debouncedSearch }),
  });

  // ---------------------------------------------------------------------------
  // Fetch Allowance Components List Query (lazy loading)
  // ---------------------------------------------------------------------------
  const {
    data: allowanceComponentsList,
    isLoading: isCheckingAllowanceComponents,
    refetch: fetchAllowanceComponents,
  } = useQuery({
    queryKey: ["allowanceComponentsList"],
    queryFn: fetchAllowanceComponentsList,
    enabled: false,
  });

  // ---------------------------------------------------------------------------
  // Create Allowance Policy Mutation
  // ---------------------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: createAllowancePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowancePolicies"] });
      setDialogOpen(false);
      setErrors({});
      setEditingAllowancePolicy(null);
      toast.success("Allowance policy created successfully");
    },
    onError: (error) => {
      console.error("Error creating allowance policy:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create allowance policy";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Allowance Policy Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAllowancePolicy(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowancePolicies"] });
      setDialogOpen(false);
      setErrors({});
      setEditingAllowancePolicy(null);
      toast.success("Allowance policy updated successfully");
    },
    onError: (error) => {
      console.error("Error updating allowance policy:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update allowance policy";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Allowance Policy Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deleteAllowancePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowancePolicies"] });
      setDeleteDialogOpen(false);
      setDeletingAllowancePolicy(null);
      toast.success("Allowance policy deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting allowance policy:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete allowance policy";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Approve Policy Mutation
  // ---------------------------------------------------------------------------
  const approveMutation = useMutation({
    mutationFn: ({ id }) => updateAllowancePolicyStatus(id, "Approved"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowancePolicies"] });
      setApprovingPolicyId(null);
      toast.success("Allowance policy approved successfully");
    },
    onError: (error) => {
      console.error("Error approving allowance policy:", error);
      setApprovingPolicyId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to approve allowance policy";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Reject Policy Mutation
  // ---------------------------------------------------------------------------
  const rejectMutation = useMutation({
    mutationFn: ({ id }) => updateAllowancePolicyStatus(id, "Rejected"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowancePolicies"] });
      setRejectingPolicyId(null);
      toast.success("Allowance policy rejected successfully");
    },
    onError: (error) => {
      console.error("Error rejecting allowance policy:", error);
      setRejectingPolicyId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to reject allowance policy";
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
      key: "totalAmount",
      label: "Gross Pay",
      render: (row) => {
        const totalAmount = row.components?.reduce(
          (sum, component) => sum + (component.amount || 0),
          0,
        );
        return totalAmount ? `Rs. ${totalAmount.toLocaleString()}` : "Rs. 0";
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
    // Fetch allowance components first
    const result = await fetchAllowanceComponents();

    if (result.isError) {
      const errorMessage =
        result.error?.response?.data?.message ||
        "Failed to fetch allowance components";
      toast.error(errorMessage);
      return;
    }

    if (!result.data || result.data.length === 0) {
      toast.error("Add allowance component first");
      return;
    }

    // Set editing state
    setEditingAllowancePolicy(row);
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingAllowancePolicy(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingAllowancePolicy) {
      deleteMutation.mutate(deletingAllowancePolicy._id);
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
  // Add Allowance Policy Handler
  // ---------------------------------------------------------------------------
  const handleAddAllowancePolicyClick = async () => {
    const result = await fetchAllowanceComponents();

    if (result.isError) {
      const errorMessage =
        result.error?.response?.data?.message ||
        "Failed to fetch allowance components";
      toast.error(errorMessage);
      return;
    }

    if (!result.data || result.data.length === 0) {
      toast.error("Add allowance component first");
      return;
    }

    // If allowance components exist, open the dialog
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
  const handleCreateAllowancePolicy = (e) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.target);

    // Collect allowance policy name
    const policyName = formData.get("allowance-policy-name");

    // Collect allowance component amounts dynamically
    const components = [];
    const newErrors = {};

    // Validate policy name
    if (!policyName?.trim()) {
      newErrors.name = "Allowance policy name is required";
    }

    // Process each allowance component
    if (allowanceComponentsList && allowanceComponentsList.length > 0) {
      allowanceComponentsList.forEach((component) => {
        const amountValue = formData.get(`component-amount-${component._id}`);

        // Skip empty values - they are allowed
        if (
          amountValue === null ||
          amountValue === "" ||
          amountValue === undefined
        ) {
          // Empty values are allowed, just skip this component
          return;
        }

        const amount = Number(amountValue);

        // Check if it's a valid number
        if (isNaN(amount)) {
          newErrors[`component-${component._id}`] =
            `Amount must be a valid number`;
        }
        // Check if it's negative
        else if (amount < 0) {
          newErrors[`component-${component._id}`] = `Amount cannot be negative`;
        }
        // Valid: add to components (0 is allowed)
        else {
          components.push({
            allowanceComponent: component._id,
            amount: amount,
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
      components: components,
    };

    if (editingAllowancePolicy) {
      // Update existing allowance policy
      updateMutation.mutate(
        { id: editingAllowancePolicy._id, payload },
        {
          onSuccess: () => {
            e.target.reset();
          },
        },
      );
    } else {
      // Create new allowance policy
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
        <h1 className={styles.title}>Allowance Policies Setup</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setErrors({});
              setTimeout(() => {
                setEditingAllowancePolicy(null);
              }, 200);
            }
          }}
        >
          <Button
            variant="green"
            className="cursor-pointer"
            onClick={handleAddAllowancePolicyClick}
            disabled={isCheckingAllowanceComponents}
          >
            {isCheckingAllowanceComponents ? <Spinner /> : <PlusIcon size={16} />}
            Add Allowance Policy
          </Button>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingAllowancePolicy
                  ? "Edit Allowance Policy"
                  : "Add Allowance Policy"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingAllowancePolicy
                  ? "Edit the allowance policy information below"
                  : "Create a new allowance policy by entering the name and component amounts"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAllowancePolicy}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Label
                    htmlFor="allowance-policy-name"
                    className="text-[#344054]"
                  >
                    Allowance Policy Name
                  </Label>
                  <Input
                    id="allowance-policy-name"
                    name="allowance-policy-name"
                    placeholder="Enter allowance policy name"
                    defaultValue={editingAllowancePolicy?.name || ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>

                {/* Dynamic Amount Inputs for Each Allowance Component */}
                {allowanceComponentsList && allowanceComponentsList.length > 0 && (
                  <div className="grid gap-3">
                    {allowanceComponentsList.map((component) => {
                      // Find existing component amount for edit mode
                      const existingComponent =
                        editingAllowancePolicy?.components?.find(
                          (comp) =>
                            comp.allowanceComponent?._id === component._id ||
                            comp.allowanceComponent === component._id,
                        );
                      const defaultAmount = existingComponent?.amount ?? "";

                      return (
                        <div key={component._id} className="grid gap-2">
                          <Label
                            htmlFor={`component-amount-${component._id}`}
                            className="text-[#344054] text-sm"
                          >
                            {component.name}
                          </Label>
                          <Input
                            id={`component-amount-${component._id}`}
                            name={`component-amount-${component._id}`}
                            placeholder={`Enter amount for ${component.name}`}
                            defaultValue={defaultAmount}
                            type="number"
                          />
                          {errors[`component-${component._id}`] && (
                            <p className="text-sm text-red-500 mt-1">
                              {errors[`component-${component._id}`]}
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
                      {editingAllowancePolicy ? "Updating" : "Creating"}
                    </>
                  ) : editingAllowancePolicy ? (
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
            placeholder="Search Allowance Policies..."
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
        data={data?.allowancePolicies || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading allowance policies..."
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

              // Show ellipsis if there are pages between 1 and current-1
              if (currentPage > 3) {
                pages.push(
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>,
                );
              }

              // Show page before current (if not already shown)
              if (currentPage > 2) {
                pages.push(
                  <PaginationItem key={currentPage - 1}>
                    <PaginationLink
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(currentPage - 1);
                      }}
                      className="cursor-pointer"
                    >
                      {currentPage - 1}
                    </PaginationLink>
                  </PaginationItem>,
                );
              }

              // Show current page (if not first or last)
              if (currentPage !== 1 && currentPage !== totalPages) {
                pages.push(
                  <PaginationItem key={currentPage}>
                    <PaginationLink
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(currentPage);
                      }}
                      isActive={true}
                      className="cursor-pointer"
                    >
                      {currentPage}
                    </PaginationLink>
                  </PaginationItem>,
                );
              }

              // Show page after current (if not already shown)
              if (currentPage < totalPages - 1) {
                pages.push(
                  <PaginationItem key={currentPage + 1}>
                    <PaginationLink
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(currentPage + 1);
                      }}
                      className="cursor-pointer"
                    >
                      {currentPage + 1}
                    </PaginationLink>
                  </PaginationItem>,
                );
              }

              // Show ellipsis if there are pages between current+1 and last
              if (currentPage < totalPages - 2) {
                pages.push(
                  <PaginationItem key="ellipsis-end">
                    <PaginationEllipsis />
                  </PaginationItem>,
                );
              }

              // Always show last page (if more than 1 page total)
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
                  data.pagination.currentPage === data.pagination.totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the allowance policy "
              {deletingAllowancePolicy?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? <Spinner /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AllowancePolicies;
