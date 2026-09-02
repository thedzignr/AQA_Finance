import { useEffect, useState } from "react";
import { Building2, Check, Loader2, LogOut, Settings, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionTitle } from "@/components/shared/IconWell";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/DataProvider";
import { getSupabase } from "@/lib/supabase";
import { InboundMailboxCard } from "@/components/shared/InboundMailboxCard";
import { COMPANY } from "@/lib/company";
import { companyProfile } from "@/lib/selectors";
import { newId } from "@/lib/utils";
import type { CompanyProfile, EntityType, VatScheme } from "@/types/domain";

export function SettingsPage() {
  const { userId, email, signOut } = useAuth();
  const { data, refresh } = useData();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(data.profile?.full_name ?? "");
  }, [data.profile?.full_name]);

  async function save() {
    const sb = getSupabase();
    if (!sb || !userId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: dbError } = await sb
      .from("profiles")
      .update({ full_name: fullName } as never)
      .eq("id", userId);
    await sb.auth.updateUser({ data: { full_name: fullName } });
    if (dbError) {
      setError(dbError.message);
    } else {
      setSaved(true);
      await refresh();
    }
    setSaving(false);
  }

  const dirty = fullName.trim() !== (data.profile?.full_name ?? "");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        icon={Settings}
        description={`${COMPANY.legalName} · company no. ${COMPANY.companyNumber}. These details print on quotes and invoices.`}
      />

      <CompanySettingsCard />

      <div className="max-w-3xl">
        <InboundMailboxCard />
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <SectionTitle icon={UserRound}>Your profile</SectionTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setSaved(false);
              }}
              placeholder="Director name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">
              Email is managed by your sign-in and can't be changed here yet.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={!dirty || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save profile
            </Button>
            {saved && !dirty && (
              <span className="flex items-center gap-1 text-sm text-success">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <SectionTitle icon={LogOut}>Account</SectionTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Data backend</span>
            <Badge variant="success">Supabase</Badge>
          </div>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CompanySettingsCard() {
  const { userId } = useAuth();
  const { data, insert, update } = useData();
  const existing = companyProfile(data);
  const [form, setForm] = useState<Partial<CompanyProfile>>({
    entity_type: "limited_company",
    legal_name: COMPANY.legalName,
    trading_name: COMPANY.tradingName,
    company_number: COMPANY.companyNumber,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setForm({
        ...existing,
        legal_name: existing.legal_name || COMPANY.legalName,
        trading_name: existing.trading_name || COMPANY.tradingName,
        company_number: existing.company_number || COMPANY.companyNumber,
      });
    }
  }, [existing]);

  function set<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function saveCompany() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const payload: Omit<CompanyProfile, "id" | "user_id" | "created_at"> = {
      entity_type: (form.entity_type as EntityType) ?? "limited_company",
      legal_name: form.legal_name || COMPANY.legalName,
      trading_name: form.trading_name || COMPANY.tradingName,
      company_number: form.company_number || COMPANY.companyNumber,
      vat_registered: Boolean(form.vat_registered),
      vat_number: form.vat_number || null,
      vat_scheme: (form.vat_scheme as VatScheme) ?? "none",
      default_vat_rate: Number(form.default_vat_rate) || 0,
      registered_address: form.registered_address || null,
      email: form.email || null,
      phone: form.phone || null,
      website: form.website || null,
      bank_name: form.bank_name || null,
      bank_sort_code: form.bank_sort_code || null,
      bank_account_name: form.bank_account_name || null,
      bank_account_number: form.bank_account_number || null,
      invoice_prefix: form.invoice_prefix || "INV",
      next_invoice_number: Number(form.next_invoice_number) || 1,
      quote_prefix: form.quote_prefix || "QTE",
      next_quote_number: Number(form.next_quote_number) || 1,
      default_payment_terms_days: Number(form.default_payment_terms_days) || 14,
      default_quote_valid_days: Number(form.default_quote_valid_days) || 30,
      invoice_footer: form.invoice_footer || null,
      accounting_year_end_month: Number(form.accounting_year_end_month) || 3,
      updated_at: now,
    };
    try {
      if (existing) {
        await update("companyProfiles", existing.id, payload);
      } else {
        await insert("companyProfiles", {
          id: newId(),
          user_id: userId,
          ...payload,
          created_at: now,
        });
      }
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save company details. Run the 0009_ltd_operations.sql migration in Supabase first.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <SectionTitle icon={Building2}>Company</SectionTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Section title="Legal">
          <Field label="Entity">
            <Select
              value={form.entity_type ?? "limited_company"}
              onValueChange={(v) => set("entity_type", v as EntityType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="limited_company">Limited company</SelectItem>
                <SelectItem value="sole_trader">Sole trader</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Legal name">
            <Input
              value={form.legal_name ?? ""}
              onChange={(e) => set("legal_name", e.target.value)}
              placeholder={COMPANY.legalName}
            />
          </Field>
          <Field label="Trading name">
            <Input
              value={form.trading_name ?? ""}
              onChange={(e) => set("trading_name", e.target.value || null)}
              placeholder={COMPANY.tradingName}
            />
          </Field>
          <Field label="Company number">
            <Input
              value={form.company_number ?? ""}
              onChange={(e) => set("company_number", e.target.value || null)}
              placeholder={COMPANY.companyNumber}
            />
          </Field>
          <Field label="Registered address" full>
            <Textarea
              value={form.registered_address ?? ""}
              onChange={(e) => set("registered_address", e.target.value || null)}
              rows={3}
            />
          </Field>
          <Field label="Company email">
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value || null)}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value || null)}
            />
          </Field>
        </Section>

        <Section title="VAT">
          <div className="col-span-full flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">VAT registered</p>
              <p className="text-xs text-muted-foreground">
                Turns VAT on quotes and invoices, and the VAT box on Tax & Records.
              </p>
            </div>
            <Switch
              checked={Boolean(form.vat_registered)}
              onCheckedChange={(v) => {
                set("vat_registered", v);
                if (v) {
                  if (!form.vat_scheme || form.vat_scheme === "none") set("vat_scheme", "standard");
                  if (!form.default_vat_rate) set("default_vat_rate", 20);
                } else {
                  set("vat_scheme", "none");
                }
              }}
            />
          </div>
          <Field label="VAT number">
            <Input
              value={form.vat_number ?? ""}
              onChange={(e) => set("vat_number", e.target.value || null)}
              disabled={!form.vat_registered}
            />
          </Field>
          <Field label="VAT scheme">
            <Select
              value={form.vat_scheme ?? "none"}
              onValueChange={(v) => set("vat_scheme", v as VatScheme)}
              disabled={!form.vat_registered}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not registered</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="cash_accounting">Cash accounting</SelectItem>
                <SelectItem value="flat_rate">Flat rate</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Default VAT rate %">
            <Input
              type="number"
              step="0.01"
              value={form.default_vat_rate ?? 0}
              onChange={(e) => set("default_vat_rate", parseFloat(e.target.value) || 0)}
              disabled={!form.vat_registered}
            />
          </Field>
        </Section>

        <Section title="Bank details (printed on invoices)">
          <Field label="Account name">
            <Input
              value={form.bank_account_name ?? ""}
              onChange={(e) => set("bank_account_name", e.target.value || null)}
            />
          </Field>
          <Field label="Bank">
            <Input
              value={form.bank_name ?? ""}
              onChange={(e) => set("bank_name", e.target.value || null)}
            />
          </Field>
          <Field label="Sort code">
            <Input
              value={form.bank_sort_code ?? ""}
              onChange={(e) => set("bank_sort_code", e.target.value || null)}
              placeholder="00-00-00"
            />
          </Field>
          <Field label="Account number">
            <Input
              value={form.bank_account_number ?? ""}
              onChange={(e) => set("bank_account_number", e.target.value || null)}
            />
          </Field>
        </Section>

        <Section title="Numbering & terms">
          <Field label="Invoice prefix">
            <Input
              value={form.invoice_prefix ?? "INV"}
              onChange={(e) => set("invoice_prefix", e.target.value)}
            />
          </Field>
          <Field label="Next invoice no.">
            <Input
              type="number"
              min={1}
              value={form.next_invoice_number ?? 1}
              onChange={(e) => set("next_invoice_number", parseInt(e.target.value, 10) || 1)}
            />
          </Field>
          <Field label="Quote prefix">
            <Input
              value={form.quote_prefix ?? "QTE"}
              onChange={(e) => set("quote_prefix", e.target.value)}
            />
          </Field>
          <Field label="Next quote no.">
            <Input
              type="number"
              min={1}
              value={form.next_quote_number ?? 1}
              onChange={(e) => set("next_quote_number", parseInt(e.target.value, 10) || 1)}
            />
          </Field>
          <Field label="Payment terms (days)">
            <Input
              type="number"
              min={0}
              value={form.default_payment_terms_days ?? 14}
              onChange={(e) => set("default_payment_terms_days", parseInt(e.target.value, 10) || 0)}
            />
          </Field>
          <Field label="Quote valid (days)">
            <Input
              type="number"
              min={1}
              value={form.default_quote_valid_days ?? 30}
              onChange={(e) => set("default_quote_valid_days", parseInt(e.target.value, 10) || 30)}
            />
          </Field>
          <Field label="Year-end month">
            <Select
              value={String(form.accounting_year_end_month ?? 3)}
              onValueChange={(v) => set("accounting_year_end_month", parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December",
                ].map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Invoice footer" full>
            <Textarea
              value={form.invoice_footer ?? ""}
              onChange={(e) => set("invoice_footer", e.target.value || null)}
              placeholder="Shown at the bottom of printed invoices"
              rows={2}
            />
          </Field>
        </Section>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={() => void saveCompany()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save company
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-success">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-full space-y-1.5" : "space-y-1.5"}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
