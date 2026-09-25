import { useState } from 'react';
import Modal from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import {
  useQueryDetail,
  useQueryMessages,
  useSendQueryMessage,
  useUpdateQueryStatus,
} from '../../hooks/useQueries';
import { Send, CheckCircle2, RotateCcw, Clock, User, MapPin } from 'lucide-react';
import { isStaff } from '../../lib/permissions';
import { queryStatusVariant, queryStatusLabel } from '../../lib/queries';

interface QueryDetailModalProps {
  queryId: string | null;
  onClose: () => void;
}

export default function QueryDetailModal({ queryId, onClose }: QueryDetailModalProps) {
  const { user, profile } = useAuth();
  const { data: query, isLoading: queryLoading } = useQueryDetail(queryId || undefined);
  const { data: messages = [], isLoading: messagesLoading } = useQueryMessages(queryId || undefined);

  const sendMessage = useSendQueryMessage();
  const updateStatus = useUpdateQueryStatus();

  const [replyText, setReplyText] = useState('');
  const userIsStaff = isStaff(profile?.role);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !query || !user) return;

    await sendMessage.mutateAsync({
      queryId: query.id,
      senderId: user.id,
      message: replyText.trim(),
      parcelId: query.parcel_id,
    });

    setReplyText('');
  };

  const handleResolve = () => {
    if (!query) return;
    updateStatus.mutate({ queryId: query.id, status: 'resolved' });
  };

  const handleUnderReview = () => {
    if (!query) return;
    updateStatus.mutate({ queryId: query.id, status: 'under_review' });
  };

  const handleReopen = () => {
    if (!query) return;
    updateStatus.mutate({ queryId: query.id, status: 'reopened' });
  };

  return (
    <Modal
      open={!!queryId}
      onClose={onClose}
      title={query ? `Query: ${query.subject}` : 'Query Details'}
    >
      {queryLoading || !query ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading query details…</div>
      ) : (
        <div className="space-y-4 text-xs">
          {/* Query Header Info */}
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant={queryStatusVariant(query.status)}>
                  {queryStatusLabel(query.status)}
                </Badge>
                <span className="font-semibold text-white">{query.category}</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Raised on {new Date(query.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5 text-slate-300">
              <div className="flex items-center gap-1.5">
                <User size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">
                  {query.citizen?.full_name || 'Citizen'}
                  {query.citizen?.phone ? ` (${query.citizen.phone})` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">Parcel: {query.parcel?.parcel_number || query.parcel_id}</span>
              </div>
            </div>
          </div>

          {/* Initial Query Description */}
          <div className="p-3 bg-[#121212] border border-white/10 rounded-lg">
            <span className="block text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
              Issue Description
            </span>
            <p className="text-white whitespace-pre-wrap leading-relaxed">{query.description}</p>
          </div>

          {/* Conversation History */}
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">
              Conversation Thread
            </span>

            {messagesLoading ? (
              <div className="py-4 text-center text-slate-500">Loading messages…</div>
            ) : messages.length === 0 ? (
              <div className="py-3 text-center text-slate-500 bg-white/5 rounded-lg">No replies yet.</div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {messages.map((m) => {
                  const isCitizenSender = m.sender?.role === 'citizen';
                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-lg border ${
                        isCitizenSender
                          ? 'bg-white/5 border-white/10'
                          : 'bg-sky-950/30 border-sky-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          {m.sender?.full_name || (isCitizenSender ? 'Citizen' : 'Officer')}
                          <Badge variant={isCitizenSender ? 'neutral' : 'info'} className="text-[9px] py-0">
                            {m.sender?.role || 'user'}
                          </Badge>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                      {m.attachment_path && (
                        <div className="mt-2 text-[11px] text-sky-400">
                          Attachment: {m.attachment_path.split('/').pop()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Workflow Status Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
            {userIsStaff && query.status !== 'resolved' && (
              <>
                {query.status !== 'under_review' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleUnderReview}
                    disabled={updateStatus.isPending}
                    className="text-xs h-8 gap-1.5 cursor-pointer"
                  >
                    <Clock size={13} />
                    Mark Under Review
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleResolve}
                  disabled={updateStatus.isPending}
                  className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  <CheckCircle2 size={13} />
                  Mark Resolved
                </Button>
              </>
            )}

            {!userIsStaff && query.status === 'resolved' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleReopen}
                disabled={updateStatus.isPending}
                className="text-xs h-8 gap-1.5 text-amber-400 border-amber-400/30 hover:bg-amber-400/10 cursor-pointer"
              >
                <RotateCcw size={13} />
                Not Resolved? Reopen Query
              </Button>
            )}
          </div>

          {/* Reply Box */}
          <form onSubmit={handleSendReply} className="space-y-2 pt-1">
            <textarea
              rows={2}
              required
              placeholder={userIsStaff ? 'Type your response to the citizen…' : 'Type your message or follow-up…'}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full p-2.5 border border-white/10 rounded-md text-xs bg-[#121212] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#38bdf8]"
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={sendMessage.isPending || !replyText.trim()}
                className="gap-1.5 cursor-pointer"
              >
                <Send size={13} />
                {sendMessage.isPending ? 'Sending…' : 'Send Reply'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}
