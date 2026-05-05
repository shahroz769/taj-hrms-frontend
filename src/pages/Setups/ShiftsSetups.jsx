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
  createShift,
  deleteShift,
  fetchShifts,
  updateShift,
  updateShiftStatus,
  // fetchShiftsFilters,
} from "@/services/shiftsApi";
// import {
//   // createPosition,
//   // deletePosition,
//   // fetchPositions,
//   fetchPositionsFilters,
//   // updatePosition,
// } from "@/services/positionsApi";

// Services
// import { fetchDepartmentsList } from "@/services/departmentsApi";

// Utils
import {
  formatDate,
  formatTimeToAMPM,
  calculateShiftHours,
  formatWorkingDaysInitials,
} from "@/utils/dateUtils";

// Styles
import styles from "./ShiftsSetups.module.css";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";

// ============================================================================
// COMPONENT
// ============================================================================

const ShiftsSetups = () => {
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
  const [editingShift, setEditingShift] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingShift, setDeletingShift] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);
  // const [selectedFilterReportsTo, setSelectedFilterReportsTo] = useState("");
  // const [selectedFilterDepartment, setSelectedFilterDepartment] = useState("");
  // const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [selectedWorkingDays, setSelectedWorkingDays] = useState([]);
  const [approvingShiftId, setApprovingShiftId] = useState(null);
  const [rejectingShiftId, setRejectingShiftId] = useState(null);
  const [isSplitShift, setIsSplitShift] = useState(false);
  const [segment1, setSegment1] = useState({ startTime: "09:00", endTime: "13:00" });
  const [segment2, setSegment2] = useState({ startTime: "14:00", endTime: "18:00" });

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
  // Fetch Shifts Query
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["shifts", { limit, page, search: debouncedSearch }],
    queryFn: () => fetchShifts({ limit, page, search: debouncedSearch }),
  });

  // ---------------------------------------------------------------------------
  // Create Shift Mutation
  // ---------------------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setSelectedWorkingDays([]);
      setDialogOpen(false);
      setErrors({});
      setEditingShift(null);
      toast.success("Shift created successfully");
    },
    onError: (error) => {
      console.error("Error creating shift:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create shift";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Shift Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateShift(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setSelectedWorkingDays([]);
      setDialogOpen(false);
      setErrors({});
      setEditingShift(null);
      toast.success("Shift updated successfully");
    },
    onError: (error) => {
      console.error("Error updating shift:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update shift";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Shift Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deleteShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setDeleteDialogOpen(false);
      setDeletingShift(null);
      toast.success("Shift deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting shift:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete shift";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Approve Shift Mutation
  // ---------------------------------------------------------------------------
  const approveMutation = useMutation({
    mutationFn: ({ id }) => updateShiftStatus(id, "Approved"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setApprovingShiftId(null);
      toast.success("Shift approved successfully");
    },
    onError: (error) => {
      console.error("Error approving shift:", error);
      setApprovingShiftId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to approve shift";
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Reject Shift Mutation
  // ---------------------------------------------------------------------------
  const rejectMutation = useMutation({
    mutationFn: ({ id }) => updateShiftStatus(id, "Rejected"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setRejectingShiftId(null);
      toast.success("Shift rejected successfully");
    },
    onError: (error) => {
      console.error("Error rejecting shift:", error);
      setRejectingShiftId(null);
      const errorMessage =
        error.response?.data?.message || "Failed to reject shift";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "name",
      label: "Shift Name",
    },
    {
      key: "startTime",
      label: "Timing",
      render: (row) => {
        const segs = Array.isArray(row.segments) && row.segments.length > 0
          ? row.segments
          : [{ startTime: row.startTime, endTime: row.endTime }];
        if (segs.length === 2) {
          return (
            <span className="text-xs leading-tight">
              <span className="font-medium">S1:</span> {formatTimeToAMPM(segs[0].startTime)} - {formatTimeToAMPM(segs[0].endTime)}
              <br />
              <span className="font-medium">S2:</span> {formatTimeToAMPM(segs[1].startTime)} - {formatTimeToAMPM(segs[1].endTime)}
            </span>
          );
        }
        return `${formatTimeToAMPM(segs[0].startTime)} - ${formatTimeToAMPM(segs[0].endTime)}`;
      },
    },
    {
      key: "type",
      label: "Type",
      render: (row) => row.isSplit ? (
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Split</Badge>
      ) : (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Single</Badge>
      ),
    },
    {
      key: "workingDays",
      label: "Working Days",
      render: (row) => formatWorkingDaysInitials(row.workingDays),
    },
    {
      key: "shiftHours",
      label: "Shift Hrs",
      render: (row) => {
        const segs = Array.isArray(row.segments) && row.segments.length > 0
          ? row.segments
          : [{ startTime: row.startTime, endTime: row.endTime }];
        const total = segs.reduce(
          (sum, s) => sum + calculateShiftHours(s.startTime, s.endTime),
          0,
        );
        return total;
      },
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
        if (approvingShiftId === row._id) {
          return <Spinner className="h-4 w-4" />;
        }
        return <CheckCircle2 size={18} />;
      },
      renderReject: (row) => {
        if (row.status !== "Pending") return null;
        if (rejectingShiftId === row._id) {
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
    setEditingShift(row);
    setSelectedWorkingDays(row.workingDays || []);
    const segs = Array.isArray(row.segments) && row.segments.length > 0
      ? row.segments
      : [{ startTime: row.startTime, endTime: row.endTime }];
    if (segs.length === 2) {
      setIsSplitShift(true);
      setSegment1({ startTime: (segs[0].startTime || "").slice(0, 5), endTime: (segs[0].endTime || "").slice(0, 5) });
      setSegment2({ startTime: (segs[1].startTime || "").slice(0, 5), endTime: (segs[1].endTime || "").slice(0, 5) });
    } else {
      setIsSplitShift(false);
      setSegment1({ startTime: (segs[0].startTime || "").slice(0, 5), endTime: (segs[0].endTime || "").slice(0, 5) });
      setSegment2({ startTime: "14:00", endTime: "18:00" });
    }
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingShift(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingShift) {
      deleteMutation.mutate(deletingShift._id);
    }
  };

  // ---------------------------------------------------------------------------
  // Approve & Reject Handlers
  // ---------------------------------------------------------------------------
  const handleApprove = (row) => {
    // Prevent multiple clicks while pending
    if (approvingShiftId || rejectingShiftId) return;

    setApprovingShiftId(row._id);
    approveMutation.mutate({ id: row._id });
  };

  const handleReject = (row) => {
    // Prevent multiple clicks while pending
    if (approvingShiftId || rejectingShiftId) return;

    setRejectingShiftId(row._id);
    rejectMutation.mutate({ id: row._id });
  };

  // ---------------------------------------------------------------------------
  // Add Shift Handler
  // ---------------------------------------------------------------------------
  const handleAddShiftClick = () => {
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
  const handleCreateShift = (e) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.target);
    const shiftName = formData.get("shift-name");
    const notes = formData.get("shift-notes");

    // Validate
    const newErrors = {};

    // Validate shift name
    if (!shiftName?.trim()) {
      newErrors.name = "Shift name is required";
    }

    // Validate working days (at least 1 day must be selected)
    if (!selectedWorkingDays || selectedWorkingDays.length === 0) {
      newErrors.workingDays = "Select working days for the shift";
    }

    // Validate notes (max 250 characters)
    if (notes && notes.length > 250) {
      newErrors.notes = "Notes must not exceed 250 characters";
    }

    // ---------------- Segments validation ----------------
    const toMin = (t) => {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    const seg1Start = toMin(segment1.startTime);
    const seg1End = toMin(segment1.endTime);

    if (seg1Start === null || seg1End === null) {
      newErrors.segments = "Segment 1: start and end times are required";
    } else if (seg1End <= seg1Start) {
      newErrors.segments = "Segment 1: end time must be after start time";
    }

    if (isSplitShift && !newErrors.segments) {
      const seg2Start = toMin(segment2.startTime);
      const seg2End = toMin(segment2.endTime);
      if (seg2Start === null || seg2End === null) {
        newErrors.segments = "Segment 2: start and end times are required";
      } else if (seg2End <= seg2Start) {
        newErrors.segments = "Segment 2: end time must be after start time";
      } else if (seg2Start <= seg1End) {
        if (seg2Start < seg1End) {
          newErrors.segments = "Split shift segments must not overlap";
        } else {
          newErrors.segments = "Split shift segments must have at least 1 hour gap";
        }
      } else if (seg2Start - seg1End < 60) {
        newErrors.segments = "Split shift segments must have at least 1 hour gap between them";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const segments = isSplitShift
      ? [
          { startTime: segment1.startTime, endTime: segment1.endTime },
          { startTime: segment2.startTime, endTime: segment2.endTime },
        ]
      : [{ startTime: segment1.startTime, endTime: segment1.endTime }];

    const payload = {
      name: shiftName,
      segments,
      // Keep top-level for backward compat with other consumers
      startTime: segments[0].startTime,
      endTime: segments[segments.length - 1].endTime,
      workingDays: selectedWorkingDays,
      notes: notes || "",
    };

    if (editingShift) {
      // Update existing shift
      updateMutation.mutate(
        { id: editingShift._id, payload },
        {
          onSuccess: () => {
            e.target.reset();
            setSelectedWorkingDays([]);
            setIsSplitShift(false);
          },
        },
      );
    } else {
      // Create new shift
      mutation.mutate(payload, {
        onSuccess: () => {
          e.target.reset();
          setSelectedWorkingDays([]);
          setIsSplitShift(false);
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
        <h1 className={styles.title}>Shifts Setup</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setErrors({});
              setTimeout(() => {
                setEditingShift(null);
                setSelectedWorkingDays([]);
                setIsSplitShift(false);
                setSegment1({ startTime: "09:00", endTime: "13:00" });
                setSegment2({ startTime: "14:00", endTime: "18:00" });
              }, 200);
            }
          }}
        >
          <Button
            variant="green"
            className="cursor-pointer"
            onClick={handleAddShiftClick}
          >
            <PlusIcon size={16} />
            Add Shift
          </Button>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-primary">
                {editingShift ? "Edit Shift" : "Add Shift"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingShift
                  ? "Edit the shift information below"
                  : "Create a new shift by entering the name and employee limits"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateShift}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Label htmlFor="shift-name" className="text-foreground">
                    Shift Name
                  </Label>
                  <Input
                    id="shift-name"
                    name="shift-name"
                    placeholder="Enter shift name"
                    defaultValue={editingShift?.name || ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>
                {/* Split Shift Toggle */}
                <div className="flex items-start gap-3 rounded-md border border-input p-3 bg-muted/30">
                  <Checkbox
                    id="split-shift"
                    checked={isSplitShift}
                    onCheckedChange={(checked) => setIsSplitShift(!!checked)}
                    className="mt-0.5"
                  />
                  <div className="grid gap-0.5">
                    <label
                      htmlFor="split-shift"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Split Shift (two segments per day)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Two non-overlapping segments with at least 1 hour gap.
                      Employee must check in/out on both. Missing one counts as
                      Half Day; missing both counts as Absent.
                    </p>
                  </div>
                </div>

                {/* Segment 1 Times */}
                <div className="grid gap-2">
                  <Label className="text-foreground text-xs uppercase tracking-wide">
                    {isSplitShift ? "Segment 1" : "Shift Time"}
                  </Label>
                  <div className="flex gap-4">
                    <div className="flex flex-col gap-2 flex-1">
                      <Label htmlFor="seg1-start" className="text-foreground">
                        Start Time
                      </Label>
                      <Input
                        type="time"
                        id="seg1-start"
                        value={segment1.startTime}
                        onChange={(e) => setSegment1((s) => ({ ...s, startTime: e.target.value }))}
                        className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <Label htmlFor="seg1-end" className="text-foreground">
                        End Time
                      </Label>
                      <Input
                        type="time"
                        id="seg1-end"
                        value={segment1.endTime}
                        onChange={(e) => setSegment1((s) => ({ ...s, endTime: e.target.value }))}
                        className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Segment 2 (only when split) */}
                {isSplitShift && (
                  <div className="grid gap-2">
                    <Label className="text-foreground text-xs uppercase tracking-wide">
                      Segment 2
                    </Label>
                    <div className="flex gap-4">
                      <div className="flex flex-col gap-2 flex-1">
                        <Label htmlFor="seg2-start" className="text-foreground">
                          Start Time
                        </Label>
                        <Input
                          type="time"
                          id="seg2-start"
                          value={segment2.startTime}
                          onChange={(e) => setSegment2((s) => ({ ...s, startTime: e.target.value }))}
                          className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                      </div>
                      <div className="flex flex-col gap-2 flex-1">
                        <Label htmlFor="seg2-end" className="text-foreground">
                          End Time
                        </Label>
                        <Input
                          type="time"
                          id="seg2-end"
                          value={segment2.endTime}
                          onChange={(e) => setSegment2((s) => ({ ...s, endTime: e.target.value }))}
                          className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}
                {errors.segments && (
                  <p className="text-sm text-red-500 -mt-2">{errors.segments}</p>
                )}
                {/* Working Days */}
                <div className="grid gap-3">
                  <Label htmlFor="working-days" className="text-foreground">
                    Working days
                  </Label>
                  <ToggleGroup
                    type="multiple"
                    className="flex flex-wrap gap-2"
                    value={selectedWorkingDays}
                    onValueChange={setSelectedWorkingDays}
                  >
                    <ToggleGroupItem
                      value="Monday"
                      className="rounded-full bg-gray-200 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-primary data-[state=off]:text-inherit cursor-pointer"
                    >
                      Mon
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="Tuesday"
                      className="rounded-full bg-gray-200 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-primary data-[state=off]:text-inherit cursor-pointer"
                    >
                      Tue
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="Wednesday"
                      className="rounded-full bg-gray-200 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-primary data-[state=off]:text-inherit cursor-pointer"
                    >
                      Wed
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="Thursday"
                      className="rounded-full bg-gray-200 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-primary data-[state=off]:text-inherit cursor-pointer"
                    >
                      Thu
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="Friday"
                      className="rounded-full bg-gray-200 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-primary data-[state=off]:text-inherit cursor-pointer"
                    >
                      Fri
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="Saturday"
                      className="rounded-full bg-gray-200 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-primary data-[state=off]:text-inherit cursor-pointer"
                    >
                      Sat
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="Sunday"
                      className="rounded-full bg-gray-200 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-primary data-[state=off]:text-inherit cursor-pointer"
                    >
                      Sun
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {errors.workingDays && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.workingDays}
                    </p>
                  )}
                </div>
                {/* Shift notes */}
                <div className="grid gap-3">
                  <Label htmlFor="shift-notes" className="text-foreground">
                    Notes
                  </Label>
                  <Textarea
                    id="shift-notes"
                    name="shift-notes"
                    placeholder="Add notes if any..."
                    maxLength={250}
                    defaultValue={editingShift?.notes || ""}
                  />
                  {errors.notes && (
                    <p className="text-sm text-red-500 mt-1">{errors.notes}</p>
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
                      {editingShift ? "Updating" : "Creating"}
                    </>
                  ) : editingShift ? (
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
            placeholder="Search Shifts..."
            value={searchValue}
            onChange={handleSearchChange}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupAddon
            align="inline-end"
            className="cursor-pointer hover:text-primary"
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

        {/* Filters */}
        {/* <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Filters"
              className="cursor-pointer"
              disabled={isCheckingFilters}
              onClick={async (e) => {
                e.preventDefault();
                const result = await fetchFilters();
                if (result.data) {
                  setFilterPopoverOpen(true);
                }
              }}
            >
              {isCheckingFilters ? <Spinner /> : <SlidersHorizontalIcon />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">Filters</h4>
                <p className="text-muted-foreground text-sm">
                  Apply the filters for the positions.
                </p>
              </div>
              <div className="grid gap-2">
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="reportsTo">Reports To</Label>
                  <Select
                    value={selectedFilterReportsTo}
                    onValueChange={(value) => {
                      setSelectedFilterReportsTo(value);
                    }}
                  >
                    <SelectTrigger className="w-full col-span-2">
                      <SelectValue placeholder="Select reports to" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {uniqueReportsTo.map((reportsTo) => (
                          <SelectItem key={reportsTo} value={reportsTo}>
                            {reportsTo}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={selectedFilterDepartment}
                    onValueChange={(value) => {
                      setSelectedFilterDepartment(value);
                    }}
                  >
                    <SelectTrigger className="w-full col-span-2">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {uniqueDepartments.map((deptName) => (
                          <SelectItem key={deptName} value={deptName}>
                            {deptName}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="green"
                  aria-label="Submit"
                  className="cursor-pointer flex-1"
                >
                  Apply
                </Button>
                <Button
                  variant="outline"
                  aria-label="Submit"
                  className="cursor-pointer flex-1"
                >
                  Reset
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover> */}
      </div>

      <DataTable
        columns={columns}
        data={data?.shifts || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading shifts..."
      />

      {data?.pagination && (
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
              setDeletingShift(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary">
              Delete Shift
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the shift{" "}
              <span className="font-semibold text-primary">
                "{deletingShift?.name}"
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

export default ShiftsSetups;
