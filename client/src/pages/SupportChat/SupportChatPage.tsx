import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { Send, Image as ImageIcon, Loader2 } from 'lucide-react';
import { getDataloom } from '@client/src/lib/shims/dataloom';
import { getDefaultBucketId } from '@client/src/lib/shims/storage';
import { logger } from '@client/src/lib/shims/logger';
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
import { support, type SupportMessage } from '@client/src/api/modules';
import { useUser } from '@client/src/store/userStore';
import { formatDate } from '@client/src/utils/format';

type OptimisticMessage = SupportMessage & {
  optimisticId?: string;
  pending?: boolean;
};

const SupportChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<number | null>(null);
  const optCounterRef = useRef<number>(0);

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

  // visualViewport 键盘适配
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      requestAnimationFrame(() => scrollToBottom());
    };

    vv.addEventListener('resize', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
    };
  }, [scrollToBottom]);

  const loadMessages = useCallback(async () => {
    if (!id || !user?.id) return;
    try {
      const res = await support.getMessages(id, user.id);
      if (res.success) {
        setMessages((prev) => {
          const serverMsgs = res.data || [];
          // 保留还在发送中的乐观消息
          const pending = prev.filter((m) => m.pending);
          const next = [...serverMsgs, ...pending];
          if (next.length !== prev.length) return next;
          const hasNew = next.some(
            (m, i) => !prev[i] || m.id !== prev[i].id,
          );
          return hasNew ? next : prev;
        });
      }
    } catch (e) {
      // 轮询错误静默处理
    }
  }, [id, user?.id]);

  const loadInitial = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await support.getMessages(id, user?.id ?? '');
      if (res.success) {
        setMessages(res.data || []);
      } else {
        setError(res.message || '加载消息失败');
        toast.error(res.message || '加载消息失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      const msg = err.response?.data?.error?.message || '加载失败，请重试';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (loading || error) return;
    pollRef.current = window.setInterval(() => {
      void loadMessages();
    }, 5000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [loading, error, loadMessages]);

  const sendTextMessage = async () => {
    if (!id || !inputValue.trim() || sending || uploading || !user?.id) return;
    const text = inputValue.trim();

    // 生成乐观消息
    optCounterRef.current += 1;
    const optId = `opt-${Date.now()}-${optCounterRef.current}`;
    const optMsg: OptimisticMessage = {
      id: optId,
      optimisticId: optId,
      sessionId: id,
      senderRole: 'user',
      senderId: user.id,
      msgType: 'text',
      content: text,
      imageUrl: '',
      isSystem: false,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setSending(true);
    setInputValue('');
    setMessages((prev) => [...prev, optMsg]);

    try {
      const res = await support.sendMessage(id, user.id, 'text', text, undefined);
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.optimisticId === optId ? { ...res.data, pending: false } : m,
          ),
        );
      } else {
        toast.error(res.message || '发送失败');
        // 失败保留输入内容
        setInputValue(text);
        // 移除乐观消息
        setMessages((prev) => prev.filter((m) => m.optimisticId !== optId));
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      const msg = err.response?.data?.error?.message || '发送失败，请重试';
      toast.error(msg);
      setInputValue(text);
      setMessages((prev) => prev.filter((m) => m.optimisticId !== optId));
    } finally {
      setSending(false);
    }
  };

  const uploadAndSendImage = async (file: File) => {
    if (!id || !user?.id) return;
    setUploading(true);

    // 生成本地预览 URL 作为乐观图片
    const localUrl = URL.createObjectURL(file);
    optCounterRef.current += 1;
    const optId = `opt-img-${Date.now()}-${optCounterRef.current}`;
    const optMsg: OptimisticMessage = {
      id: optId,
      optimisticId: optId,
      sessionId: id,
      senderRole: 'user',
      senderId: user.id,
      msgType: 'image',
      content: '',
      imageUrl: localUrl,
      isSystem: false,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, optMsg]);

    try {
      const dataloom = await getDataloom();
      const { data, error: uploadError } = await dataloom.storage
        .from(getDefaultBucketId())
        .uploadFile(file);
      if (uploadError) throw uploadError;
      if (!data) throw new Error('上传失败');
      const downloadUrl = data.download_url || '';

      const res = await support.sendMessage(
        id,
        user.id,
        'image',
        '',
        downloadUrl,
      );
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.optimisticId === optId
              ? { ...res.data, pending: false }
              : m,
          ),
        );
        toast.success('图片已发送');
      } else {
        toast.error(res.message || '发送失败');
        setMessages((prev) => prev.filter((m) => m.optimisticId !== optId));
      }
    } catch (e) {
      const err = e as {
        message?: string;
        response?: { data?: { error?: { message?: string } } };
      };
      const msg =
        err.response?.data?.error?.message ||
        err.message ||
        '上传失败，请重试';
      toast.error(msg);
      setMessages((prev) => prev.filter((m) => m.optimisticId !== optId));
      logger.error('图片上传失败', e);
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

  const renderMessage = (msg: OptimisticMessage) => {
    const isSystem = msg.isSystem || msg.senderRole === 'system';

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center">
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {msg.content}
          </span>
        </div>
      );
    }

    const isSelf = msg.senderRole === 'user';
    const isPlatform = msg.senderRole === 'platform';
    const alignClass = isSelf ? 'items-end' : 'items-start';

    return (
      <div
        key={msg.id}
        className={clsx('flex flex-col gap-1', alignClass)}
      >
        {msg.msgType === 'image' ? (
          <div
            className={clsx(
              'relative max-w-[200px] rounded-lg overflow-hidden cursor-pointer',
              isSelf ? 'rounded-br-sm bg-primary/10' : 'rounded-bl-sm bg-secondary',
              msg.pending && 'opacity-70',
            )}
            onClick={() => msg.imageUrl && setPreviewImage(msg.imageUrl)}
          >
            <Image
              src={msg.imageUrl}
              alt="消息图片"
              className="w-full h-auto block"
            />
            {msg.pending && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
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
              msg.pending && 'opacity-70',
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
          {msg.pending ? '发送中...' : formatDate(msg.createdAt)}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <MobileLayout title="客服 · 顺手捎" showBack showTabBar={false}>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-start">
              <Skeleton className="h-10 w-40 rounded-lg" />
            </div>
          ))}
        </div>
      </MobileLayout>
    );
  }

  if (error) {
    return (
      <MobileLayout title="客服 · 顺手捎" showBack showTabBar={false}>
        <div className="p-4">
          <Empty className="bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </EmptyMedia>
              <EmptyTitle>加载失败</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <button
                type="button"
                onClick={() => void loadInitial()}
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

  const isSendDisabled =
    !inputValue.trim() || sending || uploading;

  return (
    <MobileLayout title="客服 · 顺手捎" showBack showTabBar={false}>
      <div className="w-full max-w-md mx-auto min-h-full flex flex-col">
        <div
          ref={listRef}
          className="flex-1 p-4 space-y-4 bg-muted/30"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full py-8">
              <p className="text-xs text-muted-foreground">
                暂无消息，有问题随时告诉我们
              </p>
            </div>
          ) : (
            messages.map((msg) => renderMessage(msg))
          )}
        </div>

        <div className="sticky bottom-0 z-10 bg-card border-t border-border p-3 safe-bottom mb-[-1px]">
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center btn-press',
                uploading || sending
                  ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
              aria-label="发送图片"
              disabled={uploading || sending}
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
              className="flex-1 h-9 px-3 rounded-full border border-input bg-transparent text-base outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              disabled={uploading || sending}
            />
            <button
              type="button"
              onClick={() => void sendTextMessage()}
              disabled={isSendDisabled}
              className={clsx(
                'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center btn-press',
                isSendDisabled
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

      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
        >
          <Image
            src={previewImage}
            alt="图片预览"
            className="max-w-full max-h-full object-contain"
          />
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={() => setPreviewImage(null)}
            aria-label="关闭预览"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
    </MobileLayout>
  );
};

export default SupportChatPage;
