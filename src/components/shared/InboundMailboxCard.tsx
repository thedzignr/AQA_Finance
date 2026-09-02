import { useState } from "react";
import { Check, Copy, Inbox, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/shared/IconWell";
import { inboundMailbox } from "@/lib/inboundMailbox";

export function InboundMailboxCard({
  compact = false,
  embedded = false,
}: {
  compact?: boolean;
  embedded?: boolean;
}) {
  const address = inboundMailbox();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const body = (
    <>
      {address ? (
        <>
          <p className="text-sm text-muted-foreground">
            Give this address to parking barriers, fuel receipts, invoices and
            similar. Mail is accepted but never sent from here. Attachments
            land in Documents and wait in Review before they hit the ledger.
          </p>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            <code className="min-w-0 flex-1 truncate text-sm font-medium">{address}</code>
            <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          The inbound pipeline is ready. Once the receive-only mailbox is
          connected, the address will show here so you can put it on receipts
          and parking tickets.
        </p>
      )}
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Refresh the app after a receipt arrives, then confirm it in{" "}
          <Link to="/review" className="text-primary hover:underline">
            Review
          </Link>
          .
        </p>
      )}
      {compact && !embedded && (
        <Link to="/documents" className="text-xs text-primary hover:underline">
          Open documents
        </Link>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{body}</div>;
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <SectionTitle icon={Inbox}>Receipts inbox</SectionTitle>
        <Badge variant="muted">Receive only</Badge>
      </CardHeader>
      <CardContent className="space-y-3">{body}</CardContent>
    </Card>
  );
}
