import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, ChevronLeft, CheckCheck } from 'lucide-react';
import { clsx } from 'clsx';

import { MobileLayout } from '@client/src/components/MobileLayout';
import { EmptyState } from '@client/src/components/EmptyState';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { useUser } from '@client/src/store/userStore';
import { users } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { timeAgo } from '@client/src/utils/format';
import type { Notification } from '@shared/api.interface';

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const resp = await users.notifications(user.id, { pageSize: 100 });
      if (resp.success) {
        setNotifications(resp.data.items);
        setUnreadCount(resp.data.unreadCount);
      } else {
        toast.error(resp.message || '加载通知失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    void loadNotifications();
  }, [user, navigate, loadNotifications]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const resp = await users.markAllNotificationsRead(user.id);
      if (resp.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true })),
        );
        setUnreadCount(0);
        toast.success('已全部标为已读');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败'));
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!user) return;
    if (!notif.isRead) {
      try {
        await users.markNotificationRead(user.id, notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }

    if (!notif.relatedType || !notif.relatedId) return;

    switch (notif.relatedType) {
      case 'order':
        navigate(`/order/${notif.relatedId}`);
        break;
      case 'withdraw':
        navigate('/withdraw');
        break;
      case 'runner-application':
        navigate('/profile');
        break;
      default:
        break;
    }
  };

  const rightAction = (
    <button
      onClick={handleMarkAllRead}
      disabled={unreadCount === 0}
      className={clsx(
        'text-sm font-medium btn-press flex items-center gap-1',
        unreadCount === 0 ? 'text-muted-foreground' : 'text-primary',
      )}
      aria-label="全部已读"
    >
      <CheckCheck className="w-4 h-4" strokeWidth={2} />
      全部已读
    </button>
  );

  return (
    <MobileLayout title="消息通知" showBack rightAction={rightAction}>
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-4 space-y-2"
              >
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="file"
            title="暂无通知"
            description="有新消息会第一时间通知你～"
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={clsx(
                  'w-full text-left bg-card rounded-xl border border-border p-4 shadow-sm btn-press transition-colors',
                  !notif.isRead && 'bg-primary/5 border-primary/20',
                )}
                aria-label={`查看通知：${notif.title}`}
              >
                <div className="flex items-start gap-3">
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3
                        className={clsx(
                          'text-sm truncate',
                          notif.isRead
                            ? 'text-foreground font-medium'
                            : 'text-foreground font-semibold',
                        )}
                      >
                        {notif.title}
                      </h3>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {notif.content}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default NotificationsPage;
