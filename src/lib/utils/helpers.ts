export const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

// Masked display: 123456789012 → XXXX-XXXX-9012
export const formatAadhaar = (aadhaar: string) =>
  aadhaar.length === 12 ? `XXXX-XXXX-${aadhaar.slice(8)}` : aadhaar;
