import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import EyeIcon from "lucide-react/dist/esm/icons/eye";
import RefreshCcwIcon from "lucide-react/dist/esm/icons/refresh-ccw";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import SlidersHorizontalIcon from "lucide-react/dist/esm/icons/sliders-horizontal";
import { toast } from "sonner";

import DataTable from "@/components/DataTable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

import { fetchDepartmentsList } from "@/services/departmentsApi";
import { fetchPositionsFilters } from "@/services/positionsApi";
import {
  downloadPayslipPdf,
  fetchPayslip,
  fetchPayrolls,
  markPayrollAsPaid,
  regenerateEmployeePayroll,
} from "@/services/payrollApi";

import styles from "./Payroll.module.css";

const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = CURRENT_YEAR - 2;
const YEARS = Array.from(
  { length: CURRENT_YEAR - START_YEAR + 1 },
  (_, index) => String(START_YEAR + index),
);
const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const monthLabel = (month) =>
  MONTHS.find((item) => Number(item.value) === Number(month))?.label || "-";

const currency = (value) => `PKR ${Number(value || 0).toLocaleString()}`;
const amount = (value) => Number(value || 0).toLocaleString();
const sumAmounts = (items = []) =>
  items.reduce((sum, item) => {
    if (typeof item === "number") return sum + Number(item || 0);
    return sum + Number(item?.amount || 0);
  }, 0);
