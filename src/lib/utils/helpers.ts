// Placeholder — PROMPT 4+ will add helpers
export const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');
