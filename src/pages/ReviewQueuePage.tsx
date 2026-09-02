import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Check,
  CheckCheck,
  FileText,
  Link2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { PriorityBadge, SourceBadge } from "@/components/shared/StatusBadges";
import { inboundMailbox } from "@/lib/inboundMailbox";
import { Money } from "@/components/shared/Money";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { useData } from "@/data/DataProvider";
import { cn, titleCase, todayISO } from "@/lib/utils";
import type { ReviewTask, Transaction } from "@/types/domain";

const TASK_LABELS: Record<string, string> = {
  document_extraction: "Document extraction",
  low_confidence_match: "Low-confidence match",
  duplicate_upload: "Duplicate upload",
  missing_evidence: "Missing evidence",
  unreconciled_transaction: "Unreconciled",
  tax_pot_suggestion: "Tax pot",
  anomaly: "Anomaly",
};

export function ReviewQueuePage() {
  const { data, update, categoryByCode, workStreamById } = useData();
  const openTasks = useMemo(
    () =>
      data.reviewTasks
        .filter((t) => t.status === "open")
        .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority)),
    [data.reviewTasks],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const active = openTasks.find((t) => t.id === activeId) ?? openTasks[0] ?? null;
  const activeIndex = openTasks.findIndex((t) => t.id === active?.id);

  const doc = active?.document_id
    ? data.documents.find((d) => d.id === active.document_id)
    : null;
  const extraction = doc
    ? data.extractions.find((e) => e.document_id === doc.id)
    : null;
  const linkedTxn = active?.transaction_id
    ? data.transactions.find((t) => t.id === active.transaction_id)
    : null;

  async function complete(task: ReviewTask, status: "done" | "dismissed") {
    await update("reviewTasks", task.id, {
      status,
      completed_at: new Date().toISOString(),
    });
    if (status === "done" && task.document_id) {
      await update("documents", task.document_id, {
        review_status: "approved",
        processing_status: "completed",
      });
    }
    const remaining = openTasks.filter((t) => t.id !== task.id);
    setActiveId(remaining[0]?.id ?? null);
  }

  function buildTransactionDefaults(task: ReviewTask): Partial<Transaction> {
    const s = task.payload_json.suggestion;
    const cat = categoryByCode(s?.suggested_category_code ?? undefined);
    const ws = data.workStreams.find((w) => w.code === s?.work_stream_hint);
    return {
      description: s?.supplier ? `${s.supplier}` : task.payload_json.summary.slice(0, 40),
      counterparty: s?.supplier ?? null,
      amount: s?.total ?? task.payload_json.amount ?? 0,
      transaction_date: s?.date ?? todayISO(),
      direction: s?.direction_hint ?? "outflow",
      kind: s?.direction_hint === "inflow" ? "income" : "expense",
      category_id: cat?.id ?? null,
      work_stream_id: ws?.id ?? null,
      ownership_type: ws ? "business" : "personal",
      tax_relevant: Boolean(ws),
      linked_document_id: task.document_id ?? undefined,
      review_status: "approved",
    };
  }

  async function linkToTransaction(task: ReviewTask, txnId: string) {
    if (task.document_id) {
      await update("transactions", txnId, { linked_document_id: task.document_id });
      await update("documents", task.document_id, { review_status: "approved" });
    }
    await complete(task, "done");
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!active) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || createOpen) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveId(openTasks[Math.min(activeIndex + 1, openTasks.length - 1)]?.id ?? null);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveId(openTasks[Math.max(activeIndex - 1, 0)]?.id ?? null);
      } else if (e.key === "a") {
        void complete(active, "done");
      } else if (e.key === "x" || e.key === "r") {
        void complete(active, "dismissed");
      } else if (e.key === "c") {
        setCreateOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, activeIndex, openTasks, createOpen]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Review Queue"
        icon={ClipboardCheck}
        description="Approve uncertain OCR/parsing results, resolve duplicates, link evidence and clear anomalies."
        actions={
          <Badge variant="muted" className="hidden sm:flex">
            Shortcuts: J/K move · A approve · R reject · C create
          </Badge>
        }
      />

      {openTasks.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="Inbox zero"
          description={
            inboundMailbox()
              ? `No items need review. Receipts sent to ${inboundMailbox()} will show up here.`
              : "No items need review right now. Upload documents or import statements to generate new tasks."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          {/* Task list — chips on phone so the current item is on screen first */}
          <div className="order-2 flex gap-2 overflow-x-auto pb-1 scrollbar-thin lg:order-1 lg:flex-col lg:overflow-visible">
            {openTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={cn(
                  "min-w-[220px] shrink-0 rounded-2xl border p-3 text-left transition-colors lg:min-w-0 lg:w-full",
                  active?.id === t.id
                    ? "border-primary bg-primary/10 shadow-neon"
                    : "hover:bg-accent/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="muted">{TASK_LABELS[t.task_type] ?? t.task_type}</Badge>
                  <PriorityBadge value={t.priority} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm">{t.payload_json.summary}</p>
              </button>
            ))}
          </div>

          {/* Detail */}
          {active && (
            <Card className="order-1 shadow-neon lg:order-2">
              <CardContent className="space-y-5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      {TASK_LABELS[active.task_type] ?? active.task_type}
                    </p>
                    <h3 className="text-lg font-semibold">{active.payload_json.summary}</h3>
                  </div>
                  <PriorityBadge value={active.priority} />
                </div>

                {active.payload_json.suggested_action && (
                  <div className="rounded-md bg-accent/40 p-3 text-sm">
                    <span className="font-medium">Suggested: </span>
                    {active.payload_json.suggested_action}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Left: document / context preview */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {doc ? "Document" : "Context"}
                    </p>
                    {doc ? (
                      <div className="space-y-2 rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{doc.file_name}</span>
                          <SourceBadge value={doc.source_type} />
                        </div>
                        <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs scrollbar-thin sm:max-h-56">
                          {extraction?.raw_text ?? "No extracted text."}
                        </pre>
                      </div>
                    ) : linkedTxn ? (
                      <div className="space-y-1 rounded-md border p-3 text-sm">
                        <p className="font-medium">{linkedTxn.description}</p>
                        <div className="flex justify-between text-muted-foreground">
                          <span>{linkedTxn.transaction_date}</span>
                          <Money value={linkedTxn.direction === "inflow" ? linkedTxn.amount : -linkedTxn.amount} colored signed />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No linked document.</p>
                    )}
                  </div>

                  {/* Right: extracted fields */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Extracted fields
                    </p>
                    <div className="space-y-1 rounded-md border p-3 text-sm">
                      {active.payload_json.suggestion ? (
                        <>
                          <FieldRow label="Supplier" value={active.payload_json.suggestion.supplier ?? "—"} />
                          <FieldRow label="Date" value={active.payload_json.suggestion.date ?? "—"} />
                          <FieldRow
                            label="Total"
                            value={
                              active.payload_json.suggestion.total != null
                                ? `£${active.payload_json.suggestion.total.toFixed(2)}`
                                : "—"
                            }
                          />
                          <FieldRow label="Category" value={titleCase(active.payload_json.suggestion.suggested_category_code ?? "—")} />
                          <FieldRow
                            label="Work stream"
                            value={
                              workStreamById(
                                data.workStreams.find(
                                  (w) => w.code === active.payload_json.suggestion?.work_stream_hint,
                                )?.id,
                              )?.name ?? "—"
                            }
                          />
                        </>
                      ) : active.payload_json.amount != null ? (
                        <FieldRow label="Amount" value={`£${active.payload_json.amount.toFixed(2)}`} />
                      ) : (
                        <p className="text-muted-foreground">No structured fields.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-5 flex flex-wrap gap-2 border-t bg-card/95 px-5 py-3 backdrop-blur-md lg:static lg:bottom-auto lg:mx-0 lg:px-0">
                  <Button className="h-11 flex-1 sm:flex-none" onClick={() => void complete(active, "done")}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  {active.payload_json.suggestion && (
                    <Button variant="outline" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-4 w-4" /> Create transaction
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <Link2 className="h-4 w-4" /> Link to existing
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-72 w-72 overflow-y-auto">
                      <DropdownMenuLabel>Link to a transaction</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {[...data.transactions]
                        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
                        .slice(0, 25)
                        .map((t) => (
                          <DropdownMenuItem key={t.id} onClick={() => void linkToTransaction(active, t.id)}>
                            <span className="truncate">{t.transaction_date} · {t.description}</span>
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" className="ml-auto text-destructive" onClick={() => void complete(active, "dismissed")}>
                    <X className="h-4 w-4" /> Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {active && (
        <TransactionDialog
          open={createOpen}
          onOpenChange={(o) => {
            setCreateOpen(o);
            if (!o) void complete(active, "done");
          }}
          defaults={buildTransactionDefaults(active)}
        />
      )}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium capitalize">{value}</span>
    </div>
  );
}

function priorityRank(p: string): number {
  return p === "high" ? 3 : p === "medium" ? 2 : 1;
}
