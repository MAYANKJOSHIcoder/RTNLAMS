import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { CompensationAward } from '../../lib/types';

interface PaymentModalProps {
  award: CompensationAward | null;
  onClose: () => void;
  onConfirm: (utr: string) => void;
}

export default function PaymentModal({ award, onClose, onConfirm }: PaymentModalProps) {
  const [utr, setUtr] = useState('');
  if (!award) return null;

  return (
    <Modal open={!!award} onClose={onClose} title="Mark Payment Completed">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-200 rounded-lg">
          <Wallet size={24} className="text-green-500 shrink-0" />
          <div>
            <p className="font-medium text-slate-900">₹{Number(award.awarded_amount).toLocaleString('en-IN')}</p>
            <p className="text-sm text-slate-600">Parcel: {award.parcel_id}</p>
          </div>
        </div>
        <Input
          label="Payment reference (UTR / transaction ID)"
          requiredIndicator
          placeholder="e.g. UTR123456789012"
          value={utr}
          onChange={(e) => setUtr(e.target.value)}
        />
        <p className="text-xs text-slate-500">The UTR is stored with the award and required before the payment can be marked completed.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => utr.trim() && onConfirm(utr.trim())} disabled={!utr.trim()}>
            Mark Paid
          </Button>
        </div>
      </div>
    </Modal>
  );
}
