import {
  Banknote,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Optional grouping label. */
  group: "Overview" | "Money" | "Records";
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, group: "Overview", end: true },
  { to: "/review", label: "Review Queue", icon: ClipboardCheck, group: "Overview" },
  { to: "/accounts", label: "Accounts", icon: Wallet, group: "Money" },
  { to: "/transactions", label: "Transactions", icon: Receipt, group: "Money" },
  { to: "/work-streams", label: "Work Streams", icon: Banknote, group: "Money" },
  { to: "/bills", label: "Bills & Subs", icon: CalendarClock, group: "Money" },
  { to: "/debts", label: "Debts", icon: CreditCard, group: "Money" },
  { to: "/budget", label: "Budget", icon: PiggyBank, group: "Money" },
  { to: "/documents", label: "Documents", icon: FileText, group: "Records" },
  { to: "/tax", label: "Tax & Records", icon: ReceiptText, group: "Records" },
];

export const NAV_GROUPS: NavItem["group"][] = ["Overview", "Money", "Records"];
