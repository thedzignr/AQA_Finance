import { useCallback } from "react";
import { useData } from "@/data/DataProvider";
import {
  EXTRACTOR_VERSION,
  processDocument,
  type ParseInput,
  type ParseResult,
} from "@/lib/parsing";
import { genId, quickChecksum } from "@/lib/utils";
import { DEMO_USER_ID } from "@/data/seed";
import type {
  DocumentRecord,
  Extraction,
  ReviewTask,
} from "@/types/domain";

export interface IngestOutcome {
  docId: string;
  doc: DocumentRecord;
  result: ParseResult;
  reviewTaskId: string | null;
}

/**
 * Shared document ingestion: runs the parsing pipeline, stores the original
 * document + raw/normalized extraction, and (when confidence is low) opens a
 * review task. Used by the Documents inbox and the dashboard quick-upload.
 */
export function useDocumentIngest() {
  const { data, insert } = useData();

  return useCallback(
    async (input: ParseInput): Promise<IngestOutcome> => {
      const result = processDocument(input);
      const docId = genId("doc");
      const checksum = quickChecksum(`${input.fileName}:${input.size}`);
      const now = new Date().toISOString();
      const hint = result.normalized.work_stream_hint;
      const ws = hint ? data.workStreams.find((w) => w.code === hint) : undefined;

      const doc: DocumentRecord = {
        id: docId,
        user_id: data.profile?.id ?? DEMO_USER_ID,
        work_stream_id: ws?.id ?? null,
        file_name: input.fileName,
        mime_type: input.mimeType,
        file_size: input.size,
        storage_path_original: `${data.profile?.id ?? DEMO_USER_ID}/originals/${input.fileName}`,
        storage_path_preview: null,
        source_type: "upload",
        document_type: result.documentType,
        checksum,
        uploaded_at: now,
        processing_status: result.needsReview ? "needs_review" : "completed",
        parsing_confidence: result.confidence,
        review_status: result.needsReview ? "needs_review" : "none",
        notes: null,
      };
      await insert("documents", doc);

      const extraction: Extraction = {
        id: genId("ex"),
        document_id: docId,
        extractor_version: EXTRACTOR_VERSION,
        raw_text: result.rawText,
        raw_json: result.rawJson,
        normalized_json: result.normalized,
        confidence_score: result.confidence,
        created_at: now,
      };
      await insert("extractions", extraction);

      let reviewTaskId: string | null = null;
      if (result.needsReview) {
        reviewTaskId = genId("rt");
        const task: ReviewTask = {
          id: reviewTaskId,
          user_id: data.profile?.id ?? DEMO_USER_ID,
          document_id: docId,
          transaction_id: null,
          task_type: "document_extraction",
          priority: result.confidence < 0.6 ? "high" : "medium",
          status: "open",
          payload_json: {
            summary: `Low-confidence extraction (${Math.round(result.confidence * 100)}%) on ${input.fileName}. Verify details.`,
            suggested_action: "Confirm extracted fields and link/create a transaction.",
            suggestion: result.normalized,
          },
          created_at: now,
          completed_at: null,
        };
        await insert("reviewTasks", task);
      }

      return { docId, doc, result, reviewTaskId };
    },
    [data, insert],
  );
}

/** Make a unique-ish file name so repeated sample uploads don't collide. */
export function uniqueFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  return `${stem}-${Date.now().toString().slice(-5)}${ext}`;
}
