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
  ICONS,
  attendanceChartConfig,
  formatCurrency,
  formatDate,
  getItemVariant,
  getWeekOptionsForMonth,
  payrollChartConfig,
  quickActions,
  roundRating,
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
  const periodType = "monthly";
  const year = String(CURRENT_YEAR);
  const month = String(CURRENT_MONTH);
  const quarter = String(CURRENT_QUARTER);
  const attendanceMonth = String(CURRENT_MONTH);
  const [attendanceWeek, setAttendanceWeek] = useState("1");
  const payrollYear = String(CURRENT_YEAR);
  const attendanceWeekOptions = useMemo(
    () => getWeekOptionsForMonth(Number(year), Number(attendanceMonth)),
    [attendanceMonth, year],
  );
  const selectedAttendanceWeek = attendanceWeekOptions.some((option) => option.value === attendanceWeek)
    ? attendanceWeek
    : attendanceWeekOptions[0]?.value || "1";

  const { data, error, isError, isPending } = useQuery({
    queryKey: [
      "dashboard-overview",
      { periodType, year, month, quarter, attendanceMonth, attendanceWeek: selectedAttendanceWeek, payrollYear },
    ],
    queryFn: () =>
      fetchDashboardOverview({
        periodType,
        year: Number(year),
        month: Number(month),
        quarter: Number(quarter),
        attendanceMonth: Number(attendanceMonth),
        attendanceWeek: Number(selectedAttendanceWeek),
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
      <Select value={selectedAttendanceWeek} onValueChange={setAttendanceWeek}>
        <SelectTrigger className={styles.compactSelect}>
          <SelectValue placeholder="Week" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {attendanceWeekOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
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
      <section className={styles.metricGrid}>
        <MetricCard
          title="Today's attendance"
          value={todayAttendanceTotal}
          subtitle={todayAttendanceSummary}
          icon={CalendarCheckIcon}
          badge={{ variant: "outline", label: "Daily attendance" }}
          className={styles.metricWide}
        />
        <MetricCard title="On leave today" value={data?.overview?.workforce?.onLeaveToday || 0} subtitle="Approved leave coverage for today" icon={CalendarCheckIcon} badge={{ variant: "outline", label: "Daily staffing" }} />
        <MetricCard title="Active contracts" value={data?.overview?.contracts?.activeContracts || 0} subtitle="External labor commitments in progress" icon={BriefcaseBusinessIcon} badge={{ variant: "outline", label: "Contracts" }} />
        <MetricCard title="Pending leave requests" value={data?.overview?.approvals?.pendingLeaves || 0} subtitle="Requests still awaiting review" icon={ClipboardListIcon} badge={{ variant: (data?.overview?.approvals?.pendingLeaves || 0) > 0 ? "secondary" : "outline", label: "Approvals" }} />
        <MetricCard
          title="Workforce composition"
          value={workforceTotal}
          subtitle={workforceSummary}
          icon={LayoutGridIcon}
          badge={{ variant: "outline", label: "Workforce mix" }}
          className={styles.metricWide}
        />
        <MetricCard
          title="Compliance risk snapshot"
          value={data?.overview?.compliance?.activeActions || 0}
          subtitle="Active disciplinary actions that still need follow-up"
          icon={ShieldAlertIcon}
          badge={{ variant: (data?.overview?.compliance?.activeActions || 0) > 0 ? "secondary" : "outline", label: "Compliance" }}
        />
        <MetricCard
          title="Work progress summary"
          value={progressTotal}
          subtitle={progressSummary}
          icon={ClipboardListIcon}
          badge={{ variant: "outline", label: "Task flow" }}
          className={styles.metricWide}
        />
      </section>

      <section className={styles.analyticsGrid}>
        <DashboardSectionCard
          title="Attendance overview"
          description={`Daily attendance bars for ${data?.analytics?.attendance?.label || "the selected range"}.`}
          actionHref="/attendance/records"
          className={styles.analyticsHalf}
          headerContent={attendanceHeaderContent}
          contentClassName={styles.compactSectionContent}
        >
          <ChartContainer config={attendanceChartConfig} className={styles.chartFrameCompact}>
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

        <DashboardSectionCard title="Department headcount" description="See where the current workforce is concentrated across departments." actionHref="/setups/departments" className={styles.analyticsHalf}>
          <ChartContainer config={Object.fromEntries(departmentHeadcount.map((item, index) => [item.key, { label: item.label, color: ATTENDANCE_COLORS[index % ATTENDANCE_COLORS.length] }]))} className={styles.chartFrame}>
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={departmentHeadcount} dataKey="value" nameKey="label" innerRadius={44} outerRadius={86} paddingAngle={2}>
                {departmentHeadcount.map((entry, index) => <Cell key={entry.key} fill={ATTENDANCE_COLORS[index % ATTENDANCE_COLORS.length]} />)}
              </Pie>
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        </DashboardSectionCard>

        <DashboardSectionCard
          title="Payroll trend"
          description={`Twelve-month payroll totals for ${data?.analytics?.payroll?.year || payrollYear}.`}
          actionHref="/salary/payroll"
          className={styles.analyticsHalf}
          footer={<div className={styles.footerSplit}><div><span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">This scope</span><p className="text-sm font-medium">{data?.overview?.payroll?.generatedCount || 0} generated / {data?.overview?.payroll?.eligibleCount || 0} expected</p></div><div className={styles.payrollFooterMetric}><span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coverage</span><p className="text-sm font-medium">{payrollCoverage}%</p></div></div>}
        >
          <ChartContainer config={payrollChartConfig} className={styles.chartFrameTall}>
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
