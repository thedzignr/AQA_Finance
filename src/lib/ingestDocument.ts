import type {
  DocumentRecord,
  DocumentSourceType,
  Extraction,
  ReviewTask,
  WorkStream,
} from "../types/domain";
import { processDocument, EXTRACTOR_VERSION, type ParseInput, type ParseResult } from "./parsing";
import { newId, quickChecksum } from "./utils";

export interface IngestBuildInput {
  parse: ParseInput;
  userId: string;
  workStreams: Pick<WorkStream, "id" | "code">[];
  sourceType: DocumentSourceType;
  storagePath: string;
  checksum?: string;
  notes?: string | null;
  /** Force a review task even when the parser is confident (inbound email). */
  forceReview?: boolean;
}

export interface IngestRecords {
  doc: DocumentRecord;
  extraction: Extraction;
  reviewTask: ReviewTask | null;
  result: ParseResult;
}

export function buildIngestRecords(input: IngestBuildInput): IngestRecords {
  const result = processDocument(input.parse);
  const needsReview = input.forceReview || result.needsReview;
  const now = new Date().toISOString();
  const hint = result.normalized.work_stream_hint;
  const ws = hint ? input.workStreams.find((w) => w.code === hint) : undefined;
  const docId = newId();

  const doc: DocumentRecord = {
    id: docId,
    user_id: input.userId,
    work_stream_id: ws?.id ?? null,
    file_name: input.parse.fileName,
    mime_type: input.parse.mimeType,
    file_size: input.parse.size,
    storage_path_original: input.storagePath,
    storage_path_preview: null,
    source_type: input.sourceType,
    document_type: result.documentType,
    checksum:
      input.checksum ??
      quickChecksum(`${input.parse.fileName}:${input.parse.size}:${input.parse.subject ?? ""}`),
    uploaded_at: now,
    processing_status: needsReview ? "needs_review" : "completed",
    parsing_confidence: result.confidence,
    review_status: needsReview ? "needs_review" : "none",
    notes: input.notes ?? null,
  };

  const extraction: Extraction = {
    id: newId(),
    document_id: docId,
    extractor_version: EXTRACTOR_VERSION,
    raw_text: result.rawText,
    raw_json: {
      ...result.rawJson,
      ...(input.parse.subject ? { email_subject: input.parse.subject } : {}),
      ...(input.parse.from ? { email_from: input.parse.from } : {}),
    },
    normalized_json: result.normalized,
    confidence_score: result.confidence,
    created_at: now,
  };

  let reviewTask: ReviewTask | null = null;
  if (needsReview) {
    const viaEmail = input.sourceType === "email";
    reviewTask = {
      id: newId(),
      user_id: input.userId,
      document_id: docId,
      transaction_id: null,
      task_type: "document_extraction",
      priority: result.confidence < 0.6 || viaEmail ? "high" : "medium",
      status: "open",
      payload_json: {
        summary: viaEmail
          ? `Inbound email: ${input.parse.fileName}. Check the attachment and post it to the ledger if it is a real receipt or invoice.`
          : `Low-confidence extraction (${Math.round(result.confidence * 100)}%) on ${input.parse.fileName}. Verify details.`,
        suggested_action: "Confirm extracted fields and link/create a transaction.",
        suggestion: result.normalized,
      },
      created_at: now,
      completed_at: null,
    };
  }

  return { doc, extraction, reviewTask, result };
}
