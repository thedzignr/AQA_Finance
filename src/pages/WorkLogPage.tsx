import { useMemo, useState } from "react";
import { Car, Clock, NotebookPen, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { SalesDocumentDialog } from "@/components/commerce/SalesDocumentDialog";
import { useData } from "@/data/DataProvider";
import { useAuth } from "@/data/auth";
import { thisWeekHoursByDay, thisWeekWorkLog, ytdMileageAllowance } from "@/lib/selectors";
import {
  defaultBillableForStream,
  defaultEntryTypeForStream,
  lineItemFromWorkEntry,
  workEntryAmount,
} from "@/lib/commerce";
import { formatGBP, formatShortDate, newId, todayISO } from "@/lib/utils";
import type { Invoice, WorkEntry, WorkEntryType, WorkStreamCode } from "@/types/domain";

const ENTRY_TYPES: WorkEntryType[] = ["shift", "hours", "job", "mileage", "piece"];

type StreamFilter = "all" | WorkStreamCode | "mileage";

export function WorkLogPage() {
  const { data, update, remove, clientById, workStreamById } = useData();
  const week = useMemo(() => thisWeekWorkLog(data), [data]);
  const byDay = useMemo(() => thisWeekHoursByDay(data), [data]);
  const mileage = useMemo(() => ytdMileageAllowance(data), [data]);
  const [filter, setFilter] = useState<StreamFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const entries = useMemo(() => {
    return [...data.workEntries]
      .filter((e) => {
        if (filter === "all") return true;
        if (filter === "mileage") return e.entry_type === "mileage";
        const ws = workStreamById(e.work_stream_id);
        return ws?.code === filter;
      })
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  }, [data.workEntries, filter, workStreamById]);

  const selectedEntries = entries.filter((e) => selected.has(e.id));
  const canInvoice =
    selectedEntries.length > 0 &&
    selectedEntries.every((e) => e.billable && !e.invoiced) &&
    new Set(selectedEntries.map((e) => e.client_id)).size === 1 &&
    selectedEntries[0].client_id;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work log"
        icon={NotebookPen}
        description="Log PHV and trade-plate shifts, freelance hours and mileage. Billable rows can be rolled into an invoice."
        actions={
          <Button disabled={!canInvoice} onClick={() => setInvoiceOpen(true)}>
            <Receipt className="h-4 w-4" /> Invoice selected
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Hours this week" value={String(week.hours)} icon={Clock} accent="primary" />
        <StatCard label="Miles this week" value={String(week.miles)} icon={Car} />
        <StatCard label="Logged value" value={formatGBP(week.amount)} />
        <StatCard label="Unbilled" value={formatGBP(week.unbilled)} accent="warning" />
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">This week</p>
          <div className="grid grid-cols-7 gap-2">
            {byDay.map((d) => {
              const label = new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", {
                weekday: "short",
              });
              const isToday = d.date === todayISO();
              return (
                <div
                  key={d.date}
                  className={`rounded-md border p-2 text-center ${isToday ? "border-primary bg-primary/10" : ""}`}
                >
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-semibold tnum">{d.hours || "—"}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            YTD mileage {mileage.miles.toFixed(0)} mi · HMRC AMAP {formatGBP(mileage.allowance)}
            {mileage.remainingAtHigh > 0
              ? ` · ${mileage.remainingAtHigh.toFixed(0)} mi still at 45p`
              : " · now at 25p"}
          </p>
        </CardContent>
      </Card>

      <QuickAdd />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as StreamFilter)}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="phv">PHV</TabsTrigger>
          <TabsTrigger value="trade_plate">Trade plate</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="freelance">Freelance</TabsTrigger>
          <TabsTrigger value="mileage">Mileage</TabsTrigger>
        </TabsList>
      </Tabs>

      {entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nothing logged yet"
          description="Use the form above after a shift or a freelance session. Trade-plate wages and PHV hours live here; expenses still go through the ledger."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Date</TableHead>
                  <TableHead>Stream</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Hours / miles</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const ws = workStreamById(e.work_stream_id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(e.id)}
                          onCheckedChange={() => toggle(e.id)}
                          disabled={!e.billable || e.invoiced}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatShortDate(e.occurred_on)}
                      </TableCell>
                      <TableCell>{ws?.name ?? "—"}</TableCell>
                      <TableCell>
                        <p className="font-medium">{e.description || e.entry_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {clientById(e.client_id)?.name ?? e.operator ?? e.entry_type}
                          {e.billable && !e.invoiced && " · billable"}
                          {e.invoiced && " · invoiced"}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.hours != null ? `${e.hours}h` : ""}
                        {e.hours != null && e.miles != null ? " · " : ""}
                        {e.miles != null ? `${e.miles} mi` : ""}
                        {e.hours == null && e.miles == null ? "—" : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={workEntryAmount(e)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void remove("workEntries", e.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <SalesDocumentDialog
        kind="invoice"
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        defaults={
          canInvoice
            ? {
                client_id: selectedEntries[0].client_id,
                work_stream_id: selectedEntries[0].work_stream_id,
                line_items: selectedEntries.map(lineItemFromWorkEntry),
              }
            : undefined
        }
        onSaved={(doc) => {
          const inv = doc as Invoice;
          for (const e of selectedEntries) {
            void update("workEntries", e.id, {
              invoiced: true,
              invoice_id: inv.id,
            });
          }
          setSelected(new Set());
        }}
      />
    </div>
  );
}

function QuickAdd() {
  const { data, insert, workStreamById } = useData();
  const { userId } = useAuth();
  const defaultStream = data.workStreams.find((w) => w.active)?.id ?? "";
  const [streamId, setStreamId] = useState(defaultStream);
  const [entryType, setEntryType] = useState<WorkEntryType>("hours");
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState("");
  const [miles, setMiles] = useState("");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [operator, setOperator] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [clientId, setClientId] = useState("none");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const stream = workStreamById(streamId || null);

  if (!seeded && defaultStream) {
    setSeeded(true);
    setStreamId(defaultStream);
    setEntryType(defaultEntryTypeForStream(stream?.code));
    setBillable(defaultBillableForStream(stream?.code));
  }

  function onStreamChange(id: string) {
    setStreamId(id);
    const ws = workStreamById(id);
    setEntryType(defaultEntryTypeForStream(ws?.code));
    setBillable(defaultBillableForStream(ws?.code));
  }

  const showOperator = stream?.code === "phv" || stream?.code === "trade_plate" || entryType === "shift";
  const showMiles = stream?.code === "phv" || entryType === "mileage";
  const showClient = stream?.code === "design" || stream?.code === "freelance" || billable;

  async function save() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const row: WorkEntry = {
      id: newId(),
      user_id: userId,
      work_stream_id: streamId || null,
      client_id: clientId === "none" ? null : clientId,
      quote_id: null,
      invoice_id: null,
      entry_type: entryType,
      occurred_on: date,
      start_time: null,
      end_time: null,
      hours: hours ? parseFloat(hours) : null,
      miles: miles ? parseFloat(miles) : null,
      rate: rate ? parseFloat(rate) : null,
      amount: amount ? parseFloat(amount) : null,
      billable,
      invoiced: false,
      operator: operator.trim() || null,
      vehicle: vehicle.trim() || null,
      description: description.trim(),
      notes: null,
      created_at: new Date().toISOString(),
    };
    try {
      await insert("workEntries", row);
      setHours("");
      setMiles("");
      setAmount("");
      setDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save entry.");
    } finally {
      setSaving(false);
    }
  }

  const preview = workEntryAmount({
    amount: amount ? parseFloat(amount) : null,
    hours: hours ? parseFloat(hours) : null,
    miles: miles ? parseFloat(miles) : null,
    rate: rate ? parseFloat(rate) : null,
    entry_type: entryType,
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Log work</p>
          <Badge variant="muted">{formatGBP(preview)}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Work stream">
            <Select value={streamId} onValueChange={onStreamChange}>
              <SelectTrigger>
                <SelectValue placeholder="Stream" />
              </SelectTrigger>
              <SelectContent>
                {data.workStreams.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={entryType} onValueChange={(v) => setEntryType(v as WorkEntryType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Hours">
            <Input
              type="number"
              step="0.25"
              min={0}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 8"
            />
          </Field>
          {showMiles && (
            <Field label="Miles">
              <Input type="number" step="0.1" min={0} value={miles} onChange={(e) => setMiles(e.target.value)} />
            </Field>
          )}
          <Field label={stream?.code === "trade_plate" ? "Wage £/hr" : "Rate £"}>
            <Input type="number" step="0.01" min={0} value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <Field label="Amount override £">
            <Input
              type="number"
              step="0.01"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Optional"
            />
          </Field>
          {showOperator && (
            <Field label="Operator">
              <Input
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder={stream?.code === "phv" ? "Uber / Bolt" : "Operator"}
              />
            </Field>
          )}
          {showOperator && (
            <Field label="Vehicle">
              <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
            </Field>
          )}
          {showClient && (
            <Field label="Client">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {data.clients.filter((c) => c.active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Evening PHV shift, or homepage redesign hours"
                rows={2}
              />
            </Field>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={billable} onCheckedChange={setBillable} />
            Billable (can be invoiced)
          </label>
          <Button onClick={() => void save()} disabled={saving || !userId}>
            <Plus className="h-4 w-4" /> Add to log
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
