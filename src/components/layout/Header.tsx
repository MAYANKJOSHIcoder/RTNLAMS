import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Clock, FileText, Gavel, Menu, MessageSquare, Wallet, CheckCheck } from 'lucide-react';
import ServiceHealth from './ServiceHealth';
import UserMenu from './UserMenu';
import {
  useNotifications,
  useUnreadNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../hooks/useNotifications';
import { timeAgo } from '../../lib/utils/helpers';
import { notificationTarget } from '../../lib/queries';
import type { NotificationItem } from '../../lib/types';

const crumbs: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/parcels': 'Parcels',
  '/documents': 'Documents',
  '/hearings': 'Hearings',
  '/compensation': 'Compensation',
  '/audit': 'Audit',
  '/queries': 'Raised Queries',
};

const TYPE_ICONS: Record<string, typeof Bell> = {
  query_created: MessageSquare,
  query_reply: MessageSquare,
  query_resolved: MessageSquare,
  query_reopened: MessageSquare,
  document: FileText,
  stage: Clock,
  payment: Wallet,
  hearing: Gavel,
};


export default function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const current = crumbs[location.pathname] ?? '';

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleNotificationClick = async (item: NotificationItem) => {
    setOpen(false);
    if (!item.is_read) {
      await markRead.mutateAsync(item.id);
    }
    const target = notificationTarget(item);
    if (target) navigate(target);
  };

  return (
    <>
      <header className="h-14 bg-black text-white flex items-center justify-between px-4 border-b border-white/10 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          {onMenuToggle && (
            <button onClick={onMenuToggle} className="lg:hidden p-2 hover:bg-white/10 rounded-md cursor-pointer" aria-label="Toggle sidebar">
              <Menu size={18} />
            </button>
          )}
          <Link to="/" className="font-semibold tracking-tight text-sm md:text-base truncate">
            NLAMS
          </Link>
          {current && (
            <>
              <span className="text-slate-500 hidden sm:inline">/</span>
              <span className="text-sm text-slate-300 hidden sm:inline truncate">{current}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ServiceHealth />

          <div className="relative" ref={bellRef}>
            <button
              aria-label={`Notifications ${unreadCount} unread`}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="relative p-2 hover:bg-white/10 rounded-md cursor-pointer transition-colors"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-black">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {open && (
              <div
                className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-[#0c0c0c] border border-white/15 rounded-lg shadow-xl py-1 z-50 divide-y divide-white/5"
                role="menu"
                aria-label="Notifications"
              >
                <div className="px-3 py-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-500">
                    No notifications
                  </div>
                ) : (
                  notifications.map((item) => {
                    const Icon = TYPE_ICONS[item.type] || Bell;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        role="menuitem"
                        className={`w-full text-left px-3 py-2.5 hover:bg-white/[0.04] flex items-start gap-2.5 cursor-pointer transition-colors ${
                          item.is_read ? 'opacity-70' : 'bg-white/[0.02]'
                        }`}
                      >
                        <Icon size={14} className={`mt-0.5 shrink-0 ${item.is_read ? 'text-slate-500' : 'text-sky-400'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-1">
                            <span className={`block text-xs truncate ${item.is_read ? 'text-slate-300 font-normal' : 'text-white font-semibold'}`}>
                              {item.title}
                            </span>
                            {!item.is_read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                            )}
                          </span>
                          <span className="block text-xs text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                            {item.message}
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-1">
                            {timeAgo(item.created_at)}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <UserMenu />
        </div>
      </header>
    </>
  );
}
