import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import styles from "./Dashboard.module.css";
import { ICONS } from "./dashboard-config";

const { ArrowRightIcon, LayoutGridIcon } = ICONS;

export function DashboardEmptyState({
  title,
  description,
  icon,
}) {
  const IconComponent = icon || LayoutGridIcon;

  return (
    <Empty className="min-h-[220px]">
      <EmptyHeader>
        <EmptyMedia>
          <IconComponent />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent />
    </Empty>
  );
}

export function DashboardSectionCard({
  title,
  description,
  actionHref,
  actionLabel = "Open module",
  headerContent,
  children,
  footer,
  className,
  contentClassName,
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {headerContent || actionHref ? (
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            {headerContent}
            {actionHref ? (
              <Button asChild size="sm" variant="outline">
                <Link to={actionHref}>
                  {actionLabel}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            ) : null}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}

export function MetricCard({ title, value, subtitle, icon, badge, children, className }) {
  const IconComponent = icon;

  return (
    <Card className={`${styles.metricCard} ${className || ""}`.trim()}>
      <CardHeader className={styles.metricHeader}>
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className={styles.metricValue}>{value}</CardTitle>
        </div>
        <div className={styles.metricIconWrap}>
          <IconComponent />
        </div>
      </CardHeader>
      <CardContent className={styles.metricContent}>
        <div className={styles.metricMetaRow}>
          <span className="text-sm text-muted-foreground">{subtitle}</span>
          {badge ? <Badge variant={badge.variant} className={styles.metricBadge}>{badge.label}</Badge> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function DashboardTable({
  columns,
  rows,
  emptyTitle,
  emptyDescription,
  icon,
}) {
  if (!rows?.length) {
    return (
      <DashboardEmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={icon}
      />
    );
  }

  return (
    <ScrollArea className="h-[280px] pr-3">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((column) => (
                <TableCell key={`${row.id}-${column.key}`}>
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
