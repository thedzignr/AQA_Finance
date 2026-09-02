/** Public receive-only inbox shown in the UI. Never used to send mail. */
export function inboundMailbox(): string {
  return (import.meta.env.VITE_INBOUND_MAILBOX ?? "").trim();
}