const Payroll = () => {
  const { year: routeYear, month: routeMonth } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") || "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    searchParams.get("search") || "",
  );
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [limit, setLimit] = useState(Number(searchParams.get("limit") || 10));

  const [filterDepartment, setFilterDepartment] = useState(
    searchParams.get("department") || "",
  );
  const [filterPosition, setFilterPosition] = useState(
    searchParams.get("position") || "",
  );
  const filterYear = routeYear || "";
  const filterMonth = routeMonth || "";

  const [tempFilterDepartment, setTempFilterDepartment] = useState("");
  const [tempFilterPosition, setTempFilterPosition] = useState("");
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [isFiltersLoading, setIsFiltersLoading] = useState(false);

  const generationErrors = [];
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  const [selectedPayslipId, setSelectedPayslipId] = useState(null);
  const [payslipDialogOpen, setPayslipDialogOpen] = useState(false);
  const [openingPayslipId, setOpeningPayslipId] = useState(null);
  const [isDownloadingPayslip, setIsDownloadingPayslip] = useState(false);

  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateProgress, setRegenerateProgress] = useState({
    processed: 0,
    total: 0,
    percent: 0,
    currentEmployee: "",
  });
  const [regenerateSummary, setRegenerateSummary] = useState(null);
  const [selectedPayrollIds, setSelectedPayrollIds] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue), 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    const params = {};
    if (page !== 1) params.page = String(page);
    if (limit !== 10) params.limit = String(limit);
    if (debouncedSearch) params.search = debouncedSearch;
    if (filterDepartment) params.department = filterDepartment;
    if (filterPosition) params.position = filterPosition;

    setSearchParams(params, { replace: true });
  }, [
    page,
    limit,
    debouncedSearch,
    filterDepartment,
    filterPosition,
    setSearchParams,
  ]);

  const {
    data: payrollData,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: [
      "payrolls",
      {
        page,
        limit,
        search: debouncedSearch,
        department: filterDepartment,
        position: filterPosition,
        year: filterYear,
        month: filterMonth,
      },
    ],
    queryFn: () =>
      fetchPayrolls({
        page,
        limit,
        search: debouncedSearch,
        department: filterDepartment,
        position: filterPosition,
        year: filterYear,
        month: filterMonth,
      }),
  });

  const {
    data: departmentsList,
    refetch: fetchDepartments,
    isLoading: isLoadingDepartments,
  } = useQuery({
    queryKey: ["departmentsList"],
    queryFn: fetchDepartmentsList,
    enabled: false,
  });

  const {
    data: positionsFilters,
    refetch: fetchPositions,
    isLoading: isLoadingPositions,
  } = useQuery({
    queryKey: ["positionsFilters"],
    queryFn: fetchPositionsFilters,
    enabled: false,
  });

  const { data: payslipData } = useQuery({
    queryKey: ["payslip", selectedPayslipId],
    queryFn: () => fetchPayslip(selectedPayslipId),
    enabled: Boolean(selectedPayslipId) && payslipDialogOpen,
  });

  const markAsPaidMutation = useMutation({
    mutationFn: (id) => markPayrollAsPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      queryClient.invalidateQueries({ queryKey: ["payrollMonthlySummary"] });
      queryClient.invalidateQueries({ queryKey: ["payslip", selectedPayslipId] });
      toast.success("Payroll marked as paid");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to mark as paid");
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (targets) => {
      const total = targets.length;
      const failed = [];
      let success = 0;

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        setRegenerateProgress({
          processed: i,
          total,
          percent: Math.round((i / Math.max(total, 1)) * 100),
          currentEmployee: target.employeeName || "",
        });

        try {
          await regenerateEmployeePayroll({
            employeeId: target.employeeId,
            year: target.year,
            month: target.month,
          });
          success++;
        } catch (error) {
          failed.push({
            employeeName: target.employeeName || "Employee",
            error:
              error?.response?.data?.message ||
              error?.message ||
              "Failed to regenerate payroll",
          });
        }
      }

      return { total, success, failed };
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      queryClient.invalidateQueries({ queryKey: ["payrollMonthlySummary"] });
      setRegenerateProgress({ processed: 0, total: 0, percent: 0, currentEmployee: "" });
      setRegenerateSummary(response);
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to regenerate payroll",
      );
    },
  });

  useEffect(() => {
    setSelectedPayrollIds([]);
  }, [
    page,
    limit,
    debouncedSearch,
    filterDepartment,
    filterPosition,
  ]);

  const selectedPayrollTargets = useMemo(() => {
    const payrollRows = payrollData?.payrolls || [];

    return payrollRows
      .filter((row) => selectedPayrollIds.includes(row._id || row.id))
      .filter((row) => !row.isPaid)
      .map((row) => ({
        employeeId: row.employee,
        employeeName: row.employeeSnapshot?.fullName,
        month: row.month,
        year: row.year,
      }))
      .filter((target) => target.employeeId && target.month && target.year);
  }, [payrollData, selectedPayrollIds]);

  const uniquePositionNames = useMemo(() => {
    return (
      positionsFilters?.positionsFiltersList
        ?.map((position) => position.name)
        .filter((value, index, self) => self.indexOf(value) === index) || []
    );
  }, [positionsFilters]);

  const handleFilterPopoverOpenChange = (open) => {
    setFilterPopoverOpen(open);
  };

  const handleFilterClick = async (event) => {
    event.preventDefault();
    setIsFiltersLoading(true);
    try {
      await Promise.all([fetchDepartments(), fetchPositions()]);
      setTempFilterDepartment(filterDepartment);
      setTempFilterPosition(filterPosition);
      setFilterPopoverOpen(true);
    } catch {
      toast.error("Failed to load filters");
    } finally {
      setIsFiltersLoading(false);
    }
  };

  const applyFilters = () => {
    setFilterDepartment(tempFilterDepartment);
    setFilterPosition(tempFilterPosition);
    setPage(1);
    setFilterPopoverOpen(false);
  };

  const resetFilters = () => {
    setTempFilterDepartment("");
    setTempFilterPosition("");
    setFilterDepartment("");
    setFilterPosition("");
    setPage(1);
    setFilterPopoverOpen(false);
  };

  const openPayslip = async (payrollRow) => {
    const payrollId = payrollRow._id;
    if (!payrollId || openingPayslipId) return;

    setOpeningPayslipId(payrollId);
    try {
      await queryClient.fetchQuery({
        queryKey: ["payslip", payrollId],
        queryFn: () => fetchPayslip(payrollId),
      });

      setSelectedPayslipId(payrollId);
      setPayslipDialogOpen(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load payslip");
    } finally {
      setOpeningPayslipId(null);
    }
  };

  const handleDownloadPayslip = async () => {
    if (!selectedPayslipId || isDownloadingPayslip) return;

    try {
      setIsDownloadingPayslip(true);
      await queryClient.fetchQuery({
        queryKey: ["payslip", selectedPayslipId],
        queryFn: () => fetchPayslip(selectedPayslipId),
      });

      const blob = await downloadPayslipPdf(selectedPayslipId);
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `payslip-${selectedPayslipId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to download payslip",
      );
    } finally {
      setIsDownloadingPayslip(false);
    }
  };

  const openRegenerateDialog = () => {
    if (!selectedPayrollTargets.length) return;
    setRegenerateDialogOpen(true);
  };

  const confirmRegenerate = () => {
    if (!selectedPayrollTargets.length) return;
    regenerateMutation.mutate(selectedPayrollTargets);
  };

  const columns = [
    {
      key: "monthYear",
      label: "Month (Year)",
      render: (row) => `${monthLabel(row.month)} (${row.year || "-"})`,
    },
    {
      key: "employeeNameId",
      label: "Employee Name (ID)",
      render: (row) => {
        const fullName = row.employeeSnapshot?.fullName || "-";
        const employeeID = row.employeeSnapshot?.employeeID || "-";
        return `${fullName} (${employeeID})`;
      },
    },
    {
      key: "basicSalary",
      label: "Basic Salary",
      render: (row) =>
        amount(
          row.employeeSnapshot?.basicSalary ||
            Math.max(
              0,
              ...(row.salarySegments || []).map((segment) =>
                Number(segment?.basicSalary || 0),
              ),
            ) ||
            row.calculations?.fullBasicSalaryAmount ||
            row.calculations?.basicSalaryAmount,
        ),
    },
    {
      key: "allowances",
      label: "Allowances",
      render: (row) =>
        amount(
          sumAmounts(row.allowanceBreakdown || []) ||
            row.calculations?.fullAllowanceAmount ||
            row.calculations?.allowanceAmount,
        ),
    },
    {
      key: "netSalary",
      label: "Net Salary",
      render: (row) =>
        amount(row.calculations?.netSalary || row.calculations?.totalSalary),
    },
    {
      key: "totalDeductions",
      label: "Total Deductions",
      render: (row) => {
        const fullBasicSalary =
          Number(row.employeeSnapshot?.basicSalary || 0) ||
          Math.max(
            0,
            ...(row.salarySegments || []).map((segment) =>
              Number(segment?.basicSalary || 0),
            ),
          ) ||
          Number(row.calculations?.fullBasicSalaryAmount || 0) ||
          Number(row.calculations?.basicSalaryAmount || 0);
        const fullAllowances =
          sumAmounts(row.allowanceBreakdown || []) ||
          Number(row.calculations?.fullAllowanceAmount || 0) ||
          Number(row.calculations?.allowanceAmount || 0);
        const attendanceDeductions =
          Number(row.calculations?.attendanceDeductionAmount || 0) ||
          Math.max(
            0,
            fullBasicSalary +
              fullAllowances -
              Number(row.calculations?.grossSalary || 0),
          );

        return amount(
          attendanceDeductions +
            Number(row.calculations?.latePenaltyAmount || 0) +
            Number(row.calculations?.manualDeductionAmount || 0) +
            Number(row.calculations?.loanDeductionAmount || 0),
        );
      },
    },
    {
      key: "isPaid",
      label: "Paid",
      render: (row) => (
        <Badge variant={row.isPaid ? "default" : "secondary"}>
          {row.isPaid ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "salarySlip",
      label: "Salary Slip View",
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openPayslip(row)}
          disabled={openingPayslipId === row._id}
        >
          {openingPayslipId === row._id ? (
            <Spinner className={styles.actionIcon} />
          ) : (
            <EyeIcon className={styles.actionIcon} />
          )}
          View
        </Button>
      ),
    },
  ];

  const pagination = payrollData?.pagination || {};
  const totalPages = pagination.totalPages || 1;
  const payslip = payslipData?.payslip;
  const presentCount =
    Number(payslip?.workingDays?.present || 0) +
    Number(payslip?.workingDays?.late || 0) +
    Number(payslip?.workingDays?.halfDay || 0);
  const fullAllowanceAmount =
    sumAmounts(payslip?.allowanceBreakdown || []) ||
    Number(payslip?.calculations?.fullAllowanceAmount || 0);
  const fullBasicSalaryAmount =
    Number(payslip?.employeeSnapshot?.basicSalary || 0) ||
    Math.max(
      0,
      ...(payslip?.salarySegments || []).map((segment) =>
        Number(segment?.basicSalary || 0),
      ),
    ) ||
    Number(payslip?.calculations?.fullBasicSalaryAmount || 0) ||
    Number(payslip?.calculations?.basicSalaryAmount || 0);
  const storedAttendanceDeductionBreakdown =
    payslip?.attendanceDeductionBreakdown || [];
  const manualDeductionBreakdown = (payslip?.deductionBreakdown || []).filter(
    (item) => item.status === "deducted",
  );
  const pendingManualDeductionBreakdown = (
    payslip?.deductionBreakdown || []
  ).filter((item) => item.status === "pending");
  const totalManualDeduction = Number(
    payslip?.calculations?.manualDeductionAmount || 0,
  );
  const loanDeductionAmount = Number(
    payslip?.calculations?.loanDeductionAmount || 0,
  );
  const loanDeductionBreakdown = payslip?.loanDeductionBreakdown || [];
  const latePenaltyAmount = Number(
    payslip?.calculations?.latePenaltyAmount || 0,
  );
  const latePenaltyBasicAmount = Number(
    payslip?.calculations?.latePenaltyBasicAmount || 0,
  );
  const latePenaltyAllowanceAmount = Number(
    payslip?.calculations?.latePenaltyAllowanceAmount || 0,
  );
  const displayedLateCount =
    Number(payslip?.calculations?.lateCount || 0) ||
    Number(payslip?.workingDays?.late || 0);
  const displayedLatePenaltyGroups =
    Number(payslip?.calculations?.latePenaltyGroups || 0) ||
    Math.floor(displayedLateCount / 3);
  const totalScheduledDays = Number(
    payslip?.calculations?.calendarDaysInMonth ||
      payslip?.workingDays?.totalScheduled ||
      0,
  );
  const basicPerScheduledDay =
    totalScheduledDays > 0 ? fullBasicSalaryAmount / totalScheduledDays : 0;
  const allowancePerScheduledDay =
    totalScheduledDays > 0 ? fullAllowanceAmount / totalScheduledDays : 0;
  const storedAttendanceDeductionAmount = Number(
    payslip?.calculations?.attendanceDeductionAmount || 0,
  );
  const totalCompensationAmount = fullBasicSalaryAmount + fullAllowanceAmount;
  const basicCompensationRatio =
    totalCompensationAmount > 0
      ? fullBasicSalaryAmount / totalCompensationAmount
      : 1;
  const allowanceCompensationRatio =
    totalCompensationAmount > 0
      ? fullAllowanceAmount / totalCompensationAmount
      : 0;
  const inferredAttendanceBreakdown = [
    {
      key: "absent",
      label: "Absent",
      count: Number(payslip?.workingDays?.absences || 0),
      basicAmount: basicPerScheduledDay * Number(payslip?.workingDays?.absences || 0),
      allowanceAmount:
        allowancePerScheduledDay * Number(payslip?.workingDays?.absences || 0),
    },
    {
      key: "unpaidLeave",
      label: "Unpaid Leave",
      count: Number(payslip?.workingDays?.unpaidLeaves || 0),
      basicAmount:
        basicPerScheduledDay * Number(payslip?.workingDays?.unpaidLeaves || 0),
      allowanceAmount:
        allowancePerScheduledDay * Number(payslip?.workingDays?.unpaidLeaves || 0),
    },
    {
      key: "halfDay",
      label: "Half Day",
      count: Number(payslip?.workingDays?.halfDay || 0),
      basicAmount:
        basicPerScheduledDay * Number(payslip?.workingDays?.halfDay || 0) * 0.5,
      allowanceAmount:
        allowancePerScheduledDay *
        Number(payslip?.workingDays?.halfDay || 0) *
        0.5,
    },
  ]
    .filter((item) => item.count > 0)
    .map((item) => ({
      ...item,
      basicAmount: Number(item.basicAmount.toFixed(2)),
      allowanceAmount: Number(item.allowanceAmount.toFixed(2)),
      totalAmount: Number((item.basicAmount + item.allowanceAmount).toFixed(2)),
      isInferred: true,
    }));
  const attendanceDeductionBreakdown =
    storedAttendanceDeductionBreakdown.length > 0
      ? storedAttendanceDeductionBreakdown
      : inferredAttendanceBreakdown;
  const storedAttendanceBasicBreakdownAmount = sumAmounts(
    attendanceDeductionBreakdown.map((item) => item?.basicAmount || 0),
  );
  const storedAttendanceAllowanceBreakdownAmount = sumAmounts(
    attendanceDeductionBreakdown.map((item) => item?.allowanceAmount || 0),
  );
  const inferredAttendanceBasicAmount =
    storedAttendanceDeductionAmount > 0
      ? storedAttendanceDeductionAmount * basicCompensationRatio
      : storedAttendanceBasicBreakdownAmount;
  const inferredAttendanceAllowanceAmount =
    storedAttendanceDeductionAmount > 0
      ? storedAttendanceDeductionAmount * allowanceCompensationRatio
      : storedAttendanceAllowanceBreakdownAmount;
  const displayedBasicAttendanceDeduction =
    storedAttendanceBasicBreakdownAmount || inferredAttendanceBasicAmount;
  const displayedAllowanceAttendanceDeduction =
    storedAttendanceAllowanceBreakdownAmount || inferredAttendanceAllowanceAmount;
  const hasEmploymentPeriodAdjustment = false;
  const employmentAdjustmentBasicAmount = 0;
  const employmentAdjustmentAllowanceAmount = 0;
  const employmentAdjustmentAmount =
    employmentAdjustmentBasicAmount + employmentAdjustmentAllowanceAmount;
  const employmentAdjustmentLabel = "";
  const employmentAdjustmentMeta = "";
  const displayedBasicDeduction =
    displayedBasicAttendanceDeduction +
    latePenaltyBasicAmount +
    employmentAdjustmentBasicAmount;
  const displayedAllowanceDeduction =
    displayedAllowanceAttendanceDeduction +
    latePenaltyAllowanceAmount +
    employmentAdjustmentAllowanceAmount;
  const displayedAttendanceDeductionAmount =
    storedAttendanceDeductionAmount ||
    sumAmounts(attendanceDeductionBreakdown.map((item) => item?.totalAmount || 0));
  const totalDeductions =
    displayedAttendanceDeductionAmount +
    latePenaltyAmount +
    totalManualDeduction +
    loanDeductionAmount +
    employmentAdjustmentAmount;
  const displayedTotalDeductions = totalDeductions;
  const showLegacyDeductionSection = false;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {monthLabel(filterMonth)} {filterYear} — Payroll
        </h1>
        <div className={styles.headerActions}>
          <Button
            variant="outline"
            className="cursor-pointer relative"
            disabled={
              selectedPayrollTargets.length === 0 ||
              regenerateMutation.isPending
            }
            onClick={openRegenerateDialog}
          >
            {regenerateMutation.isPending ? (
              <Spinner className={styles.buttonSpinner} />
            ) : (
              <RefreshCcwIcon className={styles.buttonIcon} />
            )}
            Regenerate
            {selectedPayrollTargets.length > 0 && (
              <Badge className="ml-1.5 h-5 min-w-5 px-1.5 bg-primary text-white text-[11px] font-semibold">
                {selectedPayrollTargets.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      <div className={styles.controls}>
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setPage(1);
            }}
            placeholder="Search employees..."
          />
          <InputGroupAddon>
            <SearchIcon className={styles.searchIcon} />
          </InputGroupAddon>
          <InputGroupAddon
            align="inline-end"
            className="cursor-pointer hover:text-primary"
            onClick={() => {
              setSearchValue("");
              setDebouncedSearch("");
              setPage(1);
            }}
          >
            {isFetching && debouncedSearch ? (
              <Spinner className={styles.searchSpinner} />
            ) : (
              <CircleXIcon className={styles.searchIconClickable} />
            )}
          </InputGroupAddon>
        </InputGroup>

        <Select
          value={String(limit)}
          onValueChange={(value) => {
            setLimit(Number(value));
            setPage(1);
          }}
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

        <Popover
          open={filterPopoverOpen}
          onOpenChange={handleFilterPopoverOpenChange}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Filters"
              className="cursor-pointer"
              disabled={isFiltersLoading}
              onClick={handleFilterClick}
            >
              {isFiltersLoading ? (
                <Spinner className={styles.filterSpinner} />
              ) : (
                <SlidersHorizontalIcon />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            {isLoadingDepartments || isLoadingPositions ? (
              <div className="flex items-center justify-center py-6">
                <Spinner className={styles.filterSpinner} />
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="leading-none font-medium">Filters</h4>
                  <p className="text-muted-foreground text-sm">
                    Apply the filters for payroll records.
                  </p>
                </div>

                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="department">Department</Label>
                    <Select
                      value={tempFilterDepartment || "all"}
                      onValueChange={(value) =>
                        setTempFilterDepartment(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger className="w-full col-span-2">
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Departments</SelectItem>
                          {departmentsList?.map((department) => (
                            <SelectItem
                              key={department._id}
                              value={department.name}
                            >
                              {department.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="position">Position</Label>
                    <Select
                      value={tempFilterPosition || "all"}
                      onValueChange={(value) =>
                        setTempFilterPosition(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger className="w-full col-span-2">
                        <SelectValue placeholder="All positions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Positions</SelectItem>
                          {uniquePositionNames.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
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
                    className="cursor-pointer flex-1"
                    onClick={applyFilters}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    className="cursor-pointer flex-1"
                    onClick={resetFilters}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

        <DataTable
        columns={columns}
        data={payrollData?.payrolls || []}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading payrolls"
        selectable={true}
        selectedIds={selectedPayrollIds}
        onSelectionChange={setSelectedPayrollIds}
        isRowSelectable={(row) => !row.isPaid}
      />

      <Pagination className={styles.paginationWrap}>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              className={page <= 1 ? styles.disabledPageLink : ""}
            />
          </PaginationItem>

          {Array.from({ length: totalPages }, (_, index) => index + 1)
            .filter(
              (pageNo) =>
                pageNo === 1 ||
                pageNo === totalPages ||
                Math.abs(pageNo - page) <= 1,
            )
            .map((pageNo, index, array) => {
              const previousPageNo = array[index - 1];
              const showEllipsis =
                previousPageNo && pageNo - previousPageNo > 1;

              return (
                <div key={pageNo} className={styles.paginationInline}>
                  {showEllipsis && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  <PaginationItem>
                    <PaginationLink
                      isActive={page === pageNo}
                      onClick={() => setPage(pageNo)}
                    >
                      {pageNo}
                    </PaginationLink>
                  </PaginationItem>
                </div>
              );
            })}

          <PaginationItem>
            <PaginationNext
              onClick={() =>
                setPage((previous) => Math.min(totalPages, previous + 1))
              }
              className={page >= totalPages ? styles.disabledPageLink : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <DialogContent className={`sm:max-w-2xl ${styles.payslipDialogContent}`}>
          <DialogHeader>
            <DialogTitle>Payroll Generation Errors</DialogTitle>
            <DialogDescription>
              Review failed employees below. Each entry shows employee,
              month/year, and failure reason.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className={styles.errorListScroll}>
            <div className={styles.errorListWrap}>
              {generationErrors.map((item, index) => (
                <div
                  key={`${item.employeeId}-${index}`}
                  className={styles.errorItem}
                >
                  <div className={styles.errorItemHeader}>
                    <span className={styles.errorEmployee}>
                      {item.employeeName}
                    </span>
                    <span className={styles.errorPeriod}>
                      {monthLabel(item.month)} {item.year}
                    </span>
                  </div>
                  <ScrollArea className={styles.errorReasonScroll}>
                    <div className={styles.errorReason}>
                      {item.reasonMessage}
                    </div>
                  </ScrollArea>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog
        open={payslipDialogOpen}
        onOpenChange={(open) => {
          setPayslipDialogOpen(open);
          if (!open) setSelectedPayslipId(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div>
            <DialogHeader>
              <div className="px-6 pt-6">
                <DialogTitle>Payslip</DialogTitle>
                <DialogDescription>
                  {monthLabel(payslipData?.payslip?.month)}{" "}
                  {payslipData?.payslip?.year}
                </DialogDescription>
              </div>
            </DialogHeader>

            <ScrollArea className={styles.payslipScrollArea}>
              <div className={styles.payslipContent}>
              <div className={styles.payslipInfoGrid}>
                <div className={styles.payslipInfoGroup}>
                  <div className={styles.payslipInfoLabel}>Employee</div>
                  <div className={styles.payslipInfoValue}>
                    {payslip?.employeeSnapshot?.fullName || "-"} (
                    {payslip?.employeeSnapshot?.employeeID || "-"})
                  </div>
                </div>
                <div className={styles.payslipInfoGroup}>
                  <div className={styles.payslipInfoLabel}>Position</div>
                  <div className={styles.payslipInfoValue}>
                    {payslip?.employeeSnapshot?.positionName || "-"}
                  </div>
                </div>
                <div className={styles.payslipInfoGroup}>
                  <div className={styles.payslipInfoLabel}>Joining Date</div>
                  <div className={styles.payslipInfoValue}>
                    {payslip?.employeeSnapshot?.joiningDate
                      ? new Date(
                          payslip.employeeSnapshot.joiningDate,
                        ).toLocaleDateString()
                      : "-"}
                  </div>
                </div>
                <div className={styles.payslipInfoGroup}>
                  <div className={styles.payslipInfoLabel}>Department</div>
                  <div className={styles.payslipInfoValue}>
                    {payslip?.employeeSnapshot?.departmentName || "-"}
                  </div>
                </div>
                <div className={styles.payslipInfoGroup}>
                  <div className={styles.payslipInfoLabel}>Net Salary</div>
                  <div className={styles.payslipInfoValue}>
                    {currency(
                      payslip?.calculations?.netSalary ||
                        payslip?.calculations?.totalSalary,
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className={styles.payslipSectionTitle}>Attendance</div>
              <div className={styles.payslipAttendanceGrid}>
                <div className={styles.payslipAttendanceStat}>
                  <div className={styles.payslipStatValue}>
                    {payslip?.workingDays?.totalScheduled ?? 0}
                  </div>
                  <div className={styles.payslipStatLabel}>Working Days</div>
                </div>
                <div className={styles.payslipAttendanceStat}>
                  <div className={styles.payslipStatValue}>{presentCount}</div>
                  <div className={styles.payslipStatLabel}>Present</div>
                  <div className={styles.payslipStatBadgeRow}>
                    <Badge
                      variant="outline"
                      className={styles.payslipStatBadge}
                    >
                      Half Day {payslip?.workingDays?.halfDay ?? 0}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={styles.payslipStatBadge}
                    >
                      Late {payslip?.workingDays?.late ?? 0}
                    </Badge>
                  </div>
                </div>
                <div className={styles.payslipAttendanceStat}>
                  <div className={styles.payslipStatValue}>
                    {payslip?.workingDays?.leaves ?? 0}
                  </div>
                  <div className={styles.payslipStatLabel}>Leave</div>
                  <div className={styles.payslipStatBadgeRow}>
                    <Badge
                      variant="outline"
                      className={styles.payslipStatBadge}
                    >
                      Paid {payslip?.workingDays?.paidLeaves ?? 0}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={styles.payslipStatBadge}
                    >
                      Unpaid {payslip?.workingDays?.unpaidLeaves ?? 0}
                    </Badge>
                  </div>
                </div>
                <div className={styles.payslipAttendanceStat}>
                  <div className={styles.payslipStatValue}>
                    {payslip?.workingDays?.absences ?? 0}
                  </div>
                  <div className={styles.payslipStatLabel}>Absent</div>
                </div>
              </div>

              <Separator />

              <div className={styles.payslipSectionTitle}>Salary</div>
              <div className={styles.payslipBreakdownWrap}>
                <div className={styles.payslipBreakdownRow}>
                  <span className={styles.payslipBreakdownLabel}>
                    Basic Salary
                  </span>
                  <span className={styles.payslipBreakdownAmount}>
                    {currency(fullBasicSalaryAmount)}
                  </span>
                </div>
                {(payslip?.allowanceBreakdown || []).length > 0 && (
                  <>
                    <div className={styles.payslipAllowanceHeader}>
                      Allowances
                    </div>
                    {(payslip?.allowanceBreakdown || []).map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className={styles.payslipAllowanceRow}
                      >
                        <span className={styles.payslipAllowanceName}>
                          {item.name}
                        </span>
                        <span className={styles.payslipAllowanceAmount}>
                          {currency(item.amount)}
                        </span>
                      </div>
                    ))}
                    <div className={styles.payslipAllowanceTotalRow}>
                      <span>Total Allowances</span>
                      <span>{currency(fullAllowanceAmount)}</span>
                    </div>
                  </>
                )}
                <div className={styles.payslipBreakdownRow}>
                    <span className={styles.payslipBreakdownLabel}>
                    Gross Salary
                    </span>
                    <span className={styles.payslipBreakdownAmount}>
                      {currency(fullBasicSalaryAmount + fullAllowanceAmount)}
                    </span>
                  </div>
                {Number(payslip?.calculations?.perDaySalary || 0) > 0 && (
                  <div className={styles.payslipBreakdownRow}>
                    <span className={styles.payslipBreakdownLabel}>
                      Per Day Salary
                    </span>
                    <span className={styles.payslipBreakdownAmount}>
                      {currency(payslip?.calculations?.perDaySalary)}
                    </span>
                  </div>
                )}
                {Number(payslip?.calculations?.arrearsAmount || 0) !== 0 && (
                  <div className={styles.payslipBreakdownRow}>
                    <span className={styles.payslipBreakdownLabel}>
                      Arrears
                    </span>
                    <span className={styles.payslipBreakdownAmount}>
                      {currency(payslip?.calculations?.arrearsAmount)}
                    </span>
                  </div>
                )}
              </div>

              <>
                <div className={styles.payslipSectionTitle}>Deductions</div>
                <div className={styles.payslipBreakdownWrap}>
                    <div className={styles.payslipBreakdownRow}>
                      <span className={styles.payslipBreakdownLabel}>
                        Deducted From Basic Salary
                      </span>
                      <span className={styles.payslipNegativeAmount}>
                        -{currency(displayedBasicDeduction)}
                      </span>
                    </div>
                    <div className={styles.payslipBreakdownRow}>
                      <span className={styles.payslipBreakdownLabel}>
                        Deducted From Allowances
                      </span>
                      <span className={styles.payslipNegativeAmount}>
                        -{currency(displayedAllowanceDeduction)}
                      </span>
                    </div>
                    {(hasEmploymentPeriodAdjustment &&
                      employmentAdjustmentAmount > 0) ||
                    attendanceDeductionBreakdown.length > 0 ||
                    latePenaltyAmount > 0 ? (
                    <>
                      <div className={styles.payslipAllowanceHeader}>
                        Deduction Breakdown
                      </div>
                      {hasEmploymentPeriodAdjustment &&
                        employmentAdjustmentAmount > 0 && (
                          <div className={styles.payslipBreakdownDetailRow}>
                            <div>
                              <div className={styles.payslipBreakdownLabel}>
                                {employmentAdjustmentLabel}
                              </div>
                              <div className={styles.payslipBreakdownMeta}>
                                {employmentAdjustmentMeta}
                              </div>
                            </div>
                            <span className={styles.payslipNegativeAmount}>
                              -{currency(employmentAdjustmentAmount)}
                            </span>
                          </div>
                        )}
                      {attendanceDeductionBreakdown.map((item) => (
                        <div
                          key={item.key}
                          className={styles.payslipBreakdownDetailRow}
                        >
                          <div>
                            <div className={styles.payslipBreakdownLabel}>
                              {item.label}
                            </div>
                            <div className={styles.payslipBreakdownMeta}>
                              {`Count ${item.count} | Basic ${currency(item.basicAmount)} | Allowances ${currency(item.allowanceAmount)}`}
                            </div>
                          </div>
                          <span className={styles.payslipNegativeAmount}>
                            -{currency(item.totalAmount)}
                          </span>
                        </div>
                      ))}
                      {latePenaltyAmount > 0 && (
                        <div className={styles.payslipBreakdownDetailRow}>
                          <div>
                            <div className={styles.payslipBreakdownLabel}>
                              Late Penalty
                            </div>
                            <div className={styles.payslipBreakdownMeta}>
                              {displayedLateCount} late marks |{" "}
                              {displayedLatePenaltyGroups} late penalty{" "}
                              {displayedLatePenaltyGroups === 1
                                ? "group"
                                : "groups"}
                            </div>
                          </div>
                          <span className={styles.payslipNegativeAmount}>
                            -{currency(latePenaltyAmount)}
                          </span>
                        </div>
                      )}
                    </>
                    ) : null}
                  {totalManualDeduction > 0 && (
                    <>
                      <div className={styles.payslipAllowanceHeader}>
                        Manual Deduction Breakdown
                      </div>
                      {manualDeductionBreakdown.length > 0 ? (
                        manualDeductionBreakdown.map((item, index) => (
                          <div
                            key={`deduction-${index}`}
                            className={styles.payslipBreakdownDetailRow}
                          >
                            <span className={styles.payslipBreakdownLabel}>
                              {item.reason}
                            </span>
                            <span className={styles.payslipNegativeAmount}>
                              -{currency(item.amount)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.payslipBreakdownDetailRow}>
                          <span className={styles.payslipBreakdownLabel}>
                            Manual Deduction
                          </span>
                          <span className={styles.payslipNegativeAmount}>
                            -{currency(totalManualDeduction)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {pendingManualDeductionBreakdown.length > 0 && (
                    <>
                      <div className={styles.payslipAllowanceHeader}>
                        Pending Manual Deductions
                      </div>
                      {pendingManualDeductionBreakdown.map((item, index) => (
                        <div
                          key={`pending-deduction-${index}`}
                          className={styles.payslipBreakdownDetailRow}
                        >
                          <div>
                            <div className={styles.payslipBreakdownLabel}>
                              {item.reason || "Manual Deduction"}
                            </div>
                            <div className={styles.payslipBreakdownMeta}>
                              Moved to {monthLabel(item.deferredToMonth)}{" "}
                              {item.deferredToYear}
                            </div>
                          </div>
                          <span className={styles.payslipBreakdownAmount}>
                            {currency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  {loanDeductionAmount > 0 && (
                    <>
                      <div className={styles.payslipAllowanceHeader}>
                        Loan Repayment
                      </div>
                      {loanDeductionBreakdown.length > 0 ? (
                        loanDeductionBreakdown.map((entry, index) => (
                          <div
                            key={`loan-${index}`}
                            className={styles.payslipBreakdownDetailRow}
                          >
                            <div>
                              <div className={styles.payslipBreakdownLabel}>
                                Installment {entry.installmentNumber} of{" "}
                                {entry.totalInstallments}
                              </div>
                              <div className={styles.payslipBreakdownMeta}>
                                Remaining: {currency(entry.remainingBalance)}
                              </div>
                            </div>
                            <span className={styles.payslipNegativeAmount}>
                              -{currency(entry.installmentAmount)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.payslipBreakdownDetailRow}>
                          <span className={styles.payslipBreakdownLabel}>
                            Loan Repayment
                          </span>
                          <span className={styles.payslipNegativeAmount}>
                            -{currency(loanDeductionAmount)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  <div className={styles.payslipAllowanceTotalRow}>
                    <span>Total Deductions</span>
                    <span className={styles.payslipNegativeAmount}>
                      -{currency(displayedTotalDeductions)}
                    </span>
                  </div>
                </div>
              </>

              {showLegacyDeductionSection && totalDeductions > 0 && (
                <>
                </>
              )}

              {showLegacyDeductionSection && (
                <>
                  <div className={styles.payslipSectionTitle}>Deductions</div>
                  <div className={styles.payslipBreakdownWrap}>
                    {Number(payslipData?.payslip?.calculations?.latePenaltyAmount || 0) > 0 && (
                      <div className={styles.payslipBreakdownRow}>
                        <span className={styles.payslipBreakdownLabel}>
                          Late Penalty
                          {payslipData?.payslip?.calculations?.lateCount > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({payslipData.payslip.calculations.lateCount} late →{" "}
                              {payslipData.payslip.calculations.latePenaltyGroups || 0} deduction
                              {(payslipData.payslip.calculations.latePenaltyGroups || 0) !== 1
                                ? "s"
                                : ""}
                              )
                            </span>
                          )}
                        </span>
                        <span className={styles.payslipBreakdownAmount} style={{ color: "var(--destructive)" }}>
                          -{currency(
                            payslipData?.payslip?.calculations?.latePenaltyAmount,
                          )}
                        </span>
                      </div>
                    )}
                    {Number(payslipData?.payslip?.calculations?.manualDeductionAmount || 0) > 0 && (
                      <>
                        {(payslipData?.payslip?.deductionBreakdown || []).length > 0 ? (
                          <>
                            <div className={styles.payslipAllowanceHeader}>
                              Manual Deductions
                            </div>
                            {payslipData.payslip.deductionBreakdown.map(
                              (item, index) => (
                                <div
                                  key={`deduction-${index}`}
                                  className={styles.payslipAllowanceRow}
                                >
                                  <span className={styles.payslipAllowanceName}>
                                    {item.reason}
                                  </span>
                                  <span
                                    className={styles.payslipAllowanceAmount}
                                    style={{ color: "var(--destructive)" }}
                                  >
                                    -{currency(item.amount)}
                                  </span>
                                </div>
                              ),
                            )}
                          </>
                        ) : (
                          <div className={styles.payslipBreakdownRow}>
                            <span className={styles.payslipBreakdownLabel}>
                              Manual Deductions
                            </span>
                            <span className={styles.payslipBreakdownAmount} style={{ color: "var(--destructive)" }}>
                              -{currency(
                                payslipData?.payslip?.calculations?.manualDeductionAmount,
                              )}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}

              <div className={styles.payslipTotalRow}>
                <span>Net Salary</span>
                <span className={styles.payslipTotalAmount}>
                  {currency(
                    payslip?.calculations?.netSalary ||
                      payslip?.calculations?.totalSalary,
                  )}
                </span>
              </div>

              <div className={styles.payslipFooter}>
                {!payslip?.isPaid && (
                  <Button
                    variant="outline"
                    onClick={() => markAsPaidMutation.mutate(selectedPayslipId)}
                    disabled={markAsPaidMutation.isPending}
                  >
                    {markAsPaidMutation.isPending ? (
                      <>
                        <Spinner className={styles.smallSpinner} />
                        Marking...
                      </>
                    ) : (
                      "Mark as Paid"
                    )}
                  </Button>
                )}
                <Button variant="green" onClick={handleDownloadPayslip}>
                  {isDownloadingPayslip ? (
                    <>
                      <Spinner className={styles.smallSpinner} />
                      Downloading
                    </>
                  ) : (
                    "Download PDF"
                  )}
                </Button>
              </div>
            </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={regenerateDialogOpen}
        onOpenChange={(open) => {
          if (regenerateMutation.isPending) return;
          if (!open) {
            setRegenerateSummary(null);
            if (regenerateSummary) setSelectedPayrollIds([]);
          }
          setRegenerateDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate Payroll</DialogTitle>
            <DialogDescription>
              {regenerateMutation.isPending
                ? "Regenerating payroll, please wait…"
                : regenerateSummary
                  ? "Regeneration complete"
                  : `Regenerate payroll for ${selectedPayrollTargets.length} selected employee(s)? This replaces existing payroll snapshots for each selected employee month.`}
            </DialogDescription>
          </DialogHeader>

          {regenerateMutation.isPending ? (
            <div className={styles.progressSection}>
              <div className={styles.progressHeader}>
                <span className={styles.progressCount}>
                  {regenerateProgress.processed} / {regenerateProgress.total} employees
                </span>
                <span className={styles.progressPercent}>
                  {regenerateProgress.percent}%
                </span>
              </div>
              <Progress value={regenerateProgress.percent} className={styles.progressBar} />
              {regenerateProgress.currentEmployee && (
                <div className={styles.progressEmployee}>
                  Processing:{" "}
                  <span className={styles.progressEmployeeName}>
                    {regenerateProgress.currentEmployee}
                  </span>
                </div>
              )}
            </div>
          ) : regenerateSummary ? (
            <div className={styles.summarySection}>
              <div className={styles.summaryStats}>
                <div className={styles.summaryStat}>
                  <span className={styles.summaryStatValue}>
                    {regenerateSummary.total}
                  </span>
                  <span className={styles.summaryStatLabel}>Total</span>
                </div>
                <div className={`${styles.summaryStat} ${styles.summaryStatSuccess}`}>
                  <span className={styles.summaryStatValue}>
                    {regenerateSummary.success}
                  </span>
                  <span className={styles.summaryStatLabel}>Generated</span>
                </div>
                <div className={`${styles.summaryStat} ${regenerateSummary.failed.length > 0 ? styles.summaryStatFailed : ""}`}>
                  <span className={styles.summaryStatValue}>
                    {regenerateSummary.failed.length}
                  </span>
                  <span className={styles.summaryStatLabel}>Failed</span>
                </div>
              </div>

              {regenerateSummary.failed.length > 0 && (
                <ScrollArea className={styles.summaryErrorScroll}>
                  <div className={styles.summaryErrorList}>
                    {regenerateSummary.failed.map((item, index) => (
                      <div key={index} className={styles.summaryErrorItem}>
                        <div className={styles.summaryErrorName}>
                          {item.employeeName}
                        </div>
                        <div className={styles.summaryErrorReason}>
                          {item.error}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : null}

          <DialogFooter>
            {regenerateSummary ? (
              <Button
                variant="outline"
                onClick={() => {
                  setRegenerateSummary(null);
                  setSelectedPayrollIds([]);
                  setRegenerateDialogOpen(false);
                }}
              >
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setRegenerateDialogOpen(false)}
                  disabled={regenerateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmRegenerate}
                  disabled={regenerateMutation.isPending}
                >
                  {regenerateMutation.isPending ? (
                    <>
                      <Spinner className={styles.smallSpinner} />
                      Regenerating…
                    </>
                  ) : (
                    "Regenerate"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payroll;
