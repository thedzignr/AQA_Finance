import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DocumentLineItem, LineUnit } from "@/types/domain";
import {
  documentTotals,
  emptyLineItem,
  LINE_UNITS,
  lineGross,
  lineNet,
} from "@/lib/commerce";
import { formatGBP } from "@/lib/utils";

export function LineItemsEditor({
  items,
  onChange,
  defaultVatRate = 0,
  showVat = true,
}: {
  items: DocumentLineItem[];
  onChange: (items: DocumentLineItem[]) => void;
  defaultVatRate?: number;
  showVat?: boolean;
}) {
  const totals = documentTotals(items);

  function patch(id: string, patch: Partial<DocumentLineItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  return (
    <div className="space-y-2">
      <div className="hidden gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[1fr_70px_90px_90px_70px_90px_36px]">
        <span>Description</span>
        <span>Qty</span>
        <span>Unit</span>
        <span>Price</span>
        {showVat ? <span>VAT %</span> : <span />}
        <span className="text-right">Line</span>
        <span />
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-2 gap-2 rounded-md border p-2 md:grid-cols-[1fr_70px_90px_90px_70px_90px_36px] md:border-0 md:p-0"
        >
          <Input
            className="col-span-2 md:col-span-1"
            placeholder="What you're charging for"
            value={item.description}
            onChange={(e) => patch(item.id, { description: e.target.value })}
          />
          <Input
            type="number"
            step="0.25"
            min={0}
            value={item.quantity}
            onChange={(e) => patch(item.id, { quantity: parseFloat(e.target.value) || 0 })}
          />
          <Select
            value={item.unit}
            onValueChange={(v) => patch(item.id, { unit: v as LineUnit })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINE_UNITS.map((u) => (
                <SelectItem key={u} value={u} className="capitalize">
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={item.unit_price}
            onChange={(e) => patch(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
          />
          {showVat ? (
            <Input
              type="number"
              step="0.01"
              min={0}
              value={item.vat_rate}
              onChange={(e) => patch(item.id, { vat_rate: parseFloat(e.target.value) || 0 })}
            />
          ) : (
            <span className="hidden md:block" />
          )}
          <div className="flex items-center justify-end text-sm tnum">
            {formatGBP(showVat ? lineGross(item) : lineNet(item))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onChange(items.filter((i) => i.id !== item.id))}
            disabled={items.length <= 1}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, emptyLineItem(defaultVatRate)])}
      >
        <Plus className="h-4 w-4" /> Add line
      </Button>
      <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Net</span>
          <span className="tnum">{formatGBP(totals.net)}</span>
        </div>
        {showVat && (
          <div className="flex justify-between text-muted-foreground">
            <span>VAT</span>
            <span className="tnum">{formatGBP(totals.vat)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-1 font-semibold">
          <span>Total</span>
          <span className="tnum">{formatGBP(totals.gross)}</span>
        </div>
      </div>
    </div>
  );
}
