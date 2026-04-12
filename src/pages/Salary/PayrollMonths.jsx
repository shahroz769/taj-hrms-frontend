// React
import { useEffect, useState } from "react";

// React Router
import { useSearchParams, Link } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import SlidersHorizontalIcon from "lucide-react/dist/esm/icons/sliders-horizontal";
import WalletCardsIcon from "lucide-react/dist/esm/icons/wallet-cards";
import { toast } from "sonner";

// Components
import DataTable from "@/components/DataTable/data-table";
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
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import { Progress } from "@/components/ui/progress";
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

// Services
import {
  fetchPayrollMonthlySummary,
  generatePayrolls,
  previewPayrollGeneration,
} from "@/services/payrollApi";

// Styles
import styles from "./Payroll.module.css";

// ============================================================================
// HELPERS
// ============================================================================

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

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatNumber = (num) => {
  if (num === null || num === undefined) return "0";
  return Math.round(num).toLocaleString("en-US");
};

const monthLabel = (month) =>
  MONTHS.find((item) => Number(item.value) === Number(month))?.label || "-";

const PAYROLL_GENERATION_ENABLED =
  import.meta.env.VITE_ENABLE_PAYROLL_GENERATION !== "false";

// ============================================================================
// COMPONENT
// ============================================================================

const PayrollMonths = () => {
  // ===========================================================================
  // URL SEARCH PARAMS
  // ===========================================================================
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [limit, setLimit] = useState(Number(searchParams.get("limit") || 10));
  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") || "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    searchParams.get("search") || "",
  );
  const [filterYear, setFilterYear] = useState(searchParams.get("year") || "");
  const [filterMonth, setFilterMonth] = useState(
    searchParams.get("month") || "",
  );
  const [tempFilterYear, setTempFilterYear] = useState("");
  const [tempFilterMonth, setTempFilterMonth] = useState("");
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [isOpeningGenerateDialog, setIsOpeningGenerateDialog] = useState(false);
  const [generateYear, setGenerateYear] = useState(String(CURRENT_YEAR));
  const [generateMonth, setGenerateMonth] = useState(
    String(new Date().getMonth() + 1),
  );
  const [forceReplace, setForceReplace] = useState(false);
  const [generationSummary, setGenerationSummary] = useState(null);
  const [generationProgress, setGenerationProgress] = useState({
    processed: 0,
    total: 0,
    percent: 0,
    currentEmployee: "",
  });

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

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
    setPage(1);
  }, [filterYear, filterMonth]);

  useEffect(() => {
    const params = {};
    if (page !== 1) params.page = String(page);
    if (limit !== 10) params.limit = String(limit);
    if (debouncedSearch) params.search = debouncedSearch;
    if (filterYear) params.year = filterYear;
    if (filterMonth) params.month = filterMonth;
    setSearchParams(params, { replace: true });
  }, [page, limit, debouncedSearch, filterYear, filterMonth, setSearchParams]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================

  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "payrollMonthlySummary",
      {
        page,
        limit,
        search: debouncedSearch,
        year: filterYear,
        month: filterMonth,
      },
    ],
    queryFn: () =>
      fetchPayrollMonthlySummary({
        page,
        limit,
        search: debouncedSearch,
        year: filterYear,
        month: filterMonth,
      }),
    staleTime: 0,
    refetchOnMount: "always",
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

  const generateMutation = useMutation({
    mutationFn: ({ year, month, forceReplace: force }) =>
      generatePayrolls({
        year,
        month,
        forceReplace: force,
        onProgress: (event) => {
          if (event.type === "processing") {
            setGenerationProgress({
              processed: event.processed,
              total: event.total,
              percent: event.percent,
              currentEmployee: event.currentEmployee || "",
            });
          }
        },
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      queryClient.invalidateQueries({ queryKey: ["payrollMonthlySummary"] });
      setGenerationProgress({
        processed: 0,
        total: 0,
        percent: 0,
        currentEmployee: "",
      });
      setGenerationSummary(response);
    },
    onError: (error) => {
      toast.error(
        error.message ||
          error.response?.data?.message ||
          "Payroll generation failed",
      );
    },
  });

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================

  const columns = [
    {
      key: "monthYear",
      label: "Month (Year)",
      render: (row) =>
        `${SHORT_MONTH_NAMES[row.month - 1] || "-"} (${row.year})`,
    },
    {
      key: "totalEmployees",
      label: "Total Employees",
      render: (row) => formatNumber(row.totalEmployees),
    },
    {
      key: "totalGrossSalary",
      label: "Total Gross Salary",
      render: (row) => formatNumber(row.totalGrossSalary),
    },
    {
      key: "totalNetSalary",
      label: "Total Net Salary",
      render: (row) => formatNumber(row.totalNetSalary),
    },
    {
      key: "paidCount",
      label: "Paid",
      render: (row) => formatNumber(row.paidCount),
    },
    {
      key: "unpaidCount",
      label: "Unpaid",
      render: (row) => formatNumber(row.unpaidCount),
    },
    {
      key: "totalPaidAmount",
      label: "Amount Paid",
      render: (row) => formatNumber(row.totalPaidAmount),
    },
    {
      key: "totalUnpaidAmount",
      label: "Amount Remaining",
      render: (row) => formatNumber(row.totalUnpaidAmount),
    },
    {
      key: "view",
      label: "Payslips",
      align: "center",
      render: (row) => (
        <div className="flex justify-center">
          <Button variant="link" asChild>
            <Link to={`/salary/payroll/${row.year}/${row.month}`}>View</Link>
          </Button>
        </div>
      ),
    },
  ];

  // ===========================================================================
  // PAGINATION HANDLERS
  // ===========================================================================

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

  // ===========================================================================
  // SEARCH HANDLERS
  // ===========================================================================

  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setDebouncedSearch("");
    setPage(1);
  };

  // ===========================================================================
  // FILTER HANDLERS
  // ===========================================================================

  const applyFilters = () => {
    setFilterYear(tempFilterYear);
    setFilterMonth(tempFilterMonth);
    setPage(1);
    setFilterPopoverOpen(false);
  };

  const resetFilters = () => {
    setTempFilterYear("");
    setTempFilterMonth("");
    setFilterYear("");
    setFilterMonth("");
    setPage(1);
    setFilterPopoverOpen(false);
  };

  // ===========================================================================
  // GENERATE HANDLERS
  // ===========================================================================

  const handleOpenGenerateDialog = async () => {
    if (!PAYROLL_GENERATION_ENABLED) {
      toast.error("Payroll generation is disabled by feature flag");
      return;
    }
    if (isOpeningGenerateDialog) return;

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

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Payroll</h1>
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

      <div className={styles.controls}>
        {/* Search */}
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            placeholder="Search by employee name or ID..."
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
        <Select value={limit.toString()} onValueChange={handleLimitChange}>
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

        {/* Filter Popover */}
        <Popover
          open={filterPopoverOpen}
          onOpenChange={(open) => {
            setFilterPopoverOpen(open);
            if (open) {
              setTempFilterYear(filterYear);
              setTempFilterMonth(filterMonth);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Filters"
              className="cursor-pointer"
            >
              <SlidersHorizontalIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">Filters</h4>
                <p className="text-muted-foreground text-sm">
                  Filter payroll by year and month.
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Year</Label>
                <Select
                  value={tempFilterYear || "all"}
                  onValueChange={(val) =>
                    setTempFilterYear(val === "all" ? "" : val)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All Years</SelectItem>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Month</Label>
                <Select
                  value={tempFilterMonth || "all"}
                  onValueChange={(val) =>
                    setTempFilterMonth(val === "all" ? "" : val)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All Months</SelectItem>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer"
                  onClick={resetFilters}
                >
                  Clear
                </Button>
                <Button
                  variant="green"
                  className="flex-1 cursor-pointer"
                  onClick={applyFilters}
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <DataTable
        columns={columns}
        data={data?.summaries || []}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading payroll summary..."
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
              const totalPages = data.pagination.totalPages;
              const pages = [];

              pages.push(
                <PaginationItem key={1}>
                  <PaginationLink
                    onClick={(e) => {
                      e.preventDefault();
                      handlePageChange(1);
                    }}
                    isActive={page === 1}
                    className="cursor-pointer"
                  >
                    1
                  </PaginationLink>
                </PaginationItem>,
              );

              if (page > 3) {
                pages.push(
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>,
                );
              }

              for (
                let i = Math.max(2, page - 1);
                i <= Math.min(totalPages - 1, page + 1);
                i++
              ) {
                pages.push(
                  <PaginationItem key={i}>
                    <PaginationLink
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(i);
                      }}
                      isActive={page === i}
                      className="cursor-pointer"
                    >
                      {i}
                    </PaginationLink>
                  </PaginationItem>,
                );
              }

              if (page < totalPages - 2) {
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
                      isActive={page === totalPages}
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

      <Dialog
        open={generateDialogOpen}
        onOpenChange={(open) => {
          if (generateMutation.isPending) return;
          if (!open) setGenerationSummary(null);
          setGenerateDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Payroll</DialogTitle>
            <DialogDescription>
              {generateMutation.isPending
                ? "Generating payroll, please wait…"
                : generationSummary
                  ? `${monthLabel(generationSummary.month)} ${generationSummary.year} — generation complete`
                  : "Select year and month to generate payroll for eligible employees."}
            </DialogDescription>
          </DialogHeader>

          {generateMutation.isPending ? (
            <div className={styles.progressSection}>
              <div className={styles.progressHeader}>
                <span className={styles.progressCount}>
                  {generationProgress.processed} / {generationProgress.total}{" "}
                  employees
                </span>
                <span className={styles.progressPercent}>
                  {generationProgress.percent}%
                </span>
              </div>
              <Progress
                value={generationProgress.percent}
                className={styles.progressBar}
              />
              {generationProgress.currentEmployee && (
                <div className={styles.progressEmployee}>
                  Processing:{" "}
                  <span className={styles.progressEmployeeName}>
                    {generationProgress.currentEmployee}
                  </span>
                </div>
              )}
            </div>
          ) : generationSummary ? (
            <div className={styles.summarySection}>
              <div className={styles.summaryStats}>
                <div className={styles.summaryStat}>
                  <span className={styles.summaryStatValue}>
                    {generationSummary.summary?.totalEligible || 0}
                  </span>
                  <span className={styles.summaryStatLabel}>Eligible</span>
                </div>
                <div
                  className={`${styles.summaryStat} ${styles.summaryStatSuccess}`}
                >
                  <span className={styles.summaryStatValue}>
                    {generationSummary.summary?.generated || 0}
                  </span>
                  <span className={styles.summaryStatLabel}>Generated</span>
                </div>
                <div
                  className={`${styles.summaryStat} ${generationSummary.summary?.failed > 0 ? styles.summaryStatFailed : ""}`}
                >
                  <span className={styles.summaryStatValue}>
                    {generationSummary.summary?.failed || 0}
                  </span>
                  <span className={styles.summaryStatLabel}>Failed</span>
                </div>
              </div>

              {(generationSummary.errors || []).length > 0 && (
                <ScrollArea className={styles.summaryErrorScroll}>
                  <div className={styles.summaryErrorList}>
                    {generationSummary.errors.map((item, index) => (
                      <div
                        key={`${item.employeeId}-${index}`}
                        className={styles.summaryErrorItem}
                      >
                        <div className={styles.summaryErrorName}>
                          {item.employeeName}
                        </div>
                        <div className={styles.summaryErrorReason}>
                          {item.reasonMessage}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : (
            <>
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
                  <Select
                    value={generateMonth}
                    onValueChange={setGenerateMonth}
                  >
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
                    Loading eligible count
                  </div>
                ) : (
                  <div>
                    <div>
                      Eligible employees:{" "}
                      {generationPreview?.eligibleEmployeesCount || 0}
                    </div>
                    <div className={styles.previewSubtext}>
                      Generation allowed only when selected month is fully
                      closed.
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.forceToggleRow}>
                <Checkbox
                  checked={forceReplace}
                  onCheckedChange={(checked) =>
                    setForceReplace(Boolean(checked))
                  }
                />
                <Label className={styles.checkboxLabel}>
                  Force replace existing payrolls for selected month
                </Label>
              </div>
            </>
          )}

          <DialogFooter>
            {generationSummary ? (
              <Button
                variant="outline"
                onClick={() => {
                  setGenerationSummary(null);
                  setGenerateDialogOpen(false);
                }}
              >
                Close
              </Button>
            ) : (
              <Button
                variant="green"
                onClick={handleGeneratePayroll}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Spinner className={styles.buttonSpinner} />
                    Generating…
                  </>
                ) : (
                  "Generate Payroll"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollMonths;
