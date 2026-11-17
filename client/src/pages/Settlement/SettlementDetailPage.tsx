import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { Send, Image as ImageIcon, X } from 'lucide-react';
import { getDataloom } from '@client/src/lib/shims/dataloom';
import { getDefaultBucketId } from '@client/src/lib/shims/storage';
import { MobileLayout } from '@client/src/components/MobileLayout';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { Image } from '@client/src/components/ui/image';
import { settlement } from '@client/src/api/modules';
import { useUser } from '@client/src/store/userStore';
import { formatDate } from '@client/src/utils/format';
import {
  SETTLEMENT_SESSION_STATUS_LABELS,
  type SettlementSession,
  type SettlementMessage,
  type MessageType,
} from '@shared/api.interface';

const formatFen = (fen: number): string => {
  return `¥${(fen / 100).toFixed(2)}`;
};

const POLL_INTERVAL_MS = 5000;

const SettlementDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [session, setSession] = useState<SettlementSession | null>(null);
  const [messages, setMessages] = useState<SettlementMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const optimisticIdsRef = useRef<Set<string>>(new Set());

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    
    let scrollContainer: HTMLElement | null = el;
    while (scrollContainer) {
      const overflowY = window.getComputedStyle(scrollContainer).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        break;
      }
      scrollContainer = scrollContainer.parentElement;
    }
    
    if (scrollContainer) {
      requestAnimationFrame(() => {
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 键盘适配：监听 visualViewport resize
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      scrollToBottom();
    };

    vv.addEventListener('resize', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
    };
  }, [scrollToBottom]);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [sessionRes, messagesRes] = await Promise.all([
        settlement.getSession(id, user?.id ?? ''),
        settlement.getMessages(id, user?.id ?? ''),
      ]);
      if (sessionRes.success) {
        setSession(sessionRes.data);
      } else {
        toast.error(sessionRes.message || '获取会话详情失败');
      }
      if (messagesRes.success) {
        const existing = messagesRes.data || [];
        // 过滤掉已存在的乐观消息（按 temp- 前缀保留本地的）
        setMessages((prev) => {
          const optimistic = prev.filter((m) =>
            optimisticIdsRef.current.has(m.id),
          );
          return [...existing, ...optimistic];
        });
      } else {
        toast.error(messagesRes.message || '获取消息失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      const msg = err.response?.data?.error?.message || '加载失败，请重试';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 5秒轮询新消息
  useEffect(() => {
    if (loading || error || !id) return;
    const timer = window.setInterval(() => {
      void loadData();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loading, error, id, loadData]);

  const sendTextMessage = async () => {
    if (!id || !inputValue.trim() || sending) return;
    const content = inputValue.trim();
    const tempId = `temp-${Date.now()}`;

    // 乐观消息
    const optimisticMsg: SettlementMessage = {
      id: tempId,
      sessionId: id,
      senderRole: 'runner',
      msgType: 'text' as MessageType,
      content,
      imageUrl: '',
      isSystem: false,
      createdAt: new Date().toISOString(),
    };
    optimisticIdsRef.current.add(tempId);
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputValue('');
    setSending(true);

    try {
      const res = await settlement.sendMessage(id, {
        msgType: 'text' as MessageType,
        content,
        userId: user?.id ?? '',
      });
      if (res.success) {
        // 替换乐观消息
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.data : m)),
        );
        optimisticIdsRef.current.delete(tempId);
      } else {
        throw new Error(res.message || '发送失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      const msg =
        err.response?.data?.error?.message || '发送失败，请重试';
      toast.error(msg);
      // 失败时恢复输入内容，保留乐观消息方便用户看到
      setInputValue(content);
      // 移除乐观消息（用户看到内容已回到输入框）
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      optimisticIdsRef.current.delete(tempId);
    } finally {
      setSending(false);
    }
  };

  const uploadAndSendImage = async (file: File) => {
    if (!id) return;
    const tempId = `temp-img-${Date.now()}`;
    const localUrl = URL.createObjectURL(file);

    // 乐观图片消息
    const optimisticMsg: SettlementMessage = {
      id: tempId,
      sessionId: id,
      senderRole: 'runner',
      msgType: 'image' as MessageType,
      content: '',
      imageUrl: localUrl,
      isSystem: false,
      createdAt: new Date().toISOString(),
    };
    optimisticIdsRef.current.add(tempId);
    setMessages((prev) => [...prev, optimisticMsg]);
    setUploading(true);

    try {
      const dataloom = await getDataloom();
      const { data, error: uploadError } = await dataloom.storage
        .from(getDefaultBucketId())
        .uploadFile(file);
      if (uploadError) throw uploadError;
      if (!data) throw new Error('上传失败');
      const downloadUrl = data.download_url || '';

      const res = await settlement.sendMessage(id, {
        msgType: 'image' as MessageType,
        content: '',
        imageUrl: downloadUrl,
        userId: user?.id ?? '',
      });
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.data : m)),
        );
        optimisticIdsRef.current.delete(tempId);
        toast.success('图片已发送');
      } else {
        throw new Error(res.message || '发送失败');
      }
    } catch (e) {
      const err = e as {
        message?: string;
        response?: { data?: { error?: { message?: string } } };
      };
      const msg =
        err.response?.data?.error?.message ||
        err.message ||
        '发送失败，请重试';
      toast.error(msg);
      // 移除乐观消息
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      optimisticIdsRef.current.delete(tempId);
    } finally {
      URL.revokeObjectURL(localUrl);
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

  const renderMessage = (msg: SettlementMessage) => {
    const isOptimistic = optimisticIdsRef.current.has(msg.id);
    const isSystem = msg.isSystem || msg.senderRole === 'system';
    const isRunner = msg.senderRole === 'runner';
    const isPlatform = msg.senderRole === 'platform';

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center">
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {msg.content}
          </span>
        </div>
      );
    }

    const isSelf = isRunner;
    const alignClass = isSelf ? 'items-end' : 'items-start';

    return (
      <div
        key={msg.id}
        className={clsx('flex flex-col gap-1', alignClass, isOptimistic && 'opacity-60')}
      >
        {msg.msgType === 'image' ? (
          <div
            className={clsx(
              'relative max-w-[200px] rounded-lg overflow-hidden cursor-pointer',
              isSelf ? 'rounded-br-sm bg-primary/10' : 'rounded-bl-sm bg-secondary',
            )}
            onClick={() => msg.imageUrl && setPreviewImage(msg.imageUrl)}
          >
            <Image
              src={msg.imageUrl}
              alt="结算图片"
              className="w-full h-auto block"
            />
          </div>
        ) : (
          <div
            className={clsx(
              'max-w-[75%] px-3 py-2 text-sm rounded-lg break-words',
              isSelf
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : isPlatform
                  ? 'bg-secondary text-secondary-foreground rounded-bl-sm'
                  : 'bg-muted text-foreground rounded-bl-sm',
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
          {isOptimistic ? '发送中...' : formatDate(msg.createdAt)}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <MobileLayout title="结算详情" showBack showTabBar={false}>
        <div className="p-4 space-y-4">
          <div className="bg-card rounded-xl border border-border p-4 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-start">
                <Skeleton className="h-10 w-40 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error) {
    return (
      <MobileLayout title="结算详情" showBack showTabBar={false}>
        <div className="p-4">
          <Empty className="bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <X />
              </EmptyMedia>
              <EmptyTitle>加载失败</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <button
                type="button"
                onClick={() => void loadData()}
                className="text-primary text-sm font-medium"
              >
                点击重试
              </button>
            </EmptyContent>
          </Empty>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout
      title={`与平台结算 · ${session?.orderNo || ''}`}
      showBack
      showTabBar={false}
      noScroll
    >
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-md mx-auto">
        {/* 会话信息区 */}
        {session && (
          <div className="bg-card border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  订单号：{session.orderNo}
                </p>
                <p className="text-lg font-bold text-primary tnum">
                  {formatFen(session.runnerAmountFen)}
                  <span className="text-[11px] font-normal text-muted-foreground ml-1">
                    跑腿费
                  </span>
                </p>
              </div>
              <span
                className={clsx(
                  'px-2.5 py-1 text-xs font-medium rounded-full',
                  session.status === 'pending_payment' &&
                    'bg-blue-100 text-blue-700',
                  session.status === 'pending_settle' &&
                    'bg-blue-200 text-blue-800',
                  session.status === 'paid' && 'bg-blue-600 text-white',
                  session.status === 'refunded' &&
                    'bg-gray-200 text-gray-600',
                )}
              >
                {SETTLEMENT_SESSION_STATUS_LABELS[session.status]}
              </span>
            </div>
          </div>
        )}

        {/* 消息区 */}
        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-muted/30"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full py-8">
              <p className="text-xs text-muted-foreground">
                暂无消息，上传收款码开始结算
              </p>
            </div>
          ) : (
            messages.map((msg) => renderMessage(msg))
          )}
        </div>

        {/* 底部输入区 */}
        <div
          className="shrink-0 z-10 p-3 border-t border-border bg-card safe-bottom"
        >
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center btn-press',
                uploading
                  ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
              aria-label="发送图片"
              disabled={uploading || sending}
              title="上传收款码"
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
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="flex-1 h-9 px-3 rounded-lg border border-input bg-transparent text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              disabled={uploading || sending}
            />
            <button
              type="button"
              onClick={() => void sendTextMessage()}
              disabled={!inputValue.trim() || sending || uploading}
              className={clsx(
                'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center btn-press',
                !inputValue.trim() || sending || uploading
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

      {/* 图片预览 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <Image
            src={previewImage}
            alt="图片预览"
            className="max-w-full max-h-full"
          />
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={() => setPreviewImage(null)}
            aria-label="关闭预览"
          >
            <X className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>
      )}
    </MobileLayout>
  );
};

export default SettlementDetailPage;
