import { useState } from 'react';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useResolveBreach } from '../../hooks/useStages';
import { STAGES } from '../../lib/stages';
import type { AcquisitionStage } from '../../lib/types';

interface ResolveBreachModalProps {
  stage: AcquisitionStage | null;
  onClose: () => void;
}

export default function ResolveBreachModal({ stage, onClose }: ResolveBreachModalProps) {
  const resolve = useResolveBreach();
  const def = STAGES.find((s) => s.stage_number === stage?.stage_number);
  const defaultDeadline = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + (def?.sla_days ?? 15));
    return d.toISOString().slice(0, 10);
  };
  const [deadline, setDeadline] = useState(defaultDeadline);

  if (!stage) return null;

  const submit = () => {
    if (!deadline) return;
    const iso = new Date(`${deadline}T23:59:59`).toISOString();
    resolve.mutate(
      { stageId: stage.id, newDeadline: iso },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={!!stage} onClose={onClose} title="Resolve SLA Breach">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-red-50/10 border border-red-200 rounded-lg">
          <AlertTriangle size={24} className="text-red-500 shrink-0" />
          <div>
            <p className="font-medium text-slate-900">
              Stage {stage.stage_number}: {stage.stage_name}
            </p>
            <p className="text-sm text-slate-600">
              Breached {stage.sla_deadline ? new Date(stage.sla_deadline).toLocaleDateString() : '-'} — set a new deadline to resume progress.
            </p>
          </div>
        </div>
        <Input
          label="New SLA deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <CalendarClock size={12} /> The resolution (old deadline → new deadline) is recorded in the stage notes.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={resolve.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={resolve.isPending}>
            Resolve Breach
          </Button>
        </div>
      </div>
    </Modal>
  );
}
