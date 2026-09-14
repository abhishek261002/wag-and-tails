import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PageHeader, Badge, Button, useToast } from '@wag/ui-web';
import { wagApi, resolveMediaUrl } from '../lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import type { SupportTicket, SupportMessage } from '@wag/api-client';

const STATUS_VARIANT: Record<string, any> = { open: 'warn', in_progress: 'accent', resolved: 'ok' };

// Only escalated tickets show up here — staff keep working every ticket
// themselves (see staff-web's SupportPage), this is purely the admin
// team's visibility into the ones staff couldn't resolve alone.
export default function SupportPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(() => {
    wagApi.support.listTickets({ escalated: true }).then(setTickets).catch(() => {});
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const loadMessages = useCallback((ticketId: string) => {
    wagApi.support.getMessages(ticketId).then((msgs) => setMessages([...msgs].reverse())).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);

    wagApi.realtime.connect();
    wagApi.realtime.joinSupportTicket(selected.id);
    const off = wagApi.realtime.on('support:message_sent', (payload: any) => {
      if (payload.ticketId !== selected.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.messageId)) return prev;
        return [...prev, payload];
      });
    });

    return () => {
      off();
      wagApi.realtime.disconnect();
    };
  }, [selected, loadMessages]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const content = reply.trim();
    setReply('');
    try {
      await wagApi.support.sendMessage(selected.id, { content });
      loadMessages(selected.id);
    } catch (err: any) {
      toast({ type: 'error', title: 'Could not send reply', message: err?.message });
      setReply(content);
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!selected) return;
    try {
      const updated = await wagApi.support.updateStatus(selected.id, 'resolved');
      setSelected(updated);
      loadTickets();
      toast({ type: 'success', title: 'Ticket marked resolved' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Could not update ticket', message: err?.message });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Escalated support" sub="Tickets staff have flagged as beyond what they can resolve alone" />

      <div className="flex gap-5 flex-1 min-h-0 p-7">
        <div className="w-[340px] shrink-0 flex flex-col bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {tickets.length === 0 ? (
              <div className="p-6 text-center text-[#9E7B6A] text-sm">No escalated tickets right now</div>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`w-full text-left px-4 py-3 border-b border-[#F5EDE3] hover:bg-[#FBF7F2] transition-colors ${selected?.id === t.id ? 'bg-[#FFF3E9]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[#1A0A03] truncate">{t.subject}</span>
                    <Badge variant={STATUS_VARIANT[t.status] ?? 'default'}>{t.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="text-xs text-[#9E7B6A] mt-1">
                    {t.user?.profile ? `${t.user.profile.firstName} ${t.user.profile.lastName}` : 'User'} · escalated {t.escalatedAt ? formatDistanceToNow(new Date(t.escalatedAt), { addSuffix: true }) : ''}
                  </div>
                  {t.escalatedReason && (
                    <div className="text-xs text-[#B3261E] mt-1 line-clamp-2">{t.escalatedReason}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-[#9E7B6A] text-sm">Select an escalated ticket to view the conversation</div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-[#E8D8CC] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[#1A0A03] truncate">{selected.subject}</div>
                  <div className="text-xs text-[#9E7B6A] mt-0.5">
                    {selected.user?.profile ? `${selected.user.profile.firstName} ${selected.user.profile.lastName}` : 'User'} · {selected.user?.phone}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_VARIANT[selected.status] ?? 'default'}>{selected.status.replace(/_/g, ' ')}</Badge>
                  {selected.status !== 'resolved' && <Button compact onClick={handleResolve}>Mark resolved</Button>}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 bg-[#FBF7F2] space-y-3">
                <div className="bg-white border border-[#E8D8CC] rounded-xl p-3 text-sm text-[#1A0A03]">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[#9E7B6A] mb-1">Original message</div>
                  {selected.description}
                </div>
                {messages.map((m) => {
                  if (m.senderRole === 'system') {
                    return <div key={m.id} className="text-center text-xs text-[#9E7B6A] italic">{m.content}</div>;
                  }
                  const isStaff = m.senderRole === 'staff' || m.senderRole === 'admin';
                  return (
                    <div key={m.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm ${isStaff ? 'bg-[#4A1E0B] text-white rounded-br-sm' : 'bg-white border border-[#E8D8CC] text-[#1A0A03] rounded-bl-sm'}`}>
                        {!isStaff && <div className="text-xs font-bold opacity-70 mb-1">{m.senderName}</div>}
                        {m.attachmentType === 'image' && m.attachmentUrl ? (
                          <img src={resolveMediaUrl(m.attachmentUrl)} alt="" className="rounded-lg max-w-full" />
                        ) : (
                          <div>{m.content}</div>
                        )}
                        <div className={`text-[10px] mt-1 text-right ${isStaff ? 'text-white/60' : 'text-[#9E7B6A]'}`}>
                          {format(new Date(m.sentAt), 'h:mm a')}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={listEndRef} />
              </div>

              <div className="p-4 border-t border-[#E8D8CC] flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  placeholder="Type a reply…"
                  className="flex-1 border border-[#E8D8CC] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
                />
                <Button onClick={sendReply} loading={sending} disabled={!reply.trim()}>Send</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
