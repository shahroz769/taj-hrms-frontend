// React
import { useEffect, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleXIcon,
  Loader2,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
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
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

// Services
import {
  createDepartment,
  deleteDepartment,
  fetchDepartments,
  updateDepartment,
} from "@/services/departmentsApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "./DepartmentsSetups.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const DepartmentsSetups = () => {
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
  const [unlimitedChecked, setUnlimitedChecked] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDepartment, setDeletingDepartment] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);

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
  // Fetch Departments Query
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["departments", { limit, page, search: debouncedSearch }],
    queryFn: () => fetchDepartments({ limit, page, search: debouncedSearch }),
  });

  // ---------------------------------------------------------------------------
  // Create Department Mutation
  // ---------------------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setUnlimitedChecked(false);
      setDialogOpen(false);
      setErrors({});
      setEditingDepartment(null);
      toast.success("Department created successfully");
    },
    onError: (error) => {
      console.error("Error creating department:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create department";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Department Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateDepartment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setUnlimitedChecked(false);
      setDialogOpen(false);
      setErrors({});
      setEditingDepartment(null);
      toast.success("Department updated successfully");
    },
    onError: (error) => {
      console.error("Error updating department:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update department";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Department Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeleteDialogOpen(false);
      setDeletingDepartment(null);
      toast.success("Department deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting department:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete department";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "name",
      label: "Department Name",
    },
    {
      key: "positionCount",
      label: "Positions",
    },
    {
      key: "employeeCount",
      label: "No. of Employees",
    },
    {
      key: "createdAt",
      label: "Creation Date",
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
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
    setEditingDepartment(row);
    setUnlimitedChecked(row.positionCount === "Unlimited");
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingDepartment(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingDepartment) {
      deleteMutation.mutate(deletingDepartment._id);
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
  const handleCreateDepartment = (e) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.target);
    const payload = {
      name: formData.get("department-name"),
      positionCount: unlimitedChecked
        ? "Unlimited"
        : formData.get("position-limits"),
    };

    // Validate
    const newErrors = {};

    if (!payload.name?.trim()) {
      newErrors.name = "Department name is required";
    }

    if (!unlimitedChecked && !payload.positionCount?.trim()) {
      newErrors.positionCount = "Position count is required";
    }

    // Validate position count is a positive integer when not unlimited
    if (!unlimitedChecked && payload.positionCount?.trim()) {
      const positionCountValue = payload.positionCount.trim();
      const isValidNumber = /^\d+$/.test(positionCountValue); // Only positive integers
      const numericValue = Number(positionCountValue);

      if (
        !isValidNumber ||
        numericValue <= 0 ||
        !Number.isInteger(numericValue)
      ) {
        newErrors.positionCount = "Position limit must be a proper number";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingDepartment) {
      // Update existing department
      updateMutation.mutate(
        { id: editingDepartment._id, payload },
        {
          onSuccess: () => {
            e.target.reset();
          },
        }
      );
    } else {
      // Create new department
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
        <h1 className={styles.title}>Departments Setup</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setErrors({});
              setTimeout(() => {
                setEditingDepartment(null);
                setUnlimitedChecked(false);
              }, 200);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="green" className="cursor-pointer">
              <PlusIcon size={16} />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingDepartment ? "Edit Department" : "Add Department"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingDepartment
                  ? "Edit the department information below"
                  : "Create a new department by entering the name and position limits"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateDepartment}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Label htmlFor="department-name" className="text-[#344054]">
                    Department Name
                  </Label>
                  <Input
                    id="department-name"
                    name="department-name"
                    placeholder="Enter department name"
                    defaultValue={editingDepartment?.name || ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="position-limits" className="text-[#344054]">
                    Position Limits
                  </Label>
                  <InputGroup className={styles.searchInput}>
                    <InputGroupInput
                      id="position-limits"
                      name="position-limits"
                      placeholder="Enter position limits"
                      disabled={unlimitedChecked}
                      defaultValue={
                        editingDepartment?.positionCount !== "Unlimited"
                          ? editingDepartment?.positionCount || ""
                          : ""
                      }
                    />
                    <InputGroupAddon align="inline-end">
                      <Checkbox
                        checked={unlimitedChecked}
                        onCheckedChange={(checked) => {
                          setUnlimitedChecked(checked);
                          if (checked && errors.positionCount) {
                            setErrors({ ...errors, positionCount: undefined });
                          }
                        }}
                        className="data-[state=checked]:bg-[#02542D] data-[state=checked]:border-[#02542D]"
                      />
                      <p>Unlimited</p>
                    </InputGroupAddon>
                  </InputGroup>
                  {errors.positionCount && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.positionCount}
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
                  disabled={mutation.isPending || updateMutation.isPending}
                  className="cursor-pointer"
                >
                  {mutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {editingDepartment ? "Updating" : "Creating"}
                    </>
                  ) : editingDepartment ? (
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
            placeholder="Search Departments..."
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
        data={data?.departments || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
        isError={isError}
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
              setDeletingDepartment(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Department
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the department{" "}
              <span className="font-semibold text-[#02542D]">
                "{deletingDepartment?.name}"
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
                  <Loader2 className="h-4 w-4 animate-spin" />
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

export default DepartmentsSetups;
