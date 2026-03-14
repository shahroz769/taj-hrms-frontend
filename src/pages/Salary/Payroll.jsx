import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import EyeIcon from "lucide-react/dist/esm/icons/eye";
import RefreshCcwIcon from "lucide-react/dist/esm/icons/refresh-ccw";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import SlidersHorizontalIcon from "lucide-react/dist/esm/icons/sliders-horizontal";
import WalletCardsIcon from "lucide-react/dist/esm/icons/wallet-cards";
import { toast } from "sonner";

import DataTable from "@/components/DataTable/data-table";
import { Badge } from "@/components/ui/badge";
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

import { fetchDepartmentsList } from "@/services/departmentsApi";
import { fetchPositionsFilters } from "@/services/positionsApi";
import {
  downloadPayslipPdf,
  fetchPayslip,
  fetchPayrolls,
  generatePayrolls,
  previewPayrollGeneration,
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
const PAYROLL_GENERATION_ENABLED =
  import.meta.env.VITE_ENABLE_PAYROLL_GENERATION !== "false";

const Payroll = () => {
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
  const [filterYear, setFilterYear] = useState(searchParams.get("year") || "");
  const [filterMonth, setFilterMonth] = useState(
    searchParams.get("month") || "",
  );

  const [tempFilterDepartment, setTempFilterDepartment] = useState("");
  const [tempFilterPosition, setTempFilterPosition] = useState("");
  const [tempFilterYear, setTempFilterYear] = useState("");
  const [tempFilterMonth, setTempFilterMonth] = useState("");
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [isFiltersLoading, setIsFiltersLoading] = useState(false);

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [isOpeningGenerateDialog, setIsOpeningGenerateDialog] = useState(false);
  const [generateYear, setGenerateYear] = useState(String(CURRENT_YEAR));
  const [generateMonth, setGenerateMonth] = useState(
    String(new Date().getMonth() + 1),
  );
  const [forceReplace, setForceReplace] = useState(false);

  const [generationErrors, setGenerationErrors] = useState([]);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  const [selectedPayslipId, setSelectedPayslipId] = useState(null);
  const [payslipDialogOpen, setPayslipDialogOpen] = useState(false);
  const [openingPayslipId, setOpeningPayslipId] = useState(null);

  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
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
    if (filterYear) params.year = filterYear;
    if (filterMonth) params.month = filterMonth;

    setSearchParams(params, { replace: true });
  }, [
    page,
    limit,
    debouncedSearch,
    filterDepartment,
    filterPosition,
    filterYear,
    filterMonth,
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

  const { data: generationPreview, isFetching: isPreviewFetching } = useQuery({
    queryKey: ["payrollPreview", generateYear, generateMonth],
    queryFn: () =>
      previewPayrollGeneration({
        year: Number(generateYear),
        month: Number(generateMonth),
      }),
    enabled:
      generateDialogOpen && Boolean(generateYear) && Boolean(generateMonth),
  });

  const { data: payslipData, isFetching: isPayslipFetching } = useQuery({
    queryKey: ["payslip", selectedPayslipId],
    queryFn: () => fetchPayslip(selectedPayslipId),
    enabled: Boolean(selectedPayslipId) && payslipDialogOpen,
  });

  const generateMutation = useMutation({
    mutationFn: generatePayrolls,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      setGenerateDialogOpen(false);

      const failedRows = response?.errors || [];
      if (failedRows.length > 0) {
        setGenerationErrors(failedRows);
        setErrorModalOpen(true);
      }

      toast.success(
        `Payroll generation completed. Generated: ${response?.summary?.generated || 0}, Failed: ${response?.summary?.failed || 0}`,
      );
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Payroll generation failed");
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (targets) => {
      const results = await Promise.allSettled(
        targets.map((target) =>
          regenerateEmployeePayroll({
            employeeId: target.employeeId,
            year: target.year,
            month: target.month,
          }),
        ),
      );

      const failed = results
        .map((result, index) => ({ result, target: targets[index] }))
        .filter((entry) => entry.result.status === "rejected")
        .map(({ result, target }) => ({
          employeeName: target.employeeName || "Employee",
          error:
            result.reason?.response?.data?.message ||
            result.reason?.message ||
            "Failed to regenerate payroll",
        }));

      return {
        total: targets.length,
        success: targets.length - failed.length,
        failed,
      };
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      setRegenerateDialogOpen(false);
      setSelectedPayrollIds([]);

      if (response.failed.length > 0) {
        toast.error(
          `Regenerated ${response.success}/${response.total}. ${response.failed[0]?.employeeName}: ${response.failed[0]?.error}`,
        );
        return;
      }

      toast.success(`Payroll regenerated for ${response.success} employee(s)`);
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
    filterYear,
    filterMonth,
  ]);

  const selectedPayrollTargets = useMemo(() => {
    const payrollRows = payrollData?.payrolls || [];

    return payrollRows
      .filter((row) => selectedPayrollIds.includes(row._id || row.id))
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
      setTempFilterYear(filterYear);
      setTempFilterMonth(filterMonth);
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
    setFilterYear(tempFilterYear);
    setFilterMonth(tempFilterMonth);
    setPage(1);
    setFilterPopoverOpen(false);
  };

  const resetFilters = () => {
    setTempFilterDepartment("");
    setTempFilterPosition("");
    setTempFilterYear("");
    setTempFilterMonth("");
    setFilterDepartment("");
    setFilterPosition("");
    setFilterYear("");
    setFilterMonth("");
    setPage(1);
    setFilterPopoverOpen(false);
  };

  const handleOpenGenerateDialog = async () => {
    if (!PAYROLL_GENERATION_ENABLED) {
      toast.error("Payroll generation is disabled by feature flag");
      return;
    }

    if (isOpeningGenerateDialog) {
      return;
    }

    const defaultYear = filterYear || String(CURRENT_YEAR);
    const defaultMonth = filterMonth || String(new Date().getMonth() + 1);

    setIsOpeningGenerateDialog(true);
    try {
      await queryClient.fetchQuery({
        queryKey: ["payrollPreview", defaultYear, defaultMonth],
        queryFn: () =>
          previewPayrollGeneration({
            year: Number(defaultYear),
            month: Number(defaultMonth),
          }),
      });

      setGenerateYear(defaultYear);
      setGenerateMonth(defaultMonth);
      setForceReplace(false);
      setGenerateDialogOpen(true);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to load eligible employees",
      );
    } finally {
      setIsOpeningGenerateDialog(false);
    }
  };

  const handleGeneratePayroll = () => {
    generateMutation.mutate({
      year: Number(generateYear),
      month: Number(generateMonth),
      forceReplace,
    });
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
    if (!selectedPayslipId) return;

    try {
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
        error.response?.data?.message || "Failed to download payslip",
      );
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
      key: "totalWorkingDays",
      label: "Working Days",
      render: (row) => row.workingDays?.totalScheduled ?? 0,
    },
    {
      key: "present",
      label: "Present",
      render: (row) => row.workingDays?.present ?? 0,
    },
    {
      key: "absences",
      label: "Absences",
      render: (row) => row.workingDays?.absences ?? 0,
    },
    {
      key: "leaves",
      label: "Leaves",
      render: (row) => row.workingDays?.leaves ?? 0,
    },
    {
      key: "halfDay",
      label: "Half Day",
      render: (row) => row.workingDays?.halfDay ?? 0,
    },
    {
      key: "late",
      label: "Late",
      render: (row) => row.workingDays?.late ?? 0,
    },
    {
      key: "grossSalary",
      label: "Gross Salary",
      render: (row) => currency(row.calculations?.grossSalary),
    },
    {
      key: "totalSalary",
      label: "Total Salary",
      render: (row) => currency(row.calculations?.totalSalary),
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Payroll</h1>
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
            <RefreshCcwIcon className={styles.buttonIcon} />
            {regenerateMutation.isPending ? "Regenerating..." : "Regenerate"}
            {selectedPayrollTargets.length > 0 && (
              <Badge className="ml-1.5 h-5 min-w-5 px-1.5 bg-[#02542D] text-white text-[11px] font-semibold">
                {selectedPayrollTargets.length}
              </Badge>
            )}
          </Button>

          <Button
            variant="green"
            className="cursor-pointer"
            onClick={handleOpenGenerateDialog}
            disabled={!PAYROLL_GENERATION_ENABLED || isOpeningGenerateDialog}
          >
            {isOpeningGenerateDialog ? (
              <Spinner className={styles.buttonSpinner} />
            ) : (
              <WalletCardsIcon className={styles.buttonIcon} />
            )}
            Generate Payroll
          </Button>
        </div>
      </div>

      {!PAYROLL_GENERATION_ENABLED && (
        <div className={styles.previewSubtext}>
          Payroll generation is currently disabled by feature flag.
        </div>
      )}

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
            className="cursor-pointer hover:text-[#02542D]"
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

                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="year">Year</Label>
                    <Select
                      value={tempFilterYear || "all"}
                      onValueChange={(value) =>
                        setTempFilterYear(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger className="w-full col-span-2">
                        <SelectValue placeholder="All years" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Years</SelectItem>
                          {YEARS.map((yearOption) => (
                            <SelectItem key={yearOption} value={yearOption}>
                              {yearOption}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="month">Month</Label>
                    <Select
                      value={tempFilterMonth || "all"}
                      onValueChange={(value) =>
                        setTempFilterMonth(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger className="w-full col-span-2">
                        <SelectValue placeholder="All months" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Months</SelectItem>
                          {MONTHS.map((monthOption) => (
                            <SelectItem
                              key={monthOption.value}
                              value={monthOption.value}
                            >
                              {monthOption.label}
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
        loadingText="Loading payrolls..."
        selectable={true}
        selectedIds={selectedPayrollIds}
        onSelectionChange={setSelectedPayrollIds}
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

      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Payroll</DialogTitle>
            <DialogDescription>
              Select year and month to generate payroll for eligible employees.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.dialogGrid}>
            <div className={styles.dialogField}>
              <Label>Year</Label>
              <Select value={generateYear} onValueChange={setGenerateYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((yearOption) => (
                    <SelectItem key={yearOption} value={yearOption}>
                      {yearOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.dialogField}>
              <Label>Month</Label>
              <Select value={generateMonth} onValueChange={setGenerateMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((monthOption) => (
                    <SelectItem
                      key={monthOption.value}
                      value={monthOption.value}
                    >
                      {monthOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={styles.previewBox}>
            {isPreviewFetching ? (
              <div className={styles.previewLoading}>
                <Spinner className={styles.smallSpinner} />
                Loading eligible count...
              </div>
            ) : (
              <div>
                <div>
                  Eligible employees:{" "}
                  {generationPreview?.eligibleEmployeesCount || 0}
                </div>
                <div className={styles.previewSubtext}>
                  Generation allowed only when selected month is fully closed in
                  Pakistan time.
                </div>
              </div>
            )}
          </div>

          <div className={styles.forceToggleRow}>
            <Checkbox
              checked={forceReplace}
              onCheckedChange={(checked) => setForceReplace(Boolean(checked))}
            />
            <Label className={styles.checkboxLabel}>
              Force replace existing payrolls for selected month
            </Label>
          </div>

          <DialogFooter>
            <Button
              variant="green"
              onClick={handleGeneratePayroll}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending
                ? "Generating..."
                : "Generate Payroll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <DialogContent className="sm:max-w-2xl">
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payslip</DialogTitle>
            <DialogDescription>
              {monthLabel(payslipData?.payslip?.month)}{" "}
              {payslipData?.payslip?.year}
            </DialogDescription>
          </DialogHeader>

          {
            <div className={styles.payslipContent}>
              <div className={styles.payslipInfoGrid}>
                <div className={styles.payslipInfoGroup}>
                  <div className={styles.payslipInfoLabel}>Employee Name</div>
                  <div className={styles.payslipInfoValue}>
                    {payslipData?.payslip?.employeeSnapshot?.fullName || "-"}
                  </div>
                </div>
                <div className={styles.payslipInfoGroup}>
                  <div className={styles.payslipInfoLabel}>Employee ID</div>
                  <div className={styles.payslipInfoValue}>
                    {payslipData?.payslip?.employeeSnapshot?.employeeID || "-"}
                  </div>
                </div>
                <div className={styles.payslipInfoGroup}>
                  <div className={styles.payslipInfoLabel}>Position</div>
                  <div className={styles.payslipInfoValue}>
                    {payslipData?.payslip?.employeeSnapshot?.positionName ||
                      "-"}
                  </div>
                </div>
                <div className={styles.payslipInfoGroup}>
                  <div className={styles.payslipInfoLabel}>Joining Date</div>
                  <div className={styles.payslipInfoValue}>
                    {payslipData?.payslip?.employeeSnapshot?.joiningDate
                      ? new Date(
                          payslipData.payslip.employeeSnapshot.joiningDate,
                        ).toLocaleDateString()
                      : "-"}
                  </div>
                </div>
                <div className={styles.payslipInfoGroup}>
                  <div className={styles.payslipInfoLabel}>Department</div>
                  <div className={styles.payslipInfoValue}>
                    {payslipData?.payslip?.employeeSnapshot?.departmentName ||
                      "-"}
                  </div>
                </div>
              </div>

              <Separator />

              <div className={styles.payslipSectionTitle}>Attendance</div>
              <div className={styles.payslipAttendanceGrid}>
                <div className={styles.payslipAttendanceStat}>
                  <div className={styles.payslipStatValue}>
                    {payslipData?.payslip?.workingDays?.totalScheduled ?? 0}
                  </div>
                  <div className={styles.payslipStatLabel}>Working Days</div>
                </div>
                <div className={styles.payslipAttendanceStat}>
                  <div className={styles.payslipStatValue}>
                    {payslipData?.payslip?.workingDays?.present ?? 0}
                  </div>
                  <div className={styles.payslipStatLabel}>Present</div>
                </div>
                <div className={styles.payslipAttendanceStat}>
                  <div className={styles.payslipStatValue}>
                    {payslipData?.payslip?.workingDays?.absences ?? 0}
                  </div>
                  <div className={styles.payslipStatLabel}>Absent</div>
                </div>
                <div className={styles.payslipAttendanceStat}>
                  <div className={styles.payslipStatValue}>
                    {payslipData?.payslip?.workingDays?.leaves ?? 0}
                  </div>
                  <div className={styles.payslipStatLabel}>Leaves</div>
                </div>
                <div className={styles.payslipAttendanceStat}>
                  <div className={styles.payslipStatValue}>
                    {payslipData?.payslip?.workingDays?.halfDay ?? 0}
                  </div>
                  <div className={styles.payslipStatLabel}>Half Day</div>
                </div>
                <div className={styles.payslipAttendanceStat}>
                  <div className={styles.payslipStatValue}>
                    {payslipData?.payslip?.workingDays?.late ?? 0}
                  </div>
                  <div className={styles.payslipStatLabel}>Late</div>
                </div>
              </div>

              <Separator />

              <div className={styles.payslipSectionTitle}>Salary Breakdown</div>
              <div className={styles.payslipBreakdownWrap}>
                <div className={styles.payslipBreakdownRow}>
                  <span className={styles.payslipBreakdownLabel}>
                    Basic Salary
                  </span>
                  <span className={styles.payslipBreakdownAmount}>
                    {currency(
                      payslipData?.payslip?.calculations?.basicSalaryAmount,
                    )}
                  </span>
                </div>
                {(payslipData?.payslip?.allowanceBreakdown || []).length >
                  0 && (
                  <>
                    <div className={styles.payslipAllowanceHeader}>
                      Allowances
                    </div>
                    {(payslipData?.payslip?.allowanceBreakdown || []).map(
                      (item, index) => (
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
                      ),
                    )}
                  </>
                )}
                {Number(
                  payslipData?.payslip?.calculations?.arrearsAmount || 0,
                ) !== 0 && (
                  <div className={styles.payslipBreakdownRow}>
                    <span className={styles.payslipBreakdownLabel}>
                      Arrears
                    </span>
                    <span className={styles.payslipBreakdownAmount}>
                      {currency(
                        payslipData?.payslip?.calculations?.arrearsAmount,
                      )}
                    </span>
                  </div>
                )}
                <div className={styles.payslipBreakdownRow}>
                  <span className={styles.payslipBreakdownLabel} style={{ fontWeight: 600 }}>
                    Gross Salary
                  </span>
                  <span className={styles.payslipBreakdownAmount} style={{ fontWeight: 700 }}>
                    {currency(
                      payslipData?.payslip?.calculations?.grossSalary,
                    )}
                  </span>
                </div>
              </div>

              {/* Deductions section */}
              {(Number(payslipData?.payslip?.calculations?.latePenaltyAmount || 0) > 0 ||
                Number(payslipData?.payslip?.calculations?.manualDeductionAmount || 0) > 0) && (
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
                        <span className={styles.payslipBreakdownAmount} style={{ color: "#dc2626" }}>
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
                                    style={{ color: "#dc2626" }}
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
                            <span className={styles.payslipBreakdownAmount} style={{ color: "#dc2626" }}>
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
                <span>Total Salary</span>
                <span className={styles.payslipTotalAmount}>
                  {currency(payslipData?.payslip?.calculations?.totalSalary)}
                </span>
              </div>

              <div className={styles.payslipFooter}>
                <Button variant="green" onClick={handleDownloadPayslip}>
                  Download PDF
                </Button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={regenerateDialogOpen}
        onOpenChange={setRegenerateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Payroll</AlertDialogTitle>
            <AlertDialogDescription>
              Regenerate payroll for {selectedPayrollTargets.length} selected
              employee(s)? This replaces existing payroll snapshots for each
              selected employee month.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerateMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRegenerate}
              disabled={regenerateMutation.isPending}
              className="bg-[#02542D] text-white hover:bg-[#02542D]/90"
            >
              {regenerateMutation.isPending ? "Regenerating..." : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Payroll;
