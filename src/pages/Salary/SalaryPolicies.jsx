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
  createSalaryPolicy,
  deleteSalaryPolicy,
  fetchSalaryPolicies,
  updateSalaryPolicy,
  updateSalaryPolicyStatus,
} from "@/services/salaryPoliciesApi";

import { fetchSalaryComponentsList } from "@/services/salaryComponentsApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "./SalaryPolicies.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const SalaryPolicies = () => {
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
  const [editingSalaryPolicy, setEditingSalaryPolicy] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSalaryPolicy, setDeletingSalaryPolicy] = useState(null);
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
  // Fetch Salary Policies Query
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["salaryPolicies", { limit, page, search: debouncedSearch }],
    queryFn: () =>
      fetchSalaryPolicies({ limit, page, search: debouncedSearch }),
  });

  // ---------------------------------------------------------------------------
  // Fetch Salary Components List Query (lazy loading)
  // ---------------------------------------------------------------------------
  const {
    data: salaryComponentsList,
    isLoading: isCheckingSalaryComponents,
    refetch: fetchSalaryComponents,
  } = useQuery({
    queryKey: ["salaryComponentsList"],
    queryFn: fetchSalaryComponentsList,
    enabled: false,
  });

  // ---------------------------------------------------------------------------
  // Create Salary Policy Mutation
  // ---------------------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: createSalaryPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaryPolicies"] });
      setDialogOpen(false);
      setErrors({});
      setEditingSalaryPolicy(null);
      toast.success("Salary policy created successfully");
    },
    onError: (error) => {
      console.error("Error creating salary policy:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create salary policy";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Salary Policy Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateSalaryPolicy(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaryPolicies"] });
      setDialogOpen(false);
      setErrors({});
      setEditingSalaryPolicy(null);
      toast.success("Salary policy updated successfully");
    },
    onError: (error) => {
      console.error("Error updating salary policy:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update salary policy";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Salary Policy Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deleteSalaryPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaryPolicies"] });
      setDeleteDialogOpen(false);
      setDeletingSalaryPolicy(null);
      toast.success("Salary policy deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting salary policy:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete salary policy";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Approve Policy Mutation
  // ---------------------------------------------------------------------------
  const approveMutation = useMutation({
    mutationFn: ({ id }) => updateSalaryPolicyStatus(id, "Approved"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaryPolicies"] });
      setApprovingPolicyId(null);
      toast.success("Salary policy approved successfully");
    },
    onError: (error) => {
      console.error("Error approving salary policy:", error);
      setApprovingPolicyId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to approve salary policy";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Reject Policy Mutation
  // ---------------------------------------------------------------------------
  const rejectMutation = useMutation({
    mutationFn: ({ id }) => updateSalaryPolicyStatus(id, "Rejected"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaryPolicies"] });
      setRejectingPolicyId(null);
      toast.success("Salary policy rejected successfully");
    },
    onError: (error) => {
      console.error("Error rejecting salary policy:", error);
      setRejectingPolicyId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to reject salary policy";
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
    // Fetch salary components first
    const result = await fetchSalaryComponents();

    if (result.isError) {
      const errorMessage =
        result.error?.response?.data?.message ||
        "Failed to fetch salary components";
      toast.error(errorMessage);
      return;
    }

    if (!result.data || result.data.length === 0) {
      toast.error("Add salary component first");
      return;
    }

    // Set editing state
    setEditingSalaryPolicy(row);
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingSalaryPolicy(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingSalaryPolicy) {
      deleteMutation.mutate(deletingSalaryPolicy._id);
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
  // Add Salary Policy Handler
  // ---------------------------------------------------------------------------
  const handleAddSalaryPolicyClick = async () => {
    const result = await fetchSalaryComponents();

    if (result.isError) {
      const errorMessage =
        result.error?.response?.data?.message ||
        "Failed to fetch salary components";
      toast.error(errorMessage);
      return;
    }

    if (!result.data || result.data.length === 0) {
      toast.error("Add salary component first");
      return;
    }

    // If salary components exist, open the dialog
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
  const handleCreateSalaryPolicy = (e) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.target);

    // Collect salary policy name
    const policyName = formData.get("salary-policy-name");

    // Collect salary component amounts dynamically
    const components = [];
    const newErrors = {};

    // Validate policy name
    if (!policyName?.trim()) {
      newErrors.name = "Salary policy name is required";
    }

    // Process each salary component
    if (salaryComponentsList && salaryComponentsList.length > 0) {
      salaryComponentsList.forEach((component) => {
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
            salaryComponent: component._id,
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

    if (editingSalaryPolicy) {
      // Update existing salary policy
      updateMutation.mutate(
        { id: editingSalaryPolicy._id, payload },
        {
          onSuccess: () => {
            e.target.reset();
          },
        },
      );
    } else {
      // Create new salary policy
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
        <h1 className={styles.title}>Salary Policies Setup</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setErrors({});
              setTimeout(() => {
                setEditingSalaryPolicy(null);
              }, 200);
            }
          }}
        >
          <Button
            variant="green"
            className="cursor-pointer"
            onClick={handleAddSalaryPolicyClick}
            disabled={isCheckingSalaryComponents}
          >
            {isCheckingSalaryComponents ? <Spinner /> : <PlusIcon size={16} />}
            Add Salary Policy
          </Button>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingSalaryPolicy
                  ? "Edit Salary Policy"
                  : "Add Salary Policy"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingSalaryPolicy
                  ? "Edit the salary policy information below"
                  : "Create a new salary policy by entering the name and component amounts"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSalaryPolicy}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Label
                    htmlFor="salary-policy-name"
                    className="text-[#344054]"
                  >
                    Salary Policy Name
                  </Label>
                  <Input
                    id="salary-policy-name"
                    name="salary-policy-name"
                    placeholder="Enter salary policy name"
                    defaultValue={editingSalaryPolicy?.name || ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>

                {/* Dynamic Amount Inputs for Each Salary Component */}
                {salaryComponentsList && salaryComponentsList.length > 0 && (
                  <div className="grid gap-3">
                    {salaryComponentsList.map((component) => {
                      // Find existing component amount for edit mode
                      const existingComponent =
                        editingSalaryPolicy?.components?.find(
                          (comp) =>
                            comp.salaryComponent?._id === component._id ||
                            comp.salaryComponent === component._id,
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
                      {editingSalaryPolicy ? "Updating" : "Creating"}
                    </>
                  ) : editingSalaryPolicy ? (
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
            placeholder="Search Salary Policies..."
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
        data={data?.salaryPolicies || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading salary policies..."
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
              This will permanently delete the salary policy "
              {deletingSalaryPolicy?.name}". This action cannot be undone.
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

export default SalaryPolicies;
