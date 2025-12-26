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
import { Loader2, PencilIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import DataTable from "@/components/DataTable/data-table";
import { createDepartment, fetchDepartments } from "@/services/departmentsApi";
import styles from "./DepartmentsSetups.module.css";

const DepartmentsSetups = () => {
  // State
  const [unlimitedChecked, setUnlimitedChecked] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});

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
    },
    onError: (error) => {
      console.error("Error creating department:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create department";
      setErrors({ server: errorMessage });
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
    console.log("Edit:", row);
  };

  const handleDelete = (row) => {
    console.log("Delete:", row);
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

    mutation.mutate(payload, {
      onSuccess: () => {
        e.target.reset();
      },
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
        </div>
        <p>Loading departments...</p>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
        </div>
        <p>Error loading departments. Please try again.</p>
      </div>
    );
  }

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
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="green">Add Department</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                Add Department
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
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  variant="green"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating
                    </>
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
      />
    </div>
  );
};

export default DepartmentsSetups;
