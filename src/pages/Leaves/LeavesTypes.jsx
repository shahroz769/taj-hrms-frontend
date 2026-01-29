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
import SlidersHorizontalIcon from "lucide-react/dist/esm/icons/sliders-horizontal";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectLabel,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

// Services

import {
  createLeaveType,
  deleteLeaveType,
  fetchLeaveTypes,
  updateLeaveType,
  updateLeaveTypeStatus,
} from "@/services/leaveTypesApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "./LeavesTypes.module.css";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// ============================================================================
// COMPONENT
// ============================================================================

const LeavesTypes = () => {
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
  const [editingLeaveType, setEditingLeaveType] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLeaveType, setDeletingLeaveType] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);
  const [selectedIsPaid, setSelectedIsPaid] = useState("");
  const [approvingLeaveTypeId, setApprovingLeaveTypeId] = useState(null);
  const [rejectingLeaveTypeId, setRejectingLeaveTypeId] = useState(null);

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
  // Fetch Leave Types Query
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["leave-types", { limit, page, search: debouncedSearch }],
    queryFn: () => fetchLeaveTypes({ limit, page, search: debouncedSearch }),
  });

  // ---------------------------------------------------------------------------
  // Create Leave Type Mutation
  // ---------------------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: createLeaveType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      setDialogOpen(false);
      setErrors({});
      setEditingLeaveType(null);
      setSelectedIsPaid("");
      toast.success("Leave type created successfully");
    },
    onError: (error) => {
      console.error("Error creating leave type:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create leave type";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Leave Type Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateLeaveType(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      setDialogOpen(false);
      setErrors({});
      setEditingLeaveType(null);
      setSelectedIsPaid("");
      toast.success("Leave type updated successfully");
    },
    onError: (error) => {
      console.error("Error updating leave type:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update leave type";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Leave Type Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deleteLeaveType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      setDeleteDialogOpen(false);
      setDeletingLeaveType(null);
      toast.success("Leave type deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting leave type:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete leave type";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Approve Leave Type Mutation
  // ---------------------------------------------------------------------------
  const approveMutation = useMutation({
    mutationFn: ({ id }) => updateLeaveTypeStatus(id, "Approved"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      setApprovingLeaveTypeId(null);
      toast.success("Leave type approved successfully");
    },
    onError: (error) => {
      console.error("Error approving leave type:", error);
      setApprovingLeaveTypeId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to approve leave type";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Reject Leave Type Mutation
  // ---------------------------------------------------------------------------
  const rejectMutation = useMutation({
    mutationFn: ({ id }) => updateLeaveTypeStatus(id, "Rejected"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      setRejectingLeaveTypeId(null);
      toast.success("Leave type rejected successfully");
    },
    onError: (error) => {
      console.error("Error rejecting leave type:", error);
      setRejectingLeaveTypeId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to reject leave type";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "name",
      label: "Leave Name",
    },
    {
      key: "createdBy",
      label: "Created By",
      render: (row) => row.createdBy || "-",
    },
    {
      key: "createdAt",
      label: "Creation Date",
      render: (row) => (row.createdAt ? formatDate(row.createdAt) : "-"),
    },
    {
      key: "isPaid",
      label: "Nature",
      render: (row) => {
        return row.isPaid ? (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            Paid
          </Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
            Unpaid
          </Badge>
        );
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
        if (approvingLeaveTypeId === row._id) {
          return <Spinner className="h-4 w-4" />;
        }
        return <CheckCircle2 size={18} />;
      },
      renderReject: (row) => {
        if (row.status !== "Pending") return null;
        if (rejectingLeaveTypeId === row._id) {
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
  const handleEdit = (row) => {
    // Set all the editing states
    setEditingLeaveType(row);
    setSelectedIsPaid(row.isPaid !== undefined ? row.isPaid.toString() : "");
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingLeaveType(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingLeaveType) {
      deleteMutation.mutate(deletingLeaveType._id);
    }
  };

  // ---------------------------------------------------------------------------
  // Approve & Reject Handlers
  // ---------------------------------------------------------------------------
  const handleApprove = (row) => {
    // Prevent multiple clicks while pending
    if (approvingLeaveTypeId || rejectingLeaveTypeId) return;

    setApprovingLeaveTypeId(row._id);
    approveMutation.mutate({ id: row._id });
  };

  const handleReject = (row) => {
    // Prevent multiple clicks while pending
    if (approvingLeaveTypeId || rejectingLeaveTypeId) return;

    setRejectingLeaveTypeId(row._id);
    rejectMutation.mutate({ id: row._id });
  };

  // ---------------------------------------------------------------------------
  // Add Leave Type Handler
  // ---------------------------------------------------------------------------
  const handleAddLeaveTypeClick = () => {
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
  const handleCreateLeaveType = (e) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.target);
    const leaveTypeName = formData.get("leave-type-name");

    // Validate
    const newErrors = {};

    // Validate leave type name
    if (!leaveTypeName?.trim()) {
      newErrors.name = "Leave type name is required";
    }

    // Validate nature of leaves (isPaid)
    if (!selectedIsPaid) {
      newErrors.isPaid = "Please select nature of leaves";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      name: leaveTypeName,
      isPaid: selectedIsPaid === "true",
    };

    if (editingLeaveType) {
      // Update existing leave type
      updateMutation.mutate(
        { id: editingLeaveType._id, payload },
        {
          onSuccess: () => {
            e.target.reset();
          },
        },
      );
    } else {
      // Create new leave type
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
        <h1 className={styles.title}>Leaves Types</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setErrors({});
              setTimeout(() => {
                setEditingLeaveType(null);
                setSelectedIsPaid("");
              }, 200);
            }
          }}
        >
          <Button
            variant="green"
            className="cursor-pointer"
            onClick={handleAddLeaveTypeClick}
          >
            <PlusIcon size={16} />
            Add Leave Type
          </Button>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingLeaveType ? "Edit Leave Type" : "Add Leave Type"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingLeaveType
                  ? "Edit the leave type information below"
                  : "Create a new leave type by entering the name and nature"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateLeaveType}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                {/* Leave Type Name */}
                <div className="grid gap-3">
                  <Label htmlFor="leave-type-name" className="text-[#344054]">
                    Leave Type Name
                  </Label>
                  <Input
                    id="leave-type-name"
                    name="leave-type-name"
                    placeholder="Enter leave type name"
                    defaultValue={editingLeaveType?.name || ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>
                {/* Nature of Leaves (Paid/Unpaid) */}
                <div className="grid gap-3">
                  <Label htmlFor="nature-of-leaves" className="text-[#344054]">
                    Nature of Leaves
                  </Label>
                  <Select
                    value={selectedIsPaid}
                    onValueChange={(value) => setSelectedIsPaid(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select nature of leaves" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="true">Paid</SelectItem>
                        <SelectItem value="false">Unpaid</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {errors.isPaid && (
                    <p className="text-sm text-red-500 mt-1">{errors.isPaid}</p>
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
                  disabled={mutation.isPending || updateMutation.isPending}
                  className="cursor-pointer"
                >
                  {mutation.isPending || updateMutation.isPending ? (
                    <>
                      <Spinner />
                      {editingLeaveType ? "Updating" : "Creating"}
                    </>
                  ) : editingLeaveType ? (
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
            placeholder="Search Leave Types..."
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
        data={data?.leaveTypes || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading leave types..."
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
              setDeletingLeaveType(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Leave Type
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the leave type{" "}
              <span className="font-semibold text-[#02542D]">
                "{deletingLeaveType?.name}"
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

export default LeavesTypes;
