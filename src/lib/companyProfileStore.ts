import type { User } from "@supabase/supabase-js";
import { COMPANY } from "./company";
import { getSupabase } from "./supabase";
import type { CompanyProfile } from "@/types/domain";

/** Auth user_metadata key used when `company_profiles` is not in the database yet. */
export const COMPANY_PROFILE_META_KEY = "company_profile";

export function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  const text = message ?? "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    /schema cache/i.test(text) ||
    /could not find the table/i.test(text) ||
    /relation .* does not exist/i.test(text)
  );
}

export function companyProfileFromUser(user: User | null | undefined): CompanyProfile | null {
  const raw = user?.user_metadata?.[COMPANY_PROFILE_META_KEY];
  if (!raw || typeof raw !== "object") return null;
  return raw as CompanyProfile;
}

export function defaultCompanyProfile(
  userId: string,
  email: string | null,
  now = new Date().toISOString(),
): CompanyProfile {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    entity_type: "limited_company",
    legal_name: COMPANY.legalName,
    trading_name: COMPANY.tradingName,
    company_number: COMPANY.companyNumber,
    vat_registered: false,
    vat_number: null,
    vat_scheme: "none",
    default_vat_rate: 0,
    registered_address: null,
    email,
    phone: null,
    website: null,
    bank_name: null,
    bank_sort_code: null,
    bank_account_name: null,
    bank_account_number: null,
    invoice_prefix: "INV",
    next_invoice_number: 1,
    quote_prefix: "QTE",
    next_quote_number: 1,
    default_payment_terms_days: 14,
    default_quote_valid_days: 30,
    invoice_footer: null,
    accounting_year_end_month: 3,
    created_at: now,
    updated_at: now,
  };
}

export async function saveCompanyProfileMeta(row: CompanyProfile): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase client is not configured.");
  const { error } = await sb.auth.updateUser({
    data: { [COMPANY_PROFILE_META_KEY]: row },
  });
  if (error) throw new Error(error.message);
}
