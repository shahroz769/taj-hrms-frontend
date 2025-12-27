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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Loader2, PencilIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import DataTable from "@/components/DataTable/data-table";
import {
  createDepartment,
  deleteDepartment,
  fetchDepartments,
  updateDepartment,
} from "@/services/departmentsApi";
import styles from "./DepartmentsSetups.module.css";

const DepartmentsSetups = () => {
  // State
  const [unlimitedChecked, setUnlimitedChecked] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDepartment, setDeletingDepartment] = useState(null);

  // React Query
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
  });

  const mutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setUnlimitedChecked(false);
      setDialogOpen(false);
      setErrors({});
      setEditingDepartment(null);
    },
    onError: (error) => {
      console.error("Error creating department:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create department";
      setErrors({ server: errorMessage });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateDepartment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setUnlimitedChecked(false);
      setDialogOpen(false);
      setErrors({});
      setEditingDepartment(null);
    },
    onError: (error) => {
      console.error("Error updating department:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update department";
      setErrors({ server: errorMessage });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeleteDialogOpen(false);
      setDeletingDepartment(null);
    },
    onError: (error) => {
      console.error("Error deleting department:", error);
    },
  });

  // Table columns configuration
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
      render: (row) =>
        row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "N/A",
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      renderEdit: () => <PencilIcon size={18} />,
      renderDelete: () => <TrashIcon size={18} />,
    },
  ];

  // Event handlers
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
              setEditingDepartment(null);
              setUnlimitedChecked(false);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="green" className="cursor-pointer">
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingDepartment ? "Edit Department" : "Add Department"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Create a new department by entering the name and position
                limits.
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

      <DataTable
        columns={columns}
        data={data || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
        isError={isError}
      />

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            // Delay clearing state to allow dialog animation to complete
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
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/70 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60"
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
