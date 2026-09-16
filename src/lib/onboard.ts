import { getSupabase } from "./supabase";
import { COMPANY } from "./company";
import {
  companyProfileFromUser,
  defaultCompanyProfile,
  isMissingRelationError,
  saveCompanyProfileMeta,
} from "./companyProfileStore";
import type { OperatingCost, WorkStream } from "@/types/domain";

/**
 * First-run cloud seed.
 *
 * When a user signs in for the first time their account is empty. We give them
 * a working starting point — a profile row, the default work streams, and the
 * app's own running costs — all owned by their real auth user id. Transactions,
 * accounts, bills and debts are left for the user to add (this is a real
 * account, not demo data). Every step is idempotent, so it's safe to run on
 * every load.
 */

const WORK_STREAMS: Array<Pick<WorkStream, "code" | "name" | "tracks_expenses" | "notes">> = [
  {
    code: "phv",
    name: "PHV / Private Hire",
    tracks_expenses: true,
    notes: "Self-employed via operator. Upload weekly operator statements as evidence.",
  },
  {
    code: "trade_plate",
    name: "Trade Plate Driving",
    tracks_expenses: false,
    notes: "Paid a wage; running costs are on the operator's card, so no expenses are tracked here.",
  },
  { code: "design", name: "Design Work", tracks_expenses: true, notes: null },
  { code: "freelance", name: "Freelance", tracks_expenses: true, notes: null },
  { code: "other", name: "Other Income", tracks_expenses: true, notes: null },
];

const OPERATING_COSTS: Array<
  Pick<
    OperatingCost,
    "name" | "vendor" | "category" | "amount_estimate" | "billing_cycle" | "usage_based" | "notes"
  >
> = [
  {
    name: "Claude API (Haiku 4.5)",
    vendor: "Anthropic",
    category: "ai",
    amount_estimate: 3,
    billing_cycle: "monthly",
    usage_based: true,
    notes: "Document extraction & categorisation — ~200 docs/mo, metered",
  },
  {
    name: "Vercel",
    vendor: "Vercel",
    category: "hosting",
    amount_estimate: 0,
    billing_cycle: "monthly",
    usage_based: false,
    notes: "Hobby (free); Pro is ~£16/mo if upgraded",
  },
  {
    name: "Supabase",
    vendor: "Supabase",
    category: "database",
    amount_estimate: 0,
    billing_cycle: "monthly",
    usage_based: false,
    notes: "Free tier; Pro is ~£20/mo past free limits",
  },
];

async function isEmpty(
  table: "work_streams" | "operating_costs" | "company_profiles",
  userId: string,
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { count } = await sb
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) === 0;
}

export async function ensureOnboarded(
  userId: string,
  email: string | null,
  fullName: string | null,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  // Profile (RLS allows a user to insert their own row, id = auth.uid()).
  const { data: profile } = await sb
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) {
    await sb.from("profiles").insert({
      id: userId,
      full_name: fullName ?? "",
      email: email ?? "",
    } as never);
  }

  if (await isEmpty("work_streams", userId)) {
    await sb.from("work_streams").insert(
      WORK_STREAMS.map((w) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        ...w,
        active: true,
      })) as never,
    );
  }

  if (await isEmpty("operating_costs", userId)) {
    await sb.from("operating_costs").insert(
      OPERATING_COSTS.map((o) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        ...o,
        active: true,
      })) as never,
    );
  }

  const { data: authData } = await sb.auth.getUser();
  const { data: company, error: companyError } = await sb
    .from("company_profiles")
    .select("id, legal_name, trading_name, company_number")
    .eq("user_id", userId)
    .maybeSingle();
  const now = new Date().toISOString();
  if (isMissingRelationError(companyError)) {
    if (!companyProfileFromUser(authData.user)) {
      await saveCompanyProfileMeta(defaultCompanyProfile(userId, email, now));
    }
    return;
  }
  if (!company) {
    const row = defaultCompanyProfile(userId, email, now);
    const { error: insertError } = await sb.from("company_profiles").insert(row as never);
    if (isMissingRelationError(insertError)) {
      await saveCompanyProfileMeta(row);
    }
  } else {
    const patch: Record<string, string> = {};
    const row = company as {
      id: string;
      legal_name: string | null;
      trading_name: string | null;
      company_number: string | null;
    };
    if (!row.legal_name) patch.legal_name = COMPANY.legalName;
    if (!row.trading_name) patch.trading_name = COMPANY.tradingName;
    if (!row.company_number) patch.company_number = COMPANY.companyNumber;
    if (Object.keys(patch).length > 0) {
      await sb
        .from("company_profiles")
        .update({ ...patch, updated_at: now } as never)
        .eq("id", row.id);
    }
  }
}
