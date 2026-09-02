import { useMemo, useState } from "react";
import { Mail, MoreHorizontal, Plus, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/PageHeader";
import { IconWell } from "@/components/shared/IconWell";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { useData } from "@/data/DataProvider";
import { useAuth } from "@/data/auth";
import { clientOutstanding } from "@/lib/selectors";
import { formatGBP, newId } from "@/lib/utils";
import type { Client } from "@/types/domain";

export function ClientsPage() {
  const { data, update, remove } = useData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [query, setQuery] = useState("");

  const clients = useMemo(() => {
    const q = query.toLowerCase();
    return [...data.clients]
      .filter((c) => {
        if (!q) return true;
        return `${c.name} ${c.contact_name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.clients, query]);

  const active = data.clients.filter((c) => c.active).length;
  const outstanding = data.clients.reduce((s, c) => s + clientOutstanding(data, c.id), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        icon={UserRound}
        description="People and companies you quote and invoice — design clients, freelance contacts, operators you bill."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add client
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Active clients" value={String(active)} icon={UserRound} accent="primary" />
        <StatCard label="All clients" value={String(data.clients.length)} icon={Users} />
        <StatCard label="Outstanding" value={formatGBP(outstanding)} icon={Mail} accent="warning" />
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients…"
        className="max-w-sm"
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No clients yet"
          description="Add the people and companies you work for so quotes and invoices fill themselves in."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add client
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => {
            const due = clientOutstanding(data, c.id);
            return (
              <Card key={c.id} className={!c.active ? "opacity-60" : undefined}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <IconWell icon={UserRound} size="sm" variant={c.active ? "accent" : "muted"} />
                      <div className="min-w-0">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.contact_name || c.email || "No contact yet"}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(c);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void update("clients", c.id, { active: !c.active })}
                        >
                          {c.active ? "Deactivate" : "Reactivate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => void remove("clients", c.id)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {!c.active && <Badge variant="muted">Inactive</Badge>}
                    {c.email && (
                      <Badge variant="secondary" className="gap-1 font-normal">
                        <Mail className="h-3 w-3" /> {c.email}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Outstanding{" "}
                    <span className="font-medium text-foreground tnum">{formatGBP(due)}</span>
                  </p>
                  {c.notes && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ClientDialog open={open} onOpenChange={setOpen} client={editing} />
    </div>
  );
}

function ClientDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: Client | null;
}) {
  const { data, insert, update } = useData();
  const { userId } = useAuth();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vat, setVat] = useState("");
  const [stream, setStream] = useState("none");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(client);
  const [seeded, setSeeded] = useState<string | null>(null);
  if (open && seeded !== (client?.id ?? "new")) {
    setSeeded(client?.id ?? "new");
    setName(client?.name ?? "");
    setContact(client?.contact_name ?? "");
    setEmail(client?.email ?? "");
    setPhone(client?.phone ?? "");
    setAddress(client?.address ?? "");
    setVat(client?.vat_number ?? "");
    setStream(client?.default_work_stream_id ?? "none");
    setTerms(client?.payment_terms_days != null ? String(client.payment_terms_days) : "");
    setNotes(client?.notes ?? "");
    setError(null);
  }

  async function save() {
    if (!userId || !name.trim()) return;
    setError(null);
    const payload = {
      name: name.trim(),
      contact_name: contact.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      vat_number: vat.trim() || null,
      default_work_stream_id: stream === "none" ? null : stream,
      payment_terms_days: terms ? parseInt(terms, 10) : null,
      notes: notes.trim() || null,
    };
    try {
      if (isEdit && client) {
        await update("clients", client.id, payload);
      } else {
        const row: Client = {
          id: newId(),
          user_id: userId,
          ...payload,
          active: true,
          created_at: new Date().toISOString(),
        };
        await insert("clients", row);
      }
      onOpenChange(false);
      setSeeded(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save client.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSeeded(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "Add client"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company or person" />
          </div>
          <div className="space-y-1.5">
            <Label>Contact</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>VAT number</Label>
            <Input value={vat} onChange={(e) => setVat(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Default work stream</Label>
            <Select value={stream} onValueChange={setStream}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {data.workStreams.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Payment terms (days)</Label>
            <Input
              type="number"
              min={0}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Company default"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!name.trim()}>
            {isEdit ? "Save" : "Add client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
