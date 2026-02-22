// React
import React, { useCallback, useEffect, useMemo, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// Redux
import { useSelector } from "react-redux";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import ClockIcon from "lucide-react/dist/esm/icons/clock";
import MessageSquareIcon from "lucide-react/dist/esm/icons/message-square";
import PencilIcon from "lucide-react/dist/esm/icons/pencil";

import PlusIcon from "lucide-react/dist/esm/icons/plus";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import StarIcon from "lucide-react/dist/esm/icons/star";
import TrashIcon from "lucide-react/dist/esm/icons/trash";
import XIcon from "lucide-react/dist/esm/icons/x";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Services
import {
  addRemarksApi,
  closeTaskApi,
  completeTaskApi,
  createWorkProgressReport,
  deleteWorkProgressReport,
  fetchWorkProgressReportById,
  fetchWorkProgressReports,
  searchEmployeesForTask,
  startTaskApi,
  updateWorkProgressReport,
} from "@/services/workProgressReportsApi";

// Utils
import {
  formatDate,
  formatDateGMT5,
  formatDateTimeGMT5,
} from "@/utils/dateUtils";
import { ROLES } from "@/utils/roles";
import { cn } from "@/lib/utils";

// Styles
import styles from "./WorkProgressReports.module.css";

// ============================================================================
// HELPERS
// ============================================================================

const truncateText = (text) => {
  if (!text) return "-";
  const words = text.trim().split(/\s+/);
  if (words.length <= 2) return text;
  return words.slice(0, 2).join(" ") + "...";
};

const calcDaysBetween = (startDate, endDate) => {
  if (!startDate || !endDate) return "";
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffMs = end - start;
  if (diffMs <= 0) return "";
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const calcDeadlineFromDays = (assignmentDate, days) => {
  if (!assignmentDate || !days || days < 1) return null;
  const date = new Date(assignmentDate);
  date.setDate(date.getDate() + Number(days));
  return date;
};

// ============================================================================
// STAR RATING COMPONENT
// ============================================================================

const StarRating = ({ value, onChange, readOnly = false, size = 24 }) => {
  const [hoverValue, setHoverValue] = useState(null);
  const displayValue = hoverValue !== null ? hoverValue : value || 0;

  const handleStarClick = (starIndex, event) => {
    if (readOnly || !onChange) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;
    const fraction = x / width;
    let rating;
    if (fraction <= 0.5) {
      rating = starIndex + 0.5;
    } else {
      rating = starIndex + 1;
    }
    rating = Math.round(rating * 10) / 10;
    onChange(Math.min(5, Math.max(0, rating)));
  };

  const handleMouseMove = (starIndex, event) => {
    if (readOnly) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;
    const fraction = x / width;
    let rating;
    if (fraction <= 0.5) {
      rating = starIndex + 0.5;
    } else {
      rating = starIndex + 1;
    }
    setHoverValue(Math.min(5, Math.max(0, rating)));
  };

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => !readOnly && setHoverValue(null)}
    >
      {[0, 1, 2, 3, 4].map((starIndex) => {
        const fillPercent = Math.min(
          100,
          Math.max(0, (displayValue - starIndex) * 100),
        );
        return (
          <div
            key={starIndex}
            className={cn("relative", !readOnly && "cursor-pointer")}
            style={{ width: size, height: size }}
            onClick={(e) => handleStarClick(starIndex, e)}
            onMouseMove={(e) => handleMouseMove(starIndex, e)}
          >
            <StarIcon
              size={size}
              className="absolute text-gray-200"
              fill="currentColor"
            />
            <div
              className="absolute overflow-hidden"
              style={{ width: `${fillPercent}%`, height: size }}
            >
              <StarIcon
                size={size}
                className="text-yellow-400"
                fill="currentColor"
              />
            </div>
          </div>
        );
      })}
      <span className="ml-2 text-sm font-medium text-gray-600">
        {(value || 0).toFixed(1)}/5
      </span>
    </div>
  );
};

// ============================================================================
// TIMELINE COMPONENT
// ============================================================================

