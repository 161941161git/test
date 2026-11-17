import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { Send, Image as ImageIcon, ArrowLeft, Info } from 'lucide-react';
import { getDataloom } from '@client/src/lib/shims/dataloom';
import { getDefaultBucketId } from '@client/src/lib/shims/storage';
import { MobileLayout } from '@client/src/components/MobileLayout';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Button } from '@client/src/components/ui/button';
import { Image } from '@client/src/components/ui/image';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { refundSession } from '@client/src/api/modules';
import { formatDate } from '@client/src/utils/format';
import type { RefundSession, RefundMessage } from '@shared/api.interface';
import { REFUND_STATUS_LABELS } from '@shared/api.interface';

const RefundSessionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<RefundSession | null>(null);
  const [messages, setMessages] = useState<RefundMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [sessionRes, messagesRes] = await Promise.all([
        refundSession.getSession(id),
        refundSession.getMessages(id),
      ]);
      if (sessionRes.success) {
        setSession(sessionRes.data);
      } else {
        toast.error(sessionRes.message || '获取会话详情失败');
      }
      if (messagesRes.success) {
        setMessages(messagesRes.data || []);
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

  const sendTextMessage = async () => {
    if (!id || !inputValue.trim() || sending) return;
    setSending(true);
    try {
      const res = await refundSession.sendMessage(id, {
        msgType: 'text',
        content: inputValue.trim(),
      });
      if (res.success) {
        setMessages((prev) => [...prev, res.data]);
        setInputValue('');
      } else {
        toast.error(res.message || '发送失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const uploadAndSendImage = async (file: File) => {
    if (!id) return;
    setUploading(true);
    try {
      const dataloom = await getDataloom();
      const { data, error: uploadError } = await dataloom.storage
        .from(getDefaultBucketId())
        .uploadFile(file);
      if (uploadError) throw uploadError;
      if (!data) throw new Error('上传失败');
      const downloadUrl = data.download_url || '';

      const res = await refundSession.sendMessage(id, {
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
    } catch (e) {
      const err = e as {
        message?: string;
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(err.response?.data?.error?.message || err.message || '上传失败');
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

  const renderMessage = (msg: RefundMessage) => {
    const isSystem = msg.isSystem || msg.senderRole === 'system';
    const isBuyer = msg.senderRole === 'buyer';
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

    // 买家视角：自己发的靠右，平台靠左
    const isSelf = isBuyer;
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
            )}
            onClick={() => msg.imageUrl && setPreviewImage(msg.imageUrl)}
          >
            <Image
              src={msg.imageUrl}
              alt="退款图片"
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
          {formatDate(msg.createdAt)}
        </span>
      </div>
    );
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return '退款申请中';
      case 'refunded':
        return '已退款';
      case 'rejected':
        return '已拒绝';
      default:
        return status;
    }
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'bg-status-refunding/10 text-status-refunding';
      case 'refunded':
        return 'bg-status-completed/10 text-status-completed';
      case 'rejected':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <MobileLayout title="退款协商" showBack>
        <div className="p-4 space-y-4">
          <div className="bg-card rounded-xl border border-border p-4 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i: number) => (
              <div key={i} className="flex justify-start">
                <Skeleton className="h-10 w-40 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error || !session) {
    return (
      <MobileLayout title="退款协商" showBack>
        <div className="p-4">
          <Empty className="bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArrowLeft />
              </EmptyMedia>
              <EmptyTitle>加载失败</EmptyTitle>
              <EmptyDescription>{error || '会话不存在'}</EmptyDescription>
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

  const canSend = session.status === 'pending';

  return (
    <MobileLayout
      title={`退款协商 · ${session.orderNo || ''}`}
      showBack
    >
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* 退款状态信息 */}
        <div className="bg-card border-b border-border px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">
              订单号：{session.orderNo}
            </p>
            <span
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded-full',
                getStatusClass(session.status),
              )}
            >
              {getStatusLabel(session.status)}
            </span>
          </div>
          <p className="text-sm text-foreground">
            退款理由：{session.refundReason}
          </p>
          {session.status === 'rejected' && session.rejectReason && (
            <div className="mt-2 p-2 bg-destructive/5 rounded-lg">
              <p className="text-xs text-destructive font-medium">拒绝原因：</p>
              <p className="text-xs text-destructive/80 mt-1">{session.rejectReason}</p>
            </div>
          )}
          {session.screenshotUrl && (
            <div className="mt-2">
              <Image
                src={session.screenshotUrl}
                alt="退款截图"
                className="w-20 h-20 object-cover rounded-lg border border-border cursor-pointer"
                onClick={() => setPreviewImage(session.screenshotUrl)}
              />
            </div>
          )}
        </div>

        {/* 消息列表 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full py-8">
              <div className="text-center">
                <Info className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" strokeWidth={2} />
                <p className="text-xs text-muted-foreground">
                  退款申请已提交，请等待平台处理
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg: RefundMessage) => renderMessage(msg))
          )}
        </div>

        {/* 输入区 */}
        {canSend && (
          <div className="p-3 border-t border-border bg-card safe-bottom">
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
                aria-label="上传图片"
                disabled={uploading}
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
            <p className="text-[11px] text-muted-foreground mt-2 ml-1">
              可以上传收款码图片供平台退款使用
            </p>
          </div>
        )}

        {/* 图片预览 */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
            role="button"
            aria-label="关闭预览"
          >
            <Image
              src={previewImage}
              alt="预览"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default RefundSessionPage;
