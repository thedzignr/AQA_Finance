import { useMemo, useRef, useState } from "react";
import {
  Camera,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Receipt,
  Sparkles,
  Upload,
} from "lucide-react";
import { InboundMailboxCard } from "@/components/shared/InboundMailboxCard";
import { inboundMailbox } from "@/lib/inboundMailbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  ConfidenceBadge,
  ProcessingBadge,
  SourceBadge,
} from "@/components/shared/StatusBadges";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { useData } from "@/data/DataProvider";
import { useDocumentIngest, uniqueFileName } from "@/data/useIngest";
import { mockBankCsv, type ParseInput } from "@/lib/parsing";
import { cn, titleCase } from "@/lib/utils";
import type { DocumentRecord, Extraction } from "@/types/domain";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const SAMPLES: Array<{ label: string; icon: typeof Receipt; input: ParseInput }> = [
  {
    label: "Receipt photo",
    icon: Receipt,
    input: { fileName: "shell-fuel-receipt.jpg", mimeType: "image/jpeg", size: 248000 },
  },
  {
    label: "PHV weekly PDF",
    icon: FileText,
    input: { fileName: "uber-weekly-statement.pdf", mimeType: "application/pdf", size: 132000 },
  },
  {
    label: "Bank CSV",
    icon: FileSpreadsheet,
    input: {
      fileName: "monzo-statement.csv",
      mimeType: "text/csv",
      size: 4200,
      textContent: mockBankCsv(),
    },
  },
  {
    label: "Low-quality scan",
    icon: FileImage,
    input: { fileName: "img_0421_copy.png", mimeType: "image/png", size: 96000 },
  },
];