const Timeline = ({ entries = [] }) => {
  if (!entries.length) return null;

  return (
    <div className="relative pl-6 space-y-0">
      {/* Vertical line */}
      <div className="absolute left-2.25 top-2 bottom-2 w-0.5 bg-gray-200" />
      {entries.map((entry, index) => (
        <div key={entry._id || index} className="relative pb-6 last:pb-0">
          {/* Dot */}
          <div
            className={cn(
              "absolute -left-6 top-1 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center",
              entry.action === "Task Assigned"
                ? "bg-blue-100 border-blue-500"
                : entry.action === "Task Started"
                  ? "bg-yellow-100 border-yellow-500"
                  : entry.action === "Remarks Added"
                    ? "bg-purple-100 border-purple-500"
                    : entry.action === "Task Completed"
                      ? "bg-green-100 border-green-500"
                      : "bg-gray-100 border-gray-500",
            )}
          >
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                entry.action === "Task Assigned"
                  ? "bg-blue-500"
                  : entry.action === "Task Started"
                    ? "bg-yellow-500"
                    : entry.action === "Remarks Added"
                      ? "bg-purple-500"
                      : entry.action === "Task Completed"
                        ? "bg-green-500"
                        : "bg-gray-500",
              )}
            />
          </div>
          {/* Content */}
          <div className="ml-2">
            <p className="text-sm font-semibold text-gray-800">
              {entry.action}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              by {entry.performedBy?.name || "Unknown"} &bull;{" "}
              {formatDateTimeGMT5(entry.timestamp)}
            </p>
            {entry.details && (
              <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2">
                {entry.details}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// VIEW DETAILS MODAL COMPONENT
// ============================================================================

const ViewDetailsModal = ({ open, onOpenChange, reportId, userRole }) => {
  const queryClient = useQueryClient();
  const [remarksDate, setRemarksDate] = useState(undefined);
  const [remarksText, setRemarksText] = useState("");
  const [remarksDatePickerOpen, setRemarksDatePickerOpen] = useState(false);
  const [closingRemarks, setClosingRemarks] = useState("");
  const [rating, setRating] = useState(0);
  const [showCloseSection, setShowCloseSection] = useState(false);

  const isAdmin = userRole === ROLES.admin;
  const isSupervisor = userRole === ROLES.supervisor;

  const { data: report } = useQuery({
    queryKey: ["work-progress-report-detail", reportId],
    queryFn: () => fetchWorkProgressReportById(reportId),
    enabled: !!reportId,
  });

  const startMutation = useMutation({
    mutationFn: () => startTaskApi(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-progress-reports"] });
      queryClient.invalidateQueries({
        queryKey: ["work-progress-report-detail", reportId],
      });
      toast.success("Task started successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to start task");
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeTaskApi(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-progress-reports"] });
      queryClient.invalidateQueries({
        queryKey: ["work-progress-report-detail", reportId],
      });
      toast.success("Task completed successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to complete task");
    },
  });

  const remarksMutation = useMutation({
    mutationFn: (payload) => addRemarksApi(reportId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["work-progress-report-detail", reportId],
      });
      queryClient.invalidateQueries({ queryKey: ["work-progress-reports"] });
      setRemarksDate(undefined);
      setRemarksText("");
      toast.success("Remarks added successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to add remarks");
    },
  });

  const closeMutation = useMutation({
    mutationFn: (payload) => closeTaskApi(reportId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-progress-reports"] });
      queryClient.invalidateQueries({
        queryKey: ["work-progress-report-detail", reportId],
      });
      setClosingRemarks("");
      setRating(0);
      setShowCloseSection(false);
      toast.success("Task closed successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to close task");
    },
  });

  const handleAddRemarks = () => {
    if (!remarksDate) {
      toast.error("Please select a remarks date");
      return;
    }
    if (!remarksText.trim()) {
      toast.error("Please enter remarks text");
      return;
    }
    remarksMutation.mutate({
      date: remarksDate.toISOString(),
      text: remarksText.trim(),
    });
  };

  const handleCloseTask = () => {
    if (!closingRemarks.trim()) {
      toast.error("Closing remarks are required");
      return;
    }
    if (!rating || rating <= 0) {
      toast.error("Please provide a rating");
      return;
    }
    closeMutation.mutate({
      closingRemarks: closingRemarks.trim(),
      rating,
    });
  };

  const canStart = report?.status === "Pending" && (isAdmin || isSupervisor);
  const canComplete =
    report?.status === "In Progress" && (isAdmin || isSupervisor);
  const canAddRemarks =
    !["Closed", "Closed (Early)", "Closed (On Time)", "Closed (Late)"].includes(
      report?.status,
    ) &&
    (isAdmin || isSupervisor);
  const canClose =
    (report?.status === "Completed (Early)" ||
      report?.status === "Completed (On Time)" ||
      report?.status === "Completed (Late)") &&
    isAdmin;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setRemarksDate(undefined);
          setRemarksText("");
          setClosingRemarks("");
          setRating(0);
          setShowCloseSection(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-175 max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-[#02542D] text-center text-lg">
            Task Details
          </DialogTitle>
          <DialogDescription className="sr-only">
            View task details, timeline, and actions
          </DialogDescription>
        </DialogHeader>

        {report ? (
          <ScrollArea className="flex-1 overflow-auto px-6 pb-6 max-h-[calc(90vh-80px)]">
            <div className="space-y-5 pr-2">
              {/* Employees */}
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Employees
                </Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {report.employees?.map((emp) => (
                    <Badge
                      key={emp._id}
                      className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50"
                    >
                      {emp.fullName} ({emp.employeeID})
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Assignment Date
                  </Label>
                  <p className="text-sm font-medium mt-1">
                    {formatDateGMT5(report.assignmentDate)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Deadline
                  </Label>
                  <p className="text-sm font-medium mt-1">
                    {formatDateGMT5(report.deadline)}
                  </p>
                </div>
                {report.startDate && (
                  <div>
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Start Date & Time
                    </Label>
                    <p className="text-sm font-medium mt-1">
                      {formatDateTimeGMT5(report.startDate)}
                    </p>
                  </div>
                )}
                {report.completionDate && (
                  <div>
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Completion Date & Time
                    </Label>
                    <p className="text-sm font-medium mt-1">
                      {formatDateTimeGMT5(report.completionDate)}
                    </p>
                  </div>
                )}
              </div>

              {/* Task Description */}
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Task Description
                </Label>
                <p className="text-sm mt-1 whitespace-pre-wrap bg-gray-50 rounded-md p-3">
                  {report.taskDescription || "-"}
                </p>
              </div>

              {/* Status + Rating */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </Label>
                  <div className="mt-1.5">
                    {report.status === "Pending" && (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                        Pending
                      </Badge>
                    )}
                    {report.status === "In Progress" && (
                      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                        In Progress
                      </Badge>
                    )}
                    {report.status === "Completed (Early)" && (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        Completed (Early)
                      </Badge>
                    )}
                    {report.status === "Completed (On Time)" && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        Completed (On Time)
                      </Badge>
                    )}
                    {report.status === "Completed (Late)" && (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                        Completed (Late)
                      </Badge>
                    )}
                    {report.status === "Closed (Early)" && (
                      <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50">
                        Closed (Early)
                      </Badge>
                    )}
                    {report.status === "Closed (On Time)" && (
                      <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
                        Closed (On Time)
                      </Badge>
                    )}
                    {report.status === "Closed (Late)" && (
                      <Badge className="bg-red-50 text-red-600 hover:bg-red-50">
                        Closed (Late)
                      </Badge>
                    )}
                    {report.status === "Closed" && (
                      <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                        Closed
                      </Badge>
                    )}
                  </div>
                </div>
                {report.rating != null && (
                  <div>
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Rating
                    </Label>
                    <div className="mt-1.5">
                      <StarRating value={report.rating} readOnly size={18} />
                    </div>
                  </div>
                )}
              </div>

              {/* Day Stats */}
              {report.dayStats && (
                <div className="bg-gray-50 rounded-md p-3 grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Days Passed</p>
                    <p className="text-lg font-bold text-gray-800">
                      {report.dayStats.daysPassed}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Days Allowed</p>
                    <p className="text-lg font-bold text-gray-800">
                      {report.dayStats.totalDaysAllowed}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      {report.dayStats.remainingDays >= 0
                        ? "Remaining"
                        : "Days Overdue"}
                    </p>
                    <p
                      className={cn(
                        "text-lg font-bold",
                        report.dayStats.remainingDays >= 0
                          ? "text-green-600"
                          : "text-red-600",
                      )}
                    >
                      {Math.abs(report.dayStats.remainingDays)}
                    </p>
                  </div>
                </div>
              )}

              {/* Closing Remarks */}
              {report.closingRemarks && (
                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Closing Remarks
                  </Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap bg-gray-50 rounded-md p-3">
                    {report.closingRemarks}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                {canStart && (
                  <Button
                    variant="green"
                    size="sm"
                    className="cursor-pointer"
                    disabled={startMutation.isPending}
                    onClick={() => startMutation.mutate()}
                  >
                    {startMutation.isPending && <Spinner />}
                    Start Task
                  </Button>
                )}
                {canComplete && (
                  <Button
                    variant="green"
                    size="sm"
                    className="cursor-pointer"
                    disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate()}
                  >
                    {completeMutation.isPending ? (
                      <Spinner />
                    ) : (
                      <CheckIcon size={14} />
                    )}
                    Complete Task
                  </Button>
                )}
                {canClose && !showCloseSection && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setShowCloseSection(true)}
                  >
                    <StarIcon size={14} />
                    Close Task
                  </Button>
                )}
              </div>

              {/* Close Task Section */}
              {canClose && showCloseSection && (
                <div className="border rounded-md p-4 space-y-3 bg-gray-50">
                  <h4 className="font-semibold text-sm text-[#02542D]">
                    Close Task
                  </h4>
                  <div className="grid gap-3">
                    <div>
                      <Label className="text-[#344054] text-sm">
                        Final / Closing Remarks
                      </Label>
                      <Textarea
                        placeholder="Enter closing remarks..."
                        value={closingRemarks}
                        onChange={(e) => setClosingRemarks(e.target.value)}
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[#344054] text-sm">
                        Rating (out of 5)
                      </Label>
                      <div className="flex items-center gap-3 mt-1">
                        <StarRating
                          value={rating}
                          onChange={setRating}
                          size={28}
                        />
                        <Input
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={rating || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 0 && val <= 5) {
                              setRating(Math.round(val * 10) / 10);
                            } else if (e.target.value === "") {
                              setRating(0);
                            }
                          }}
                          className="w-20"
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        setShowCloseSection(false);
                        setClosingRemarks("");
                        setRating(0);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="green"
                      className="cursor-pointer"
                      disabled={closeMutation.isPending}
                      onClick={handleCloseTask}
                    >
                      {closeMutation.isPending ? <Spinner /> : null}
                      Confirm Close
                    </Button>
                  </div>
                </div>
              )}

              {/* Remarks Section */}
              {canAddRemarks && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-[#02542D] flex items-center gap-1.5">
                      <MessageSquareIcon size={14} />
                      Add Remarks
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[#344054] text-sm">Date</Label>
                        <Popover
                          open={remarksDatePickerOpen}
                          onOpenChange={setRemarksDatePickerOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal cursor-pointer mt-1",
                                !remarksDate && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {remarksDate
                                ? formatDate(remarksDate)
                                : "Pick date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={remarksDate}
                              onSelect={(date) => {
                                setRemarksDate(date);
                                setRemarksDatePickerOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex items-end">
                        <Button
                          size="sm"
                          variant="green"
                          className="cursor-pointer"
                          disabled={remarksMutation.isPending}
                          onClick={handleAddRemarks}
                        >
                          {remarksMutation.isPending ? <Spinner /> : null}
                          Add Remarks
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Enter remarks..."
                      value={remarksText}
                      onChange={(e) => setRemarksText(e.target.value)}
                      rows={2}
                    />
                  </div>
                </>
              )}

              {/* Timeline */}
              <Separator />
              <div>
                <h4 className="font-semibold text-sm text-[#02542D] flex items-center gap-1.5 mb-4">
                  <ClockIcon size={14} />
                  Timeline
                </h4>
                <Timeline entries={report.timeline || []} />
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex justify-center items-center py-20">
            <p className="text-gray-500">Report not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const WorkProgressReports = () => {
  // URL SEARCH PARAMS
  const [searchParams, setSearchParams] = useSearchParams();

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

  // AUTH
  const userRole = useSelector((state) => state.auth.user?.role);
  const isAdmin = userRole === ROLES.admin;

  // STATE
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingReport, setEditingReport] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReport, setDeletingReport] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);

  // View modal state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewReportId, setViewReportId] = useState(null);
  const [pendingViewId, setPendingViewId] = useState(null);

  // Form state
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [debouncedEmployeeQuery, setDebouncedEmployeeQuery] = useState("");
  const [assignmentDate, setAssignmentDate] = useState(undefined);
  const [deadlineDate, setDeadlineDate] = useState(undefined);
  const [daysForCompletion, setDaysForCompletion] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [assignDatePickerOpen, setAssignDatePickerOpen] = useState(false);
  const [deadlineDatePickerOpen, setDeadlineDatePickerOpen] = useState(false);

  const [lastChangedField, setLastChangedField] = useState(null);

  // EFFECTS

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    if (searchValue !== "") {
      setPage(1);
    }
  }, [debouncedSearch, searchValue]);

  useEffect(() => {
    const params = {};
    if (limit !== 10) params.limit = limit.toString();
    if (page !== 1) params.page = page.toString();
    if (debouncedSearch) params.search = debouncedSearch;
    setSearchParams(params, { replace: true });
  }, [limit, page, debouncedSearch, setSearchParams]);

  useEffect(() => {
    if (
      lastChangedField === "deadline" ||
      lastChangedField === "assignmentDate"
    ) {
      if (assignmentDate && deadlineDate) {
        const days = calcDaysBetween(assignmentDate, deadlineDate);
        if (days && days > 0) {
          setDaysForCompletion(String(days));
        }
      }
    }
  }, [assignmentDate, deadlineDate, lastChangedField]);

  useEffect(() => {
    if (lastChangedField === "days" && assignmentDate && daysForCompletion) {
      const days = parseInt(daysForCompletion, 10);
      if (days > 0) {
        const newDeadline = calcDeadlineFromDays(assignmentDate, days);
        if (newDeadline) {
          setDeadlineDate(newDeadline);
        }
      }
    }
  }, [daysForCompletion, assignmentDate, lastChangedField]);

  // Employee search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmployeeQuery(employeeSearchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [employeeSearchQuery]);

  // REACT QUERY
  const queryClient = useQueryClient();

  // Prefetch report details when View is clicked — opens modal only after data is ready
  const { isFetching: isViewFetching, isSuccess: isViewSuccess } = useQuery({
    queryKey: ["work-progress-report-detail", pendingViewId],
    queryFn: () => fetchWorkProgressReportById(pendingViewId),
    enabled: !!pendingViewId,
  });

  useEffect(() => {
    if (pendingViewId && isViewSuccess && !isViewFetching) {
      setViewReportId(pendingViewId);
      setViewDialogOpen(true);
      setPendingViewId(null);
    }
  }, [pendingViewId, isViewSuccess, isViewFetching]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "work-progress-reports",
      { limit, page, search: debouncedSearch },
    ],
    queryFn: () =>
      fetchWorkProgressReports({ limit, page, search: debouncedSearch }),
  });

  // Employee search query
  const { data: employeeSearchResults, isFetching: isSearchingEmployees } =
    useQuery({
      queryKey: ["search-employees-task", debouncedEmployeeQuery],
      queryFn: () => searchEmployeesForTask(debouncedEmployeeQuery),
      enabled: dialogOpen && debouncedEmployeeQuery.length >= 1,
    });

  const filteredEmployeeResults = useMemo(() => {
    if (!employeeSearchResults) return [];
    const selectedIds = new Set(selectedEmployees.map((e) => e._id));
    return employeeSearchResults.map((emp) => ({
      ...emp,
      alreadyAdded: selectedIds.has(emp._id),
    }));
  }, [employeeSearchResults, selectedEmployees]);

  const createMutation = useMutation({
    mutationFn: createWorkProgressReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-progress-reports"] });
      resetForm();
      setDialogOpen(false);
      toast.success("Task assigned successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to assign task";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateWorkProgressReport(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-progress-reports"] });
      resetForm();
      setDialogOpen(false);
      toast.success("Task updated successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to update task";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkProgressReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-progress-reports"] });
      setDeleteDialogOpen(false);
      setDeletingReport(null);
      toast.success("Task deleted successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to delete task";
      toast.error(errorMessage);
    },
  });

  // TABLE CONFIGURATION
  const columns = [
    {
      key: "employees",
      label: "Assigned To",
      fontWeight: "medium",
      render: (row) => {
        const employees = row.employees || [];
        if (employees.length === 0) return "-";
        if (employees.length === 1) {
          const emp = employees[0];
          return `${emp.fullName} (${emp.employeeID})`;
        }
        const count = employees.length;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={styles.hoverTooltipCell}>{count} employees</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                {employees.map((emp) => (
                  <p key={emp._id} className="text-xs">
                    {emp.fullName} ({emp.employeeID})
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: "assignedBy",
      label: "Assigned By",
      render: (row) => row.assignedBy?.name || "-",
    },
    {
      key: "assignmentDate",
      label: "Assignment Date",
      render: (row) =>
        row.assignmentDate ? formatDateGMT5(row.assignmentDate) : "-",
    },
    {
      key: "startDate",
      label: "Start Date",
      render: (row) => (row.startDate ? formatDateGMT5(row.startDate) : "-"),
    },
    {
      key: "deadline",
      label: "Deadline",
      render: (row) => (row.deadline ? formatDateGMT5(row.deadline) : "-"),
    },
    {
      key: "completionDate",
      label: "Completion Date",
      render: (row) =>
        row.completionDate ? formatDateGMT5(row.completionDate) : "-",
    },
    {
      key: "taskDescription",
      label: "Task Description",
      render: (row) => {
        const full = row.taskDescription || "";
        const truncated = truncateText(full);
        if (truncated === full) return full || "-";
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={styles.descriptionCell}>{truncated}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="whitespace-pre-wrap">{full}</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        if (row.status === "Completed (Early)") {
          return (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              Completed (Early)
            </Badge>
          );
        }
        if (row.status === "Completed (On Time)") {
          return (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              Completed (On Time)
            </Badge>
          );
        }
        if (row.status === "Completed (Late)") {
          return (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              Completed (Late)
            </Badge>
          );
        }
        if (row.status === "In Progress") {
          return (
            <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
              In Progress
            </Badge>
          );
        }
        if (row.status === "Closed (Early)") {
          return (
            <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50">
              Closed (Early)
            </Badge>
          );
        }
        if (row.status === "Closed (On Time)") {
          return (
            <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
              Closed (On Time)
            </Badge>
          );
        }
        if (row.status === "Closed (Late)") {
          return (
            <Badge className="bg-red-50 text-red-600 hover:bg-red-50">
              Closed (Late)
            </Badge>
          );
        }
        if (row.status === "Closed") {
          return (
            <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
              Closed
            </Badge>
          );
        }
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            Pending
          </Badge>
        );
      },
    },
    {
      key: "rating",
      label: "Rating",
      render: (row) => {
        if (row.rating != null) {
          return (
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((starIndex) => {
                const fillPercent = Math.min(
                  100,
                  Math.max(0, (row.rating - starIndex) * 100),
                );
                return (
                  <div
                    key={starIndex}
                    className="relative"
                    style={{ width: 14, height: 14 }}
                  >
                    <StarIcon
                      size={14}
                      className="absolute text-gray-200"
                      fill="currentColor"
                    />
                    <div
                      className="absolute overflow-hidden"
                      style={{ width: `${fillPercent}%`, height: 14 }}
                    >
                      <StarIcon
                        size={14}
                        className="text-yellow-400"
                        fill="currentColor"
                      />
                    </div>
                  </div>
                );
              })}
              <span className="ml-1 text-xs font-medium text-gray-600">
                {row.rating.toFixed(1)}
              </span>
            </div>
          );
        }
        return <span className="text-sm text-gray-400">-</span>;
      },
    },
    {
      key: "details",
      label: "Details",
      align: "center",
      render: (row) => (
        <div className="flex justify-center">
          <Button
            variant="link"
            className="cursor-pointer"
            disabled={pendingViewId === row._id}
            onClick={() => {
              setPendingViewId(row._id);
            }}
          >
            {pendingViewId === row._id ? (
              <Spinner className="h-4 w-4" />
            ) : (
              "View"
            )}
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

  // EVENT HANDLERS

  const resetForm = () => {
    setErrors({});
    setEditingReport(null);
    setSelectedEmployees([]);
    setEmployeeSearchQuery("");
    setDebouncedEmployeeQuery("");
    setAssignmentDate(undefined);
    setDeadlineDate(undefined);
    setDaysForCompletion("");
    setTaskDescription("");
    setLastChangedField(null);
  };

  const handleEdit = (row) => {
    if (row.status !== "Pending") {
      toast.error("Only tasks with Pending status can be edited");
      return;
    }
    setEditingReport(row);
    setSelectedEmployees(
      row.employees?.map((e) => ({
        _id: e._id,
        fullName: e.fullName,
        employeeID: e.employeeID,
      })) || [],
    );
    setAssignmentDate(
      row.assignmentDate ? new Date(row.assignmentDate) : undefined,
    );
    setDeadlineDate(row.deadline ? new Date(row.deadline) : undefined);
    setDaysForCompletion(
      row.daysForCompletion ? String(row.daysForCompletion) : "",
    );
    setTaskDescription(row.taskDescription || "");
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingReport(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingReport) {
      deleteMutation.mutate(deletingReport._id);
    }
  };

  const handleAddClick = () => {
    setDialogOpen(true);
  };

  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleLimitChange = (value) => {
    setLimit(Number(value));
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (data?.pagination && page < data.pagination.totalPages) {
      setPage(page + 1);
    }
  };

  const handleAssignmentDateSelect = (date) => {
    setAssignmentDate(date);
    setAssignDatePickerOpen(false);
    setLastChangedField("assignmentDate");
  };

  const handleDeadlineDateSelect = (date) => {
    setDeadlineDate(date);
    setDeadlineDatePickerOpen(false);
    setLastChangedField("deadline");
  };

  const handleDaysChange = (e) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      setDaysForCompletion(val);
      setLastChangedField("days");
    }
  };

  const handleAddEmployee = useCallback(
    (emp) => {
      const alreadyExists = selectedEmployees.some((e) => e._id === emp._id);
      if (alreadyExists) {
        toast.error(`${emp.fullName} is already added`);
        return;
      }
      setSelectedEmployees((prev) => [
        ...prev,
        { _id: emp._id, fullName: emp.fullName, employeeID: emp.employeeID },
      ]);
      setEmployeeSearchQuery("");
      setDebouncedEmployeeQuery("");
    },
    [selectedEmployees],
  );

  const handleRemoveEmployee = useCallback((empId) => {
    setSelectedEmployees((prev) => prev.filter((e) => e._id !== empId));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    const newErrors = {};

    if (selectedEmployees.length === 0) {
      newErrors.employee = "Please select at least one employee";
    }

    if (!assignmentDate) {
      newErrors.assignmentDate = "Assignment date is required";
    }

    if (!deadlineDate) {
      newErrors.deadline = "Deadline is required";
    }

    if (assignmentDate && deadlineDate && deadlineDate <= assignmentDate) {
      newErrors.deadline = "Deadline must be after the assignment date";
    }

    const days = parseInt(daysForCompletion, 10);
    if (!days || days < 1) {
      newErrors.daysForCompletion = "Days for completion must be at least 1";
    }

    if (!taskDescription?.trim()) {
      newErrors.taskDescription = "Task description is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      employees: selectedEmployees.map((e) => e._id),
      assignmentDate: assignmentDate.toISOString(),
      deadline: deadlineDate.toISOString(),
      daysForCompletion: days,
      taskDescription: taskDescription.trim(),
    };

    if (editingReport) {
      updateMutation.mutate({ id: editingReport._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // RENDER

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Work Progress Reports</h1>
        {isAdmin && (
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setTimeout(() => {
                  resetForm();
                }, 200);
              }
            }}
          >
            <Button
              variant="green"
              className="cursor-pointer"
              onClick={handleAddClick}
            >
              <PlusIcon size={16} />
              Assign Task
            </Button>
            <DialogContent className="sm:max-w-125">
              <DialogHeader>
                <DialogTitle className="flex justify-center text-[#02542D]">
                  {editingReport ? "Edit Task" : "Assign Task"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {editingReport
                    ? "Edit the task details below"
                    : "Assign a new task to employees"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                {errors.server && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{errors.server}</p>
                  </div>
                )}
                <div className="grid gap-4">
                  {/* Employee Search */}
                  <div className="grid gap-3">
                    <Label className="text-[#344054]">Employee</Label>
                    <div className="relative">
                      <div className="flex items-center">
                        <SearchIcon
                          size={16}
                          className="absolute left-3 text-gray-400 pointer-events-none"
                        />
                        <Input
                          type="text"
                          placeholder="Search by employee name or ID..."
                          value={employeeSearchQuery}
                          onChange={(e) =>
                            setEmployeeSearchQuery(e.target.value)
                          }
                          className="pl-9"
                        />
                        {isSearchingEmployees && (
                          <div className="absolute right-3">
                            <Spinner className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      {/* Search Results dropdown */}
                      {debouncedEmployeeQuery.length >= 1 &&
                        employeeSearchResults && (
                          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {filteredEmployeeResults.length === 0 ? (
                              <div className="p-3 text-sm text-gray-500 text-center">
                                No employees found
                              </div>
                            ) : (
                              filteredEmployeeResults.map((emp) => (
                                <div
                                  key={emp._id}
                                  className={cn(
                                    "flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50",
                                    emp.alreadyAdded
                                      ? "opacity-50 cursor-default"
                                      : "cursor-pointer",
                                  )}
                                  onClick={() =>
                                    !emp.alreadyAdded && handleAddEmployee(emp)
                                  }
                                >
                                  <div>
                                    <span className="font-medium">
                                      {emp.fullName}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {emp.employeeID}
                                    </span>
                                  </div>
                                  {emp.alreadyAdded && (
                                    <span className="text-xs text-muted-foreground italic">
                                      Already added
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                    </div>
                    {/* Selected Employees Pills */}
                    {selectedEmployees.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedEmployees.map((emp) => (
                          <Badge
                            key={emp._id}
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 gap-1 pr-1"
                          >
                            {emp.fullName} ({emp.employeeID})
                            <button
                              type="button"
                              className="ml-0.5 rounded-full hover:bg-green-200 p-0.5 cursor-pointer"
                              onClick={() => handleRemoveEmployee(emp._id)}
                            >
                              <XIcon size={12} />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    {errors.employee && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.employee}
                      </p>
                    )}
                  </div>

                  {/* Assignment Date */}
                  <div className="grid gap-3">
                    <Label className="text-[#344054]">Assignment Date</Label>
                    <Popover
                      open={assignDatePickerOpen}
                      onOpenChange={setAssignDatePickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal cursor-pointer",
                            !assignmentDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {assignmentDate
                            ? formatDate(assignmentDate)
                            : "Pick assignment date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={assignmentDate}
                          onSelect={handleAssignmentDateSelect}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {errors.assignmentDate && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.assignmentDate}
                      </p>
                    )}
                  </div>

                  {/* Deadline Date */}
                  <div className="grid gap-3">
                    <Label className="text-[#344054]">Deadline</Label>
                    <Popover
                      open={deadlineDatePickerOpen}
                      onOpenChange={setDeadlineDatePickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal cursor-pointer",
                            !deadlineDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {deadlineDate
                            ? formatDate(deadlineDate)
                            : "Pick deadline date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={deadlineDate}
                          onSelect={handleDeadlineDateSelect}
                          disabled={(date) =>
                            assignmentDate ? date <= assignmentDate : false
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {errors.deadline && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.deadline}
                      </p>
                    )}
                  </div>

                  {/* Days for Completion */}
                  <div className="grid gap-3">
                    <Label className="text-[#344054]">
                      Days for Completion
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Auto-calculated or enter days"
                      value={daysForCompletion}
                      onChange={handleDaysChange}
                    />
                    {errors.daysForCompletion && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.daysForCompletion}
                      </p>
                    )}
                  </div>

                  {/* Task Description */}
                  <div className="grid gap-3">
                    <Label className="text-[#344054]">Task Description</Label>
                    <Textarea
                      placeholder="Enter task description..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      rows={3}
                    />
                    {errors.taskDescription && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.taskDescription}
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
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="cursor-pointer"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <>
                        <Spinner />
                        {editingReport ? "Updating" : "Assigning"}
                      </>
                    ) : editingReport ? (
                      "Update"
                    ) : (
                      "Assign"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            placeholder="Search by employee name, ID, or description..."
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
        data={data?.workProgressReports || []}
        onEdit={isAdmin ? handleEdit : undefined}
        onDelete={isAdmin ? handleDelete : undefined}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading work progress reports..."
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

            {(() => {
              const { currentPage, totalPages } = data.pagination;
              const pages = [];

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

              if (currentPage > 3) {
                pages.push(
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>,
                );
              }

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

              if (currentPage < totalPages - 2) {
                pages.push(
                  <PaginationItem key="ellipsis-end">
                    <PaginationEllipsis />
                  </PaginationItem>,
                );
              }

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

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setTimeout(() => {
              setDeletingReport(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Task
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be
              undone.
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

      {/* View Details Modal */}
      <ViewDetailsModal
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) {
            setTimeout(() => setViewReportId(null), 300);
          }
        }}
        reportId={viewReportId}
        userRole={userRole}
      />
    </div>
  );
};

export default WorkProgressReports;
