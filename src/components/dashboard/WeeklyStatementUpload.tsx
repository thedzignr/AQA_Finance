import { useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/shared/Money";
import { SectionTitle } from "@/components/shared/IconWell";
import { useData } from "@/data/DataProvider";
import { useDocumentIngest, uniqueFileName } from "@/data/useIngest";
import type { ParseInput } from "@/lib/parsing";
import { genId, todayISO } from "@/lib/utils";
import { useAuth } from "@/data/auth";
import type { Transaction } from "@/types/domain";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "review"; file: string }
  | { kind: "done"; gross: number; fee: number; net: number; supplier: string };

const SAMPLE: ParseInput = {
  fileName: "uber-weekly-statement.pdf",
  mimeType: "application/pdf",
  size: 132000,
};

export function WeeklyStatementUpload() {
  const { data, insert } = useData();
  const { userId: authUserId } = useAuth();
  const ingestDoc = useDocumentIngest();
  const [state, setState] = useState<State>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  function phvStreamId() {
    return data.workStreams.find((w) => w.code === "phv")?.id ?? null;
  }
  function payoutAccountId() {
    const business = data.accounts.find(
      (a) => a.account_type === "current" && /business|tide/i.test(`${a.name} ${a.provider ?? ""}`),
    );
    return (business ?? data.accounts.find((a) => a.account_type === "current") ?? data.accounts[0])?.id ?? null;
  }

  async function handle(input: ParseInput) {
    setState({ kind: "busy" });
    const { result, docId } = await ingestDoc({ ...input, textContent: input.textContent });

    // Low confidence or not a statement → leave it for the review queue.
    if (result.needsReview || result.documentType !== "weekly_statement") {
      setState({ kind: "review", file: input.fileName });
      return;
    }

    const n = result.normalized;
    const gross = n.total ?? 0;
    const net = n.net ?? gross;
    const fee = Math.max(0, Math.round((gross - net) * 100) / 100);
    const supplier = n.supplier ?? "Operator";
    const date = n.statement_period_end ?? todayISO();
    const wsId = phvStreamId();
    const accId = payoutAccountId();
    const now = new Date().toISOString();
    const userId = data.profile?.id ?? authUserId ?? "";

    const base = (over: Partial<Transaction>): Transaction => ({
      id: genId("t"),
      user_id: userId,
      account_id: accId,
      work_stream_id: wsId,
      category_id: null,
      transaction_date: date,
      posted_date: date,
      kind: "expense",
      ownership_type: "business",
      counterparty: supplier,
      description: "",
      amount: 0,
      direction: "outflow",
      currency: "GBP",
      business_use_pct: 100,
      tax_relevant: true,
      recurring_rule_id: null,
      linked_document_id: docId,
      linked_bill_id: null,
      linked_debt_id: null,
      transfer_group_id: null,
      reconciliation_status: "reconciled",
      review_status: "approved",
      notes: "Imported from weekly operator statement",
      created_at: now,
      updated_at: now,
      ...over,
    });

    await insert("transactions", base({
      description: `${supplier} weekly fares (gross)`,
      amount: gross,
      direction: "inflow",
      kind: "income",
      category_id: data.categories.find((c) => c.code === "inc_phv")?.id ?? null,
    }));
    if (fee > 0) {
      await insert("transactions", base({
        description: `${supplier} service fee`,
        amount: fee,
        direction: "outflow",
        kind: "expense",
        category_id: data.categories.find((c) => c.code === "exp_platform_fee")?.id ?? null,
      }));
    }

    setState({ kind: "done", gross, fee, net, supplier });
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    let textContent: string | undefined;
    if (file.type.startsWith("text/") || file.name.endsWith(".csv")) {
      textContent = await file.text();
    }
    await handle({
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      size: file.size,
      textContent,
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <SectionTitle icon={FileText}>Weekly operator statement</SectionTitle>
        <Badge variant="muted">PHV</Badge>
      </CardHeader>
      <CardContent>
        {state.kind === "done" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Imported {state.supplier} statement
            </div>
            <div className="space-y-1 rounded-md border p-3 text-sm">
              <Row label="Gross fares (income)" value={state.gross} positive />
              {state.fee > 0 && <Row label="Service fee (expense)" value={-state.fee} />}
              <div className="my-1 border-t" />
              <Row label="Net payout" value={state.net} bold />
            </div>
            <p className="text-xs text-muted-foreground">
              Added to your ledger under PHV, tagged tax-relevant and linked to the uploaded statement.
            </p>
            <Button variant="outline" size="sm" onClick={() => setState({ kind: "idle" })}>
              Upload another
            </Button>
          </div>
        ) : state.kind === "review" ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{state.file}</span> needs a quick check — it’s waiting in your
              Review Queue.
            </p>
            <Button variant="outline" size="sm" onClick={() => setState({ kind: "idle" })}>
              Upload another
            </Button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFiles(e.dataTransfer.files);
            }}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-6 text-center"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              {state.kind === "busy" ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Upload className="h-5 w-5 text-primary" />
              )}
            </div>
            <p className="text-sm font-medium">Drop your Uber/Bolt weekly PDF</p>
            <p className="text-xs text-muted-foreground">
              Auto-extracts gross, fees & net and posts them to PHV
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.csv,application/pdf,text/csv"
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <div className="mt-1 flex gap-2">
              <Button variant="outline" size="sm" disabled={state.kind === "busy"} onClick={() => fileRef.current?.click()}>
                Choose file
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={state.kind === "busy"}
                onClick={() => void handle({ ...SAMPLE, fileName: uniqueFileName(SAMPLE.fileName) })}
              >
                Use sample
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
  positive,
}: {
  label: string;
  value: number;
  bold?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <Money value={value} colored={positive || value < 0} signed={positive} className={bold ? "font-semibold" : ""} />
    </div>
  );
}
