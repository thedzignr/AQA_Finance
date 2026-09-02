import { Resend } from "resend";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildIngestRecords } from "../src/lib/ingestDocument";
import type { ParseInput } from "../src/lib/parsing";
import type { WorkStream } from "../src/types/domain";

export const maxDuration = 60;

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

type ReceivedEvent = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function admin(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ownerUserId() {
  if (process.env.AQA_INGEST_USER_ID) return process.env.AQA_INGEST_USER_ID;
  const sb = admin();
  const { data, error } = await sb.from("profiles").select("id").limit(1).maybeSingle();
  if (error || !data?.id) throw new Error("No profile to attach inbound documents to");
  return data.id as string;
}

function safeFileName(name: string) {
  const trimmed = name.trim() || "attachment";
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
}

function isSkipInline(att: {
  content_type?: string | null;
  content_disposition?: string | null;
  filename?: string | null;
}) {
  const disp = (att.content_disposition ?? "").toLowerCase();
  const type = (att.content_type ?? "").toLowerCase();
  if (disp === "inline" && type.startsWith("image/")) return true;
  const name = (att.filename ?? "").toLowerCase();
  return name === "logo.png" || name === "image.png" || name === "logo.jpg";
}

async function sha256(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function persist(
  parse: ParseInput,
  bytes: Uint8Array | null,
  notes: string,
  userId: string,
  streams: Pick<WorkStream, "id" | "code">[],
) {
  const sb = admin();
  const hash = bytes ? await sha256(bytes) : undefined;
  if (hash) {
    const { data: existing } = await sb
      .from("documents")
      .select("id")
      .eq("user_id", userId)
      .eq("checksum", hash)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return { skipped: true, docId: existing.id as string };
  }

  const path = `${userId}/originals/${Date.now()}-${safeFileName(parse.fileName)}`;
  if (bytes) {
    const { error } = await sb.storage.from("documents").upload(path, bytes, {
      contentType: parse.mimeType,
      upsert: false,
    });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  }

  const records = buildIngestRecords({
    parse,
    userId,
    workStreams: streams,
    sourceType: "email",
    storagePath: bytes ? path : `${userId}/originals/${safeFileName(parse.fileName)}`,
    checksum: hash,
    notes,
    forceReview: true,
  });

  const { error: docErr } = await sb.from("documents").insert(records.doc);
  if (docErr) throw new Error(docErr.message);
  const { error: exErr } = await sb.from("extractions").insert(records.extraction);
  if (exErr) throw new Error(exErr.message);
  if (records.reviewTask) {
    const { error: rtErr } = await sb.from("review_tasks").insert(records.reviewTask);
    if (rtErr) throw new Error(rtErr.message);
  }
  return { skipped: false, docId: records.doc.id };
}

function verifyWebhook(resend: Resend, payload: string, request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const isProd = process.env.VERCEL_ENV === "production";
  if (!secret) {
    if (isProd) throw new Error("RESEND_WEBHOOK_SECRET is not set");
    return;
  }
  resend.webhooks.verify({
    payload,
    headers: {
      id: request.headers.get("svix-id") ?? "",
      timestamp: request.headers.get("svix-timestamp") ?? "",
      signature: request.headers.get("svix-signature") ?? "",
    },
    webhookSecret: secret,
  });
}

export function GET() {
  return json({ ok: true, receiveOnly: true });
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json({ error: "RESEND_API_KEY is not set" }, 500);

  const payload = await request.text();
  const resend = new Resend(apiKey);

  try {
    verifyWebhook(resend, payload, request);
  } catch {
    return json({ error: "Invalid webhook signature" }, 400);
  }

  let event: ReceivedEvent;
  try {
    event = JSON.parse(payload) as ReceivedEvent;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (event.type !== "email.received") return json({ ok: true, ignored: event.type ?? "unknown" });

  const emailId = event.data?.email_id;
  if (!emailId) return json({ error: "Missing email_id" }, 400);

  const { data: email, error: emailErr } = await resend.emails.receiving.get(emailId);
  if (emailErr || !email) {
    return json({ error: emailErr?.message ?? "Could not load received email" }, 502);
  }

  let userId: string;
  let workStreams: Pick<WorkStream, "id" | "code">[];
  try {
    userId = await ownerUserId();
    const sb = admin();
    const { data: streams } = await sb.from("work_streams").select("id, code").eq("user_id", userId);
    workStreams = (streams ?? []) as Pick<WorkStream, "id" | "code">[];
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Owner lookup failed" }, 500);
  }

  const from = email.from ?? event.data?.from ?? "";
  const subject = email.subject ?? event.data?.subject ?? "(no subject)";
  const bodyText =
    (typeof email.text === "string" && email.text.trim()) ||
    (typeof email.html === "string" ? email.html.replace(/<[^>]+>/g, " ").trim() : "") ||
    "";
  const notes = `From: ${from}\nSubject: ${subject}`;

  const { data: listed } = await resend.emails.receiving.attachments.list({ emailId });
  const attachments = listed?.data ?? [];
  const ingested: Array<{ docId: string; skipped: boolean; fileName: string }> = [];
  const failures: string[] = [];

  for (const att of attachments) {
    if (isSkipInline(att)) continue;
    const url = att.download_url;
    if (!url) continue;
    try {
      const fileRes = await fetch(url);
      if (!fileRes.ok) {
        failures.push(`${att.filename ?? att.id}: download ${fileRes.status}`);
        continue;
      }
      const buffer = new Uint8Array(await fileRes.arrayBuffer());
      if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
        failures.push(`${att.filename ?? att.id}: too large`);
        continue;
      }
      const fileName = safeFileName(att.filename || `attachment-${att.id}`);
      const mime = att.content_type || "application/octet-stream";
      const parse: ParseInput = {
        fileName,
        mimeType: mime,
        size: buffer.byteLength,
        subject,
        from,
        textContent:
          mime.includes("csv") || mime.startsWith("text/")
            ? new TextDecoder().decode(buffer)
            : undefined,
      };
      ingested.push({
        ...(await persist(parse, buffer, notes, userId, workStreams)),
        fileName,
      });
    } catch (e) {
      failures.push(`${att.filename ?? att.id}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  if (ingested.length === 0 && bodyText) {
    try {
      const fileName = `${safeFileName(subject)}.txt`;
      const bytes = new TextEncoder().encode(bodyText);
      ingested.push({
        ...(await persist(
          {
            fileName,
            mimeType: "text/plain",
            size: bytes.byteLength,
            textContent: bodyText,
            subject,
            from,
          },
          bytes,
          notes,
          userId,
          workStreams,
        )),
        fileName,
      });
    } catch (e) {
      failures.push(`body: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  if (ingested.length === 0) {
    return json({ error: "Nothing ingested", failures }, 500);
  }

  return json({ ok: true, emailId, ingested, failures });
}