export function DocumentsPage() {
  const { data, workStreamById } = useData();
  const ingestDoc = useDocumentIngest();
  const [busy, setBusy] = useState(false);
  const [openDoc, setOpenDoc] = useState<DocumentRecord | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const extractionByDoc = useMemo(() => {
    const map = new Map<string, Extraction>();
    for (const e of data.extractions) map.set(e.document_id, e);
    return map;
  }, [data.extractions]);

  async function ingest(input: ParseInput) {
    setBusy(true);
    try {
      await ingestDoc(input);
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      let textContent: string | undefined;
      if (file.type.includes("csv") || file.name.endsWith(".csv") || file.type.startsWith("text/")) {
        textContent = await file.text();
      }
      await ingest({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        textContent,
      });
    }
  }

  function onPicker(files: FileList | null, input: HTMLInputElement | null) {
    void onFiles(files);
    if (input) input.value = "";
  }

  const docs = [...data.documents].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Documents"
        icon={FileText}
        description="Upload receipts, invoices, weekly statements, bank CSVs, screenshots and PDFs — or send them to the receipts inbox. They’re auto-classified, parsed and routed for review when uncertain."
      />

      <Card className="shadow-neon">
        <CardContent className="p-4 md:p-5">
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-14 text-base"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              Take photo
            </Button>
            <Button
              variant="outline"
              className="h-14 text-base shadow-neon-cyan"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-5 w-5" />
              Upload
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground md:hidden">
            Point at a receipt, parking ticket or invoice. It goes to Review.
          </p>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPicker(e.target.files, e.target)}
          />
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.heic,.pdf,.csv,image/*,application/pdf,text/csv"
            className="hidden"
            onChange={(e) => onPicker(e.target.files, e.target)}
          />

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFiles(e.dataTransfer.files);
            }}
            className="mt-4 hidden flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10 text-center md:flex"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shadow-neon">
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <Upload className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium">Or drop files here</p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, HEIC, PDF or CSV · parsed and sent to Review when uncertain
              </p>
            </div>
          </div>

          <div className="mt-4 hidden md:block">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Try a sample (mock adapters)
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <Button
                  key={s.label}
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void ingest({ ...s.input, fileName: uniqueFileName(s.input.fileName) })}
                >
                  <s.icon className="h-4 w-4" /> {s.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <details className="rounded-[1.25rem] bg-card p-4 shadow-card md:hidden">
        <summary className="cursor-pointer text-sm font-medium">Email receipts instead</summary>
        <div className="pt-3">
          <InboundMailboxCard compact embedded />
        </div>
      </details>
      <div className="hidden md:block">
        <InboundMailboxCard />
      </div>

      {/* Inbox */}
      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description={
            inboundMailbox()
              ? `Take a photo, upload a file, or send a receipt to ${inboundMailbox()}.`
              : "Take a photo or upload a file — it is parsed and sent to Review when uncertain."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => {
            const ex = extractionByDoc.get(doc.id);
            const n = ex?.normalized_json;
            return (
              <Card
                key={doc.id}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => setOpenDoc(doc)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <DocIcon mime={doc.mime_type} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {titleCase(doc.document_type)} · {dateFmt.format(new Date(doc.uploaded_at))}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <ProcessingBadge value={doc.processing_status} />
                      <SourceBadge value={doc.source_type} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <ConfidenceBadge value={doc.parsing_confidence} />
                    {n?.total != null && <Money value={n.total} className="font-semibold" />}
                  </div>
                  {n?.supplier && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {n.supplier}
                      {workStreamById(doc.work_stream_id) && ` · ${workStreamById(doc.work_stream_id)!.name}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DocumentDialog
        doc={openDoc}
        extraction={openDoc ? extractionByDoc.get(openDoc.id) ?? null : null}
        onClose={() => setOpenDoc(null)}
      />
    </div>
  );
}

function DocIcon({ mime }: { mime: string }) {
  const Icon = mime.includes("csv")
    ? FileSpreadsheet
    : mime.includes("pdf")
      ? FileText
      : FileImage;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function DocumentDialog({
  doc,
  extraction,
  onClose,
}: {
  doc: DocumentRecord | null;
  extraction: Extraction | null;
  onClose: () => void;
}) {
  if (!doc) return null;
  const n = extraction?.normalized_json;
  return (
    <Dialog open={Boolean(doc)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{doc.file_name}</DialogTitle>
          <DialogDescription>
            {titleCase(doc.document_type)}
            {doc.source_type === "email" ? " · inbound email" : ""} · extracted by{" "}
            {extraction?.extractor_version ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Normalized fields</p>
            <dl className="space-y-1 text-sm">
              <Row label="Supplier" value={n?.supplier ?? "—"} />
              <Row label="Date" value={n?.date ?? "—"} />
              <Row label="Total" value={n?.total != null ? `£${n.total.toFixed(2)}` : "—"} />
              <Row label="VAT" value={n?.vat_amount != null ? `£${n.vat_amount.toFixed(2)}` : "—"} />
              <Row label="Period" value={n?.statement_period_start ? `${n.statement_period_start} → ${n.statement_period_end}` : "—"} />
              <Row label="Work stream hint" value={n?.work_stream_hint ?? "—"} />
              <Row label="Suggested category" value={n?.suggested_category_code ?? "—"} />
              {doc.source_type === "email" && (
                <>
                  <Row
                    label="From"
                    value={String(extraction?.raw_json?.email_from ?? "—")}
                    plain
                  />
                  <Row
                    label="Subject"
                    value={String(extraction?.raw_json?.email_subject ?? "—")}
                    plain
                  />
                </>
              )}
            </dl>
            {n?.transactions && n.transactions.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Parsed rows ({n.transactions.length})
                </p>
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs">
                  {n.transactions.map((t, i) => (
                    <div key={i} className="flex justify-between border-b py-1">
                      <span className="truncate">{t.date} · {t.description}</span>
                      <Money value={t.direction === "inflow" ? t.amount : -t.amount} colored signed />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Raw extracted text</p>
            <pre className="max-h-[50vh] overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed scrollbar-thin">
              {extraction?.raw_text ?? "No raw text available."}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium", !plain && "capitalize")}>{value}</dd>
    </div>
  );
}
