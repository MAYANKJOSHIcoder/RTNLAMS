export const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

export const timeAgo = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};
export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

// Masked display: 123456789012 → XXXX-XXXX-9012
export const formatAadhaar = (aadhaar: string) =>
  aadhaar.length === 12 ? `XXXX-XXXX-${aadhaar.slice(8)}` : aadhaar;
