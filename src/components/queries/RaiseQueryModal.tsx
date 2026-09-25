import { useState } from 'react';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useCreateQuery } from '../../hooks/useQueries';
import { QUERY_CATEGORIES } from '../../lib/queries';
import type { QueryCategory } from '../../lib/types';
import { Paperclip, Send } from 'lucide-react';

interface RaiseQueryModalProps {
  open: boolean;
  onClose: () => void;
  parcelId: string;
  parcelNumber: string;
}

export default function RaiseQueryModal({ open, onClose, parcelId, parcelNumber }: RaiseQueryModalProps) {
  const { user } = useAuth();
  const createQuery = useCreateQuery();

  const [category, setCategory] = useState<QueryCategory>('Land Record');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !parcelId) return;
    if (!subject.trim() || !description.trim()) return;

    await createQuery.mutateAsync({
      parcelId,
      citizenId: user.id,
      category,
      subject: subject.trim(),
      description: description.trim(),
      attachmentFile: file,
    });

    setSubject('');
    setDescription('');
    setFile(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Raise Query — Parcel ${parcelNumber}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Parcel</label>
          <input
            type="text"
            readOnly
            disabled
            value={parcelNumber}
            className="w-full h-9 px-3 border border-white/10 rounded-md text-xs bg-white/5 text-slate-400 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as QueryCategory)}
            className="w-full h-9 px-3 border border-white/10 rounded-md text-xs bg-[#121212] text-white focus:outline-none focus:ring-2 focus:ring-[#38bdf8] cursor-pointer"
          >
            {QUERY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Subject *</label>
          <Input
            type="text"
            required
            placeholder="Brief summary of your issue or question"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Description *</label>
          <textarea
            required
            rows={4}
            placeholder="Explain the specific issue with your land, survey, compensation, or documents..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 border border-white/10 rounded-md text-xs bg-[#121212] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#38bdf8]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Optional Attachment (Image / PDF / Land Document)
          </label>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 border border-white/10 hover:border-white/30 rounded-md text-xs text-slate-300 bg-white/5 transition-colors">
              <Paperclip size={14} />
              <span>{file ? file.name : 'Choose File'}</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createQuery.isPending || !subject.trim() || !description.trim()}>
            <Send size={14} className="mr-1.5" />
            {createQuery.isPending ? 'Submitting…' : 'Submit Query'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
