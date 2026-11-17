import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  Send,
  Image as ImageIcon,
  X as XIcon,
  MessageSquare,
  UserRound,
} from 'lucide-react';
import { getDataloom } from '@client/src/lib/shims/dataloom';
import { getDefaultBucketId } from '@client/src/lib/shims/storage';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogClose,
} from '@client/src/components/ui/dialog';
import Image from '@client/src/components/ui/image';
import { admin } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatDate, timeAgo } from '@client/src/utils/format';
import type {
  SupportSession,
  SupportMessage,
  SupportSessionType,
} from '@shared/api.interface';

type FilterTab = 'all' | 'buyer_platform' | 'runner_platform';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'buyer_platform', label: '买家' },
  { key: 'runner_platform', label: '接单员' },
];

const SESSION_TYPE_LABELS: Record<SupportSessionType, string> = {
  buyer_platform: '买家',
  runner_platform: '接单员',
};

function getInitial(name: string): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

const AdminSupportListPage: React.FC = () => {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState<boolean>(false);
  const [closeSubmitting, setCloseSubmitting] = useState<boolean>(false);
  const [closeRemark, setCloseRemark] = useState<string>('');
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedSession = sessions.find((s) => s.id === selectedId) || null;

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const params: { sessionType?: string; page?: number; pageSize?: number } = {
        page: 1,
        pageSize: 50,
      };
      if (filter !== 'all') {
        params.sessionType = filter;
      }
      const res = await admin.support.list(params);
      if (res.success) {
        setSessions(res.data.items || []);
      } else {
        toast.error(res.message || '加载会话列表失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请重试'));
    } finally {
      setSessionsLoading(false);
    }
  }, [filter]);

  // 加载消息 + 标记已读
  const loadMessages = useCallback(
    async (sessionId: string) => {
      setMessagesLoading(true);
      try {
        const res = await admin.support.getMessages(sessionId);
        if (res.success) {
          setMessages(res.data || []);
        } else {
          toast.error(res.message || '获取消息失败');
        }
        // 标记已读（静默）
        void admin.support.markRead(sessionId).catch(() => {});
        // 同步更新本地列表的未读数
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, unreadAdminCount: 0 } : s,
          ),
        );
      } catch (err) {
        toast.error(getApiErrorMessage(err, '获取消息失败'));
      } finally {
        setMessagesLoading(false);
      }
    },
    [],
  );

  // 初次加载
  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // 选中会话时加载消息
  useEffect(() => {
    if (selectedId) {
      setMessages([]);
      void loadMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [selectedId, loadMessages]);

  // 15s 轮询会话列表
  useEffect(() => {
    pollTimerRef.current = setInterval(() => {
      void loadSessions();
    }, 15000);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [loadSessions]);

  const handleSelectSession = (session: SupportSession) => {
    setSelectedId(session.id);
  };

  const sendTextMessage = async () => {
    if (!selectedId || !inputValue.trim() || sending) return;
    setSending(true);
    try {
      const res = await admin.support.sendMessage(selectedId, {
        msgType: 'text',
        content: inputValue.trim(),
      });
      if (res.success) {
        setMessages((prev) => [...prev, res.data]);
        setInputValue('');
        // 更新列表最后消息
        setSessions((prev) =>
          prev.map((s) =>
            s.id === selectedId
              ? {
                  ...s,
                  lastMessage: res.data.content,
                  lastMessageAt: res.data.createdAt,
                }
              : s,
          ),
        );
      } else {
        toast.error(res.message || '发送失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '发送失败'));
    } finally {
      setSending(false);
    }
  };

  const uploadAndSendImage = async (file: File) => {
    if (!selectedId) return;
    setUploading(true);
    try {
      const dataloom = await getDataloom();
      const { data, error: uploadError } = await dataloom.storage
        .from(getDefaultBucketId())
        .uploadFile(file);
      if (uploadError) throw uploadError;
      if (!data) throw new Error('上传失败');
      const downloadUrl = data.download_url || '';

      const res = await admin.support.sendMessage(selectedId, {
        msgType: 'image',
        imageUrl: downloadUrl,
        content: '[图片]',
      });
      if (res.success) {
        setMessages((prev) => [...prev, res.data]);
        toast.success('图片已发送');
      } else {
        toast.error(res.message || '发送失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '上传失败'));
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void uploadAndSendImage(file);
    }
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendTextMessage();
    }
  };

  const handleCloseSession = async () => {
    if (!selectedId || closeSubmitting) return;
    setCloseSubmitting(true);
    try {
      const res = await admin.support.closeSession(
        selectedId,
        closeRemark.trim() || undefined,
      );
      if (res.success) {
        toast.success('会话已结束');
        setCloseOpen(false);
        setCloseRemark('');
        // 刷新列表
        await loadSessions();
        // 追加系统消息
        const systemMsg: SupportMessage = {
          id: `sys-${Date.now()}`,
          sessionId: selectedId,
          senderRole: 'system',
          senderId: null,
          senderName: '系统',
          msgType: 'text',
          content: '会话已被平台结束',
          imageUrl: '',
          isSystem: true,
          relatedOrderId: null,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMsg]);
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setCloseSubmitting(false);
    }
  };

  const renderMessage = (msg: SupportMessage) => {
    const isSystem = msg.isSystem || msg.senderRole === 'system';
    // 后台视角：平台自己靠右，用户靠左
    const isSelf = msg.senderRole === 'platform';

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center">
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {msg.content}
          </span>
        </div>
      );
    }

    const alignClass = isSelf ? 'items-end ml-auto' : 'items-start';

    return (
      <div
        key={msg.id}
        className={clsx('flex flex-col gap-1 max-w-[75%]', alignClass)}
      >
        {msg.msgType === 'image' && msg.imageUrl ? (
          <div
            className={clsx(
              'relative max-w-[200px] rounded-lg overflow-hidden cursor-pointer',
              isSelf ? 'rounded-br-sm bg-primary/10' : 'rounded-bl-sm bg-secondary',
            )}
            onClick={() => setPreviewImage(msg.imageUrl)}
          >
            <Image
              src={msg.imageUrl}
              alt="图片消息"
              className="w-full h-auto block"
            />
          </div>
        ) : (
          <div
            className={clsx(
              'px-3 py-2 text-sm rounded-lg break-words',
              isSelf
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-secondary text-secondary-foreground rounded-bl-sm',
            )}
          >
            {msg.content}
          </div>
        )}
        <span
          className={clsx(
            'text-[10px] text-muted-foreground',
            isSelf ? 'text-right' : 'text-left',
          )}
        >
          {formatDate(msg.createdAt)}
        </span>
      </div>
    );
  };

  const totalUnread = sessions.reduce(
    (sum, s) => sum + (s.unreadAdminCount || 0),
    0,
  );

  return (
    <div className="flex h-[calc(100vh-96px)] min-h-0 bg-background">
      {/* 左侧会话列表 */}
      <div
        className="flex flex-col border-r border-border bg-card"
        style={{ width: 320, minWidth: 320 }}
      >
        {/* 顶部标题 + tab */}
        <div className="px-3 pt-3 pb-2 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-primary" strokeWidth={2} />
            <h2 className="text-sm font-semibold text-foreground">
              消息中心
            </h2>
            {totalUnread > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[12px] font-bold flex items-center justify-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={clsx(
                  'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
                  filter === tab.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto">
          {sessionsLoading ? (
            <div className="p-2 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg"
                >
                  <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-4">
              <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">暂无会话</p>
            </div>
          ) : (
            sessions.map((session) => {
              const isSelected = session.id === selectedId;
              const isBuyer = session.sessionType === 'buyer_platform';
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => handleSelectSession(session)}
                  className={clsx(
                    'w-full text-left relative px-3 py-3 flex items-center gap-3 border-l-2 transition-colors',
                    isSelected
                      ? 'border-l-primary bg-primary/5'
                      : 'border-l-transparent hover:bg-muted/40',
                  )}
                >
                  {/* 头像 */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={clsx(
                        'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm',
                        isBuyer
                          ? 'bg-gradient-to-br from-blue-400 to-blue-600'
                          : 'bg-gradient-to-br from-emerald-400 to-emerald-600',
                      )}
                    >
                      {getInitial(session.userName)}
                    </div>
                    {session.unreadAdminCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center border-2 border-card">
                        {session.unreadAdminCount > 99
                          ? '99+'
                          : session.unreadAdminCount}
                      </span>
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {session.userName}
                      </span>
                      <span
                        className={clsx(
                          'flex-shrink-0 px-1.5 py-px text-[10px] font-medium rounded',
                          isBuyer
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-emerald-50 text-emerald-600',
                        )}
                      >
                        {SESSION_TYPE_LABELS[session.sessionType]}
                      </span>
                      {session.status === 'closed' && (
                        <span className="flex-shrink-0 px-1.5 py-px text-[10px] font-medium rounded bg-gray-100 text-gray-500">
                          已结束
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.lastMessage || '暂无消息'}
                    </p>
                  </div>

                  {/* 时间 */}
                  <div className="flex-shrink-0 text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                    {session.lastMessageAt
                      ? timeAgo(session.lastMessageAt)
                      : ''}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 右侧聊天区 */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {!selectedSession ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <UserRound className="w-14 h-14 mb-3 opacity-20" strokeWidth={1.5} />
            <p className="text-sm">选择一个会话开始聊天</p>
          </div>
        ) : (
          <>
            {/* 顶部栏 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground truncate">
                    {selectedSession.userName}
                  </h2>
                  <span
                    className={clsx(
                      'px-1.5 py-px text-[10px] font-medium rounded',
                      selectedSession.sessionType === 'buyer_platform'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-emerald-50 text-emerald-600',
                    )}
                  >
                    {SESSION_TYPE_LABELS[selectedSession.sessionType]}
                  </span>
                  {selectedSession.status === 'closed' && (
                    <span className="px-1.5 py-px text-[10px] font-medium rounded bg-gray-100 text-gray-500">
                      已结束
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(selectedSession.createdAt)} 建立会话
                </p>
              </div>
              {selectedSession.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCloseRemark('');
                    setCloseOpen(true);
                  }}
                >
                  结束会话
                </Button>
              )}
            </div>

            {/* 消息流 */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30"
            >
              {messagesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'flex',
                        i % 2 === 0 ? 'justify-start' : 'justify-end',
                      )}
                    >
                      <Skeleton
                        className={clsx(
                          'h-10 rounded-lg',
                          i % 2 === 0 ? 'w-40' : 'w-32',
                        )}
                      />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full py-8">
                  <p className="text-xs text-muted-foreground">暂无消息</p>
                </div>
              ) : (
                messages.map((msg) => renderMessage(msg))
              )}
            </div>

            {/* 底部输入区 */}
            <div className="border-t border-border bg-card safe-bottom">
              <div className="p-3">
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={clsx(
                      'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                      uploading || sending || selectedSession.status !== 'active'
                        ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                    )}
                    aria-label="发送图片"
                    disabled={
                      uploading ||
                      sending ||
                      selectedSession.status !== 'active'
                    }
                  >
                    <ImageIcon className="w-5 h-5" strokeWidth={2} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      selectedSession.status === 'active'
                        ? '输入消息...'
                        : '会话已结束，无法发送消息'
                    }
                    className="flex-1 h-9"
                    disabled={
                      uploading ||
                      sending ||
                      selectedSession.status !== 'active'
                    }
                  />
                  <button
                    type="button"
                    onClick={() => void sendTextMessage()}
                    disabled={
                      !inputValue.trim() ||
                      sending ||
                      uploading ||
                      selectedSession.status !== 'active'
                    }
                    className={clsx(
                      'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                      !inputValue.trim() ||
                        sending ||
                        uploading ||
                        selectedSession.status !== 'active'
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90',
                    )}
                    aria-label="发送"
                  >
                    <Send className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 图片预览弹窗 */}
      <Dialog
        open={previewImage !== null}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      >
        <DialogContent className="max-w-sm p-2" showCloseButton={false}>
          <DialogClose
            className="absolute top-3 right-3 z-10 p-1 rounded-full bg-black/40 text-white hover:bg-black/60"
            aria-label="关闭"
          >
            <XIcon className="w-4 h-4" />
          </DialogClose>
          {previewImage && (
            <Image
              src={previewImage}
              alt="图片预览"
              className="w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 结束会话确认弹窗 */}
      <AlertDialog
        open={closeOpen}
        onOpenChange={(open) => {
          if (!open && !closeSubmitting) {
            setCloseOpen(false);
            setCloseRemark('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>确认结束会话？</AlertDialogTitle>
          <AlertDialogDescription>
            结束后对方将无法继续发送消息，此操作不可撤销。
          </AlertDialogDescription>
          <div className="space-y-1.5 pt-2">
            <label className="text-sm font-medium text-foreground">
              结束原因
            </label>
            <Input
              value={closeRemark}
              onChange={(e) => setCloseRemark(e.target.value)}
              placeholder="选填"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closeSubmitting}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleCloseSession();
              }}
            >
              确认结束
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSupportListPage;
