import { Badge } from "@/components/ui/badge";
import type {
  OwnershipType,
  ProcessingStatus,
  ReconciliationStatus,
  ReviewStatus,
  Priority,
} from "@/types/domain";
import { titleCase } from "@/lib/utils";

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
