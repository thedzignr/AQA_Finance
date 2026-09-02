import { useCallback } from "react";
import { useData } from "@/data/DataProvider";
import { buildIngestRecords } from "@/lib/ingestDocument";
import type { ParseInput } from "@/lib/parsing";
import { useAuth } from "@/data/auth";

export interface IngestOutcome {
  docId: string;
  result: ReturnType<typeof buildIngestRecords>["result"];
  reviewTaskId: string | null;
}

/**
 * Shared document ingestion: parse, store metadata, and open a review task
 * when confidence is low. Used by the Documents inbox and dashboard upload.
 */
export function useDocumentIngest() {
  const { data, insert } = useData();
  const { userId } = useAuth();

  return useCallback(
    async (input: ParseInput): Promise<IngestOutcome> => {
      const uid = data.profile?.id ?? userId ?? "";
      const records = buildIngestRecords({
        parse: input,
        userId: uid,
        workStreams: data.workStreams,
        sourceType: "upload",
        storagePath: `${uid}/originals/${input.fileName}`,
      });
      await insert("documents", records.doc);
      await insert("extractions", records.extraction);
      if (records.reviewTask) await insert("reviewTasks", records.reviewTask);
      return {
        docId: records.doc.id,
        result: records.result,
        reviewTaskId: records.reviewTask?.id ?? null,
      };
    },
    [data, insert, userId],
  );
}

/** Make a unique-ish file name so repeated sample uploads don't collide. */
export function uniqueFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  return `${stem}-${Date.now().toString().slice(-5)}${ext}`;
}
