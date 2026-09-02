import { Badge } from "@/components/ui/badge";
import type {
  OwnershipType,
  ProcessingStatus,
  ReconciliationStatus,
  ReviewStatus,
  Priority,
  InvoiceStatus,
  QuoteStatus,
  DocumentSourceType,
} from "@/types/domain";
import { titleCase } from "@/lib/utils";
import type { InvoiceDisplayStatus } from "@/lib/commerce";

export function OwnershipBadge({ value }: { value: OwnershipType }) {
  const variant =
    value === "business" ? "default" : value === "mixed" ? "warning" : "secondary";
  return (
    <Badge variant={variant} className="capitalize">
      {value}
    </Badge>
  );
}

export function ReviewBadge({ value }: { value: ReviewStatus }) {
  if (value === "none") return null;
  const variant =
    value === "approved"
      ? "success"
      : value === "rejected"
        ? "destructive"
        : value === "needs_review"
          ? "warning"
          : "muted";
  return <Badge variant={variant}>{titleCase(value)}</Badge>;
}

export function ReconciliationBadge({ value }: { value: ReconciliationStatus }) {
  const variant =
    value === "reconciled"
      ? "success"
      : value === "matched"
        ? "default"
        : value === "ignored"
          ? "muted"
          : "warning";
  return <Badge variant={variant}>{titleCase(value)}</Badge>;
}

export function SourceBadge({ value }: { value: DocumentSourceType }) {
  if (value === "upload") return null;
  return <Badge variant="default">{value === "email" ? "Email" : titleCase(value)}</Badge>;
}

export function ProcessingBadge({ value }: { value: ProcessingStatus }) {
  const variant =
    value === "completed"
      ? "success"
      : value === "failed"
        ? "destructive"
        : value === "needs_review"
          ? "warning"
          : "muted";
  return <Badge variant={variant}>{titleCase(value)}</Badge>;
}

export function PriorityBadge({ value }: { value: Priority }) {
  const variant =
    value === "high" ? "destructive" : value === "medium" ? "warning" : "muted";
  return <Badge variant={variant} className="capitalize">{value}</Badge>;
}

export function ConfidenceBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const variant = pct >= 85 ? "success" : pct >= 70 ? "warning" : "destructive";
  return <Badge variant={variant}>{pct}% conf.</Badge>;
}

export function QuoteStatusBadge({ value }: { value: QuoteStatus }) {
  const variant =
    value === "accepted" || value === "converted"
      ? "success"
      : value === "declined" || value === "expired"
        ? "destructive"
        : value === "sent"
          ? "default"
          : "muted";
  return <Badge variant={variant}>{titleCase(value)}</Badge>;
}

export function InvoiceStatusBadge({ value }: { value: InvoiceDisplayStatus | InvoiceStatus }) {
  const variant =
    value === "paid"
      ? "success"
      : value === "overdue" || value === "void"
        ? "destructive"
        : value === "sent" || value === "part_paid"
          ? "warning"
          : "muted";
  return <Badge variant={variant}>{titleCase(value)}</Badge>;
}
