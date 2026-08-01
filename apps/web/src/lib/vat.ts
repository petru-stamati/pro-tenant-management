/** Standard rate used to derive the "other" VAT figure for display — every price in the app is VAT-incl. by default. */
export const STANDARD_VAT_PERCENT = 21;

export function withVat(amount: number | string, vatIncluded: boolean, vatPercent = STANDARD_VAT_PERCENT): number {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return vatIncluded ? n : n * (1 + vatPercent / 100);
}

export function withoutVat(amount: number | string, vatIncluded: boolean, vatPercent = STANDARD_VAT_PERCENT): number {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return vatIncluded ? n / (1 + vatPercent / 100) : n;
}
