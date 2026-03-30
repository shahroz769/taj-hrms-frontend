import { useMemo, useState } from "react";
import { Link } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { fetchDashboardOverview } from "@/services/dashboardApi";

import styles from "./Dashboard.module.css";
import {
  ATTENDANCE_COLORS,
  ATTENDANCE_STACK_KEYS,
  CURRENT_MONTH,
  CURRENT_QUARTER,
  CURRENT_YEAR,
  EMPLOYMENT_COLORS,
  ICONS,
  MONTHS,
  PROGRESS_COLORS,
  QUARTERS,
  SEVERITY_COLORS,
  YEARS,
  attendanceChartConfig,
  formatCurrency,
  formatDate,
  getItemVariant,
  getMonthOptions,
  getQuarterMonthValues,
  getWeekOptionsForMonth,
  payrollChartConfig,
  quickActions,
  roundRating,
  workforceChartConfig,
} from "./dashboard-config";
import {
  DashboardSectionCard,
  DashboardTable,
  MetricCard,
} from "./dashboard-components";

const {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  CalendarCheckIcon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  Clock3Icon,
  LayoutGridIcon,
  ShieldAlertIcon,
  TrophyIcon,
  TriangleAlertIcon,
} = ICONS;

const Dashboard = () => {
  // ── Global period filters ──
  const [periodType, setPeriodType] = useState("monthly");
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState(String(CURRENT_MONTH));
  const [quarter, setQuarter] = useState(String(CURRENT_QUARTER));

  // ── Feature-specific filters ──
  const attendanceMonth = periodType === "quarterly"
    ? String(getQuarterMonthValues(quarter)[0])
    : month;
  const [attendanceWeek, setAttendanceWeek] = useState("1");
  const [payrollYear, setPayrollYear] = useState(String(CURRENT_YEAR));

  const attendanceWeekOptions = useMemo(
    () => getWeekOptionsForMonth(Number(year), Number(attendanceMonth)),
    [attendanceMonth, year],
  );
  const selectedAttendanceWeek = attendanceWeekOptions.some((option) => option.value === attendanceWeek)
    ? attendanceWeek
    : attendanceWeekOptions[0]?.value || "1";

  // ── Attendance month options scoped to quarter ──
  const attendanceMonthOptions = useMemo(() => {
    if (periodType === "quarterly") {
      return getMonthOptions(getQuarterMonthValues(quarter));
    }
    return [];
  }, [periodType, quarter]);

  const [attendanceMonthOverride, setAttendanceMonthOverride] = useState("");
  const resolvedAttendanceMonth = periodType === "quarterly" && attendanceMonthOverride
    ? attendanceMonthOverride
    : attendanceMonth;

  const resolvedAttendanceWeekOptions = useMemo(
    () => getWeekOptionsForMonth(Number(year), Number(resolvedAttendanceMonth)),
    [resolvedAttendanceMonth, year],
  );
  const resolvedSelectedAttendanceWeek = resolvedAttendanceWeekOptions.some((o) => o.value === attendanceWeek)
    ? attendanceWeek
    : resolvedAttendanceWeekOptions[0]?.value || "1";

  const { data, error, isError, isPending } = useQuery({
    queryKey: [
      "dashboard-overview",
      { periodType, year, month, quarter, attendanceMonth: resolvedAttendanceMonth, attendanceWeek: resolvedSelectedAttendanceWeek, payrollYear },
    ],
    queryFn: () =>
      fetchDashboardOverview({
        periodType,
        year: Number(year),
        month: Number(month),
        quarter: Number(quarter),
        attendanceMonth: Number(resolvedAttendanceMonth),
        attendanceWeek: Number(resolvedSelectedAttendanceWeek),
        payrollYear: Number(payrollYear),
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  const attendanceOverview = data?.analytics?.attendance?.dailyBreakdown || [];
  const todayAttendanceCounts = data?.analytics?.attendance?.todayStatusCounts || [];
  const employmentMix = data?.analytics?.workforce?.employmentMix || [];
  const departmentHeadcount = data?.analytics?.workforce?.departmentHeadcount || [];
  const payrollTrend = data?.analytics?.payroll?.monthlyTotals || [];
  const progressStatusCounts = data?.analytics?.progress?.statusCounts || [];
  const severityBreakdown = data?.analytics?.compliance?.severityBreakdown || [];
  const topPerformers = (data?.analytics?.progress?.topPerformers || []).map((item) => ({
    ...item,
    id: item.id || item.employeeID,
  }));
  const watchlist = (data?.analytics?.compliance?.watchlist || []).map((item) => ({
    ...item,
    id: item.id || item.employeeID,
  }));
  const attentionItems = data?.actionCenter?.items || [];
  const upcomingItems = data?.actionCenter?.upcoming || [];

  const payrollCoverage = useMemo(() => {
    const eligible = data?.overview?.payroll?.eligibleCount || 0;
    const generated = data?.overview?.payroll?.generatedCount || 0;
    return eligible ? Math.min(Math.round((generated / eligible) * 100), 100) : 0;
  }, [data]);

  const workforceTotal = useMemo(
    () => employmentMix.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [employmentMix],
  );

  const todayAttendanceTotal = useMemo(
    () => todayAttendanceCounts.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [todayAttendanceCounts],
  );

  const todayAttendanceSummary = useMemo(
    () =>
      todayAttendanceCounts
        .filter((item) => Number(item.value || 0) > 0)
        .map((item) => `${item.label} ${item.value}`)
        .join(" | ") || "No attendance marked today",
    [todayAttendanceCounts],
  );

  const workforceSummary = useMemo(
    () =>
      employmentMix
        .filter((item) => Number(item.value || 0) > 0)
        .map((item) => `${item.label} ${item.value}`)
        .join(" | ") || "No workforce mix data available",
    [employmentMix],
  );

  const progressTotal = useMemo(
    () => progressStatusCounts.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [progressStatusCounts],
  );

  const progressSummary = useMemo(
    () =>
      progressStatusCounts
        .map((item) => `${item.label} ${item.value}`)
        .join(" | ") || "No work progress data available",
    [progressStatusCounts],
  );

  const attentionColumns = useMemo(
    () => [
      { key: "type", label: "Type", render: (row) => <Badge variant={getItemVariant(row.tone)}>{row.type}</Badge> },
      {
        key: "item",
        label: "Item",
        render: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{row.title}</span>
            <span className="text-sm text-muted-foreground">{row.description}</span>
          </div>
        ),
      },
      { key: "when", label: "When", render: (row) => <span className="text-sm text-muted-foreground">{row.date ? formatDate(row.date) : "Needs review"}</span> },
      { key: "action", label: "", render: (row) => <Button asChild size="sm" variant="outline"><Link to={row.href}>Open</Link></Button> },
    ],
    [],
  );

  const upcomingColumns = useMemo(
    () => [
      { key: "date", label: "Date", render: (row) => <span className="font-medium">{formatDate(row.date)}</span> },
      {
        key: "deadline",
        label: "Deadline",
        render: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{row.title}</span>
            <span className="text-sm text-muted-foreground">{row.subtitle}</span>
          </div>
        ),
      },
      { key: "action", label: "", render: (row) => <Button asChild size="sm" variant="outline"><Link to={row.href}>View</Link></Button> },
    ],
    [],
  );

  const performerColumns = useMemo(
    () => [
      {
        key: "employee",
        label: "Employee",
        render: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{row.name}</span>
            <span className="text-sm text-muted-foreground">{row.employeeID}</span>
          </div>
        ),
      },
      { key: "tasks", label: "Tasks", render: (row) => <span className="font-medium">{row.tasksCompleted}</span> },
      { key: "rating", label: "Rating", render: (row) => <Badge variant="secondary">{roundRating(row.averageRating)} / 5</Badge> },
    ],
    [],
  );

  const watchlistColumns = useMemo(
    () => [
      {
        key: "employee",
        label: "Employee",
        render: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{row.name}</span>
            <span className="text-sm text-muted-foreground">{row.employeeID}</span>
          </div>
        ),
      },
      { key: "actions", label: "Active actions", render: (row) => <Badge variant="destructive">{row.activeActions}</Badge> },
    ],
    [],
  );

  const attendanceHeaderContent = (
    <div className={styles.sectionControls}>
      {periodType === "quarterly" && attendanceMonthOptions.length > 0 ? (
        <Select value={attendanceMonthOverride || resolvedAttendanceMonth} onValueChange={(value) => { setAttendanceMonthOverride(value); setAttendanceWeek("1"); }}>
          <SelectTrigger className={styles.compactSelect}>
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {attendanceMonthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : null}
      <Select value={resolvedSelectedAttendanceWeek} onValueChange={setAttendanceWeek}>
        <SelectTrigger className={styles.compactSelect}>
          <SelectValue placeholder="Week" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {resolvedAttendanceWeekOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );

  const payrollHeaderContent = (
    <div className={styles.sectionControls}>
      <Select value={payrollYear} onValueChange={setPayrollYear}>
        <SelectTrigger className={styles.compactSelect}>
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );

  if (isPending && !data) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <Spinner className={styles.loadingSpinner} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Dashboard failed to load</AlertTitle>
          <AlertDescription>
            {error?.response?.data?.message || error?.message || "Something went wrong while loading dashboard data."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Global period filters ── */}
      <section className={styles.globalFilters}>
        <div className={styles.filterLabel}>
          <CalendarCheckIcon className="size-4" />
          <span>Period</span>
        </div>
        <div className={styles.sectionControls}>
          <Select value={periodType} onValueChange={(value) => { setPeriodType(value); if (value === "yearly") { setMonth(String(CURRENT_MONTH)); setQuarter(String(CURRENT_QUARTER)); } }}>
            <SelectTrigger className={styles.compactSelect}>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className={styles.compactSelect}>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {periodType === "monthly" ? (
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className={styles.compactSelect}>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
          {periodType === "quarterly" ? (
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className={styles.compactSelect}>
                <SelectValue placeholder="Quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {QUARTERS.map((q) => (
                    <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
        </div>
        {data?.period?.label ? (
          <Badge variant="outline" className="ml-auto">{data.period.label}</Badge>
        ) : null}
      </section>

      <section className={styles.metricGrid}>
        <MetricCard title="Today's attendance" value={todayAttendanceTotal} subtitle={todayAttendanceSummary} icon={CalendarCheckIcon} badge={{ variant: "outline", label: "Daily" }} />
        <MetricCard title="On leave today" value={data?.overview?.workforce?.onLeaveToday || 0} subtitle="Approved leave coverage for today" icon={CalendarCheckIcon} badge={{ variant: "outline", label: "Staffing" }} />
        <MetricCard title="Active contracts" value={data?.overview?.contracts?.activeContracts || 0} subtitle="External labor commitments" icon={BriefcaseBusinessIcon} badge={{ variant: "outline", label: "Contracts" }} />
        <MetricCard title="Pending leaves" value={data?.overview?.approvals?.pendingLeaves || 0} subtitle="Requests awaiting review" icon={ClipboardListIcon} badge={{ variant: (data?.overview?.approvals?.pendingLeaves || 0) > 0 ? "secondary" : "outline", label: "Approvals" }} />
        <MetricCard title="Workforce" value={workforceTotal} subtitle={workforceSummary} icon={LayoutGridIcon} badge={{ variant: "outline", label: "Mix" }} />
        <MetricCard title="Compliance risk" value={data?.overview?.compliance?.activeActions || 0} subtitle="Active disciplinary actions" icon={ShieldAlertIcon} badge={{ variant: (data?.overview?.compliance?.activeActions || 0) > 0 ? "secondary" : "outline", label: "Compliance" }} />
        <MetricCard title="Work progress" value={progressTotal} subtitle={progressSummary} icon={ClipboardListIcon} badge={{ variant: "outline", label: "Tasks" }} />
      </section>

      <section className={styles.analyticsGrid}>
        {/* Row 1: Attendance (wide) + Workforce pie (side) */}
        <DashboardSectionCard
          title="Attendance overview"
          description={`Daily attendance bars for ${data?.analytics?.attendance?.label || "the selected range"}.`}
          actionHref="/attendance/records"
          className={styles.analyticsWide}
          headerContent={attendanceHeaderContent}
          contentClassName={styles.compactSectionContent}
        >
          <ChartContainer config={attendanceChartConfig} className={`aspect-auto ${styles.chartFrame}`}>
            <BarChart data={attendanceOverview}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ""} />} />
              <ChartLegend content={<ChartLegendContent />} />
              {ATTENDANCE_STACK_KEYS.map((entry) => (
                <Bar
                  key={entry.key}
                  dataKey={entry.key}
                  stackId="attendance-week"
                  fill={entry.color}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </DashboardSectionCard>

        <DashboardSectionCard title="Workforce composition" description="Employment type breakdown." actionHref="/workforce/employees" className={styles.analyticsSide}>
          <ChartContainer config={workforceChartConfig} className={`aspect-auto ${styles.chartFrame}`}>
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={employmentMix} dataKey="value" nameKey="label" innerRadius={40} outerRadius={72} paddingAngle={3}>
                {employmentMix.map((entry) => <Cell key={entry.key} fill={EMPLOYMENT_COLORS[["Permanent", "Contract", "Part Time"].indexOf(entry.key) % EMPLOYMENT_COLORS.length]} />)}
              </Pie>
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        </DashboardSectionCard>

        {/* Row 2: Payroll (wide) + Department headcount pie (side) */}
        <DashboardSectionCard
          title="Payroll trend"
          description={`Twelve-month payroll totals for ${data?.analytics?.payroll?.year || payrollYear}.`}
          actionHref="/salary/payroll"
          className={styles.analyticsWide}
          headerContent={payrollHeaderContent}
          footer={<div className={styles.footerSplit}><div><span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">This scope</span><p className="text-sm font-medium">{data?.overview?.payroll?.generatedCount || 0} generated / {data?.overview?.payroll?.eligibleCount || 0} expected</p></div><div className={styles.payrollFooterMetric}><span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coverage</span><p className="text-sm font-medium">{payrollCoverage}%</p></div></div>}
        >
          <ChartContainer config={payrollChartConfig} className={`aspect-auto ${styles.chartFrameTall}`}>
            <BarChart data={payrollTrend} barGap={4} barCategoryGap="18%">
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={8} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <div className="flex w-full items-center justify-between gap-8"><span className="text-muted-foreground">{name}</span><span className="font-medium text-foreground">{formatCurrency(value)}</span></div>} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="gross" stackId="payroll-year" fill="var(--color-gross)" />
              <Bar dataKey="net" stackId="payroll-year" fill="var(--color-net)" />
              <Bar dataKey="deductions" stackId="payroll-year" fill="var(--color-deductions)" />
            </BarChart>
          </ChartContainer>
        </DashboardSectionCard>

        <DashboardSectionCard title="Department headcount" description="Where the workforce is concentrated." actionHref="/setups/departments" className={styles.analyticsSide}>
          <ChartContainer config={Object.fromEntries(departmentHeadcount.map((item, index) => [item.key, { label: item.label, color: ATTENDANCE_COLORS[index % ATTENDANCE_COLORS.length] }]))} className={`aspect-auto ${styles.chartFrame}`}>
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={departmentHeadcount} dataKey="value" nameKey="label" innerRadius={40} outerRadius={72} paddingAngle={2}>
                {departmentHeadcount.map((entry, index) => <Cell key={entry.key} fill={ATTENDANCE_COLORS[index % ATTENDANCE_COLORS.length]} />)}
              </Pie>
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        </DashboardSectionCard>

        {/* Row 3: Work progress (half) + Compliance severity (half) */}
        <DashboardSectionCard title="Work progress status" description={`Task status breakdown for ${data?.period?.label || "current period"}.`} actionHref="/compliance/work-progress-reports" className={styles.analyticsHalf}>
          <ChartContainer config={Object.fromEntries(progressStatusCounts.map((item) => [item.key, { label: item.label, color: PROGRESS_COLORS[item.key] || "var(--color-chart-1)" }]))} className={`aspect-auto ${styles.chartFrameCompact}`}>
            <BarChart data={progressStatusCounts} barCategoryGap="24%">
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {progressStatusCounts.map((entry) => <Cell key={entry.key} fill={PROGRESS_COLORS[entry.key] || "var(--color-chart-1)"} />)}
              </Bar>
            </BarChart>
          </ChartContainer>
        </DashboardSectionCard>

        <DashboardSectionCard title="Compliance severity" description="Active disciplinary actions by severity." actionHref="/compliance/disciplinary-actions" className={styles.analyticsHalf}>
          <ChartContainer config={Object.fromEntries(["Low", "Medium", "High"].map((key) => [key, { label: key, color: SEVERITY_COLORS[key] }]))} className={`aspect-auto ${styles.chartFrameCompact}`}>
            <BarChart data={severityBreakdown} barCategoryGap="24%">
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {severityBreakdown.map((entry) => <Cell key={entry.key} fill={SEVERITY_COLORS[entry.key] || "var(--color-chart-1)"} />)}
              </Bar>
            </BarChart>
          </ChartContainer>
        </DashboardSectionCard>
      </section>

      <section className={styles.actionGrid}>
        <DashboardSectionCard title="Attention queue" description="The highest-priority approvals, overdue work, expiring contracts, and payroll blockers." actionHref="/leaves/applications" className={styles.actionThird}>
          <DashboardTable columns={attentionColumns} rows={attentionItems} emptyTitle="Nothing urgent right now" emptyDescription="New approval requests, payroll blockers, and overdue work will appear here." icon={TriangleAlertIcon} />
        </DashboardSectionCard>

        <DashboardSectionCard title="Upcoming deadlines" description="A short-range view of contracts, tasks, and leave events coming up next." actionHref="/compliance/work-progress-reports" className={styles.actionThird}>
          <DashboardTable columns={upcomingColumns} rows={upcomingItems} emptyTitle="No near-term deadlines" emptyDescription="Upcoming deadlines will populate once contracts, tasks, or leave dates fall in range." icon={Clock3Icon} />
        </DashboardSectionCard>

        <DashboardSectionCard title="Top performers" description="Rated completed work will surface your top contributors here." actionHref="/compliance/employee-progress-reports" actionLabel="Open reports" className={styles.actionThird}>
          <DashboardTable columns={performerColumns} rows={topPerformers} emptyTitle="No top performers yet" emptyDescription="Rated completed work will surface your top contributors here." icon={TrophyIcon} />
        </DashboardSectionCard>

        <DashboardSectionCard title="Watchlist" description="Employees with active disciplinary actions appear here for follow-up." actionHref="/compliance/disciplinary-actions" actionLabel="Open actions" className={styles.actionThird}>
          <DashboardTable columns={watchlistColumns} rows={watchlist} emptyTitle="No one on the watchlist" emptyDescription="Employees with active disciplinary actions will appear here." icon={ShieldAlertIcon} />
        </DashboardSectionCard>

        <DashboardSectionCard title="Quick actions" description="Jump straight into the modules that most often need daily attention." className={styles.actionWide}>
          <div className={styles.quickActionList}>{quickActions.map((action) => { const Icon = action.icon; return <Link key={action.href} to={action.href} className={styles.quickActionLink}><div className={styles.quickActionIcon}><Icon /></div><div className="flex flex-1 flex-col gap-1"><span className="font-medium">{action.title}</span><span className="text-sm text-muted-foreground">{action.description}</span></div><ArrowRightIcon className="size-4 text-muted-foreground" /></Link>; })}</div>
        </DashboardSectionCard>
      </section>
    </div>
  );
};

export default Dashboard;
