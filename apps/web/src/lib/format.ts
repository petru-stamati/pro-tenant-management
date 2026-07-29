export function formatEUR(amount: number | string) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return `€${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatRON(amount: number | string) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} lei`;
}

export const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function daysUntil(date: string | Date) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}
