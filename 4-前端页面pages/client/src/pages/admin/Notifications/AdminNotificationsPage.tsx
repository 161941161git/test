import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCheck } from 'lucide-react';
import { clsx } from 'clsx';

import { EmptyState } from '@client/src/components/EmptyState';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { admin } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { timeAgo } from '@client/src/utils/format';
import type { Notification } from '@shared/api.interface';

const AdminNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await admin.notifications({ pageSize: 100 });
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
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

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
    if (unreadCount === 0) return;
    try {
      const resp = await admin.markAllNotificationsRead();
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
    if (!notif.isRead) {
      try {
        await admin.markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }

    if (!notif.relatedType) return;

    switch (notif.relatedType) {
      case 'order':
        navigate('/admin/orders');
        break;
      case 'withdraw':
        navigate('/admin/withdraws');
        break;
      case 'refund':
        navigate('/admin/refunds');
        break;
      case 'runner-application':
        navigate('/admin/runner-reviews');
        break;
      case 'settlement':
        navigate(`/admin/settlements/${notif.relatedId}`);
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部操作栏 */}
      <div className="px-4 pt-3 pb-2 bg-background sticky top-0 z-10 border-b border-border/50 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">全部消息</span>
        <button
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          className={clsx(
            'text-xs font-medium btn-press flex items-center gap-1',
            unreadCount === 0 ? 'text-muted-foreground' : 'text-primary',
          )}
        >
          <CheckCheck className="w-4 h-4" strokeWidth={2} />
          全部已读
        </button>
      </div>

      {/* 列表 */}
      <div className="flex-1 p-4">
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
                  !notif.isRead && 'bg-destructive/5 border-destructive/20',
                )}
                aria-label={`查看通知：${notif.title}`}
              >
                <div className="flex items-start gap-3">
                  {!notif.isRead && (
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
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
    </div>
  );
};

export default AdminNotificationsPage;
