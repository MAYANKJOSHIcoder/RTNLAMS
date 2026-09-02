import toast from 'react-hot-toast';

// Centralized toast theme per PROMPT 8 — institutional colors
export const notify = {
  success: (msg: string) => toast.success(msg, { style: { border: '1px solid #bbf7d0', background: '#f0fdf4' } }),
  error: (msg: string) => toast.error(msg, { style: { border: '1px solid #fecaca', background: '#fef2f2' } }),
  info: (msg: string) => toast(msg, { icon: 'ℹ️', style: { border: '1px solid #bfdbfe', background: '#eff6ff' } }),
};

export { toast };
export default notify;
