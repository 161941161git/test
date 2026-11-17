import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  Send,
  Image as ImageIcon,
  ArrowLeft,
  CheckCircle2,
  XIcon,
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
import { formatDate, formatMoney } from '@client/src/utils/format';
import {
  SETTLEMENT_SESSION_STATUS_LABELS,
  type SettlementSession,
  type SettlementMessage,
} from '@shared/api.interface';

const AdminSettlementDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SettlementSession | null>(null);
  const [messages, setMessages] = useState<SettlementMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState<boolean>(false);
  const [markPaidRemark, setMarkPaidRemark] = useState<string>('');
  const [markPaidSubmitting, setMarkPaidSubmitting] = useState<boolean>(false);
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
        admin.getSettlementSession(id),
        admin.getSettlementMessages(id),
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
    } catch (err) {
      const msg = getApiErrorMessage(err, '加载失败，请重试');
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
      const res = await admin.sendSettlementMessage(id, {
        msgType: 'text',
        content: inputValue.trim(),
      });
      if (res.success) {
        setMessages((prev) => [...prev, res.data]);
        setInputValue('');
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

      const res = await admin.sendSettlementMessage(id, {
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

  const handleMarkPaid = async () => {
    if (!session || !id || markPaidSubmitting) return;
    setMarkPaidSubmitting(true);
    try {
      const res = await admin.markSettlementPaid(
        id,
        session.runnerAmountFen,
        markPaidRemark.trim() || undefined,
      );
      if (res.success) {
        toast.success('已标记打款');
        setMarkPaidOpen(false);
        setMarkPaidRemark('');
        // 刷新会话和消息
        await loadData();
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setMarkPaidSubmitting(false);
    }
  };

  const renderMessage = (msg: SettlementMessage) => {
    const isSystem = msg.isSystem || msg.senderRole === 'system';
    const isRunner = msg.senderRole === 'runner';
    // 平台身份：后台视角，平台消息靠左，跑腿员消息靠右
    const isSelf = isRunner;

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
              alt="结算图片"
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

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-8 h-8 -ml-2 flex items-center justify-center rounded-md hover:bg-muted"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <div className="flex-1">
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-8 h-8 -ml-2 flex items-center justify-center rounded-md hover:bg-muted"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <h1 className="text-base font-semibold">结算会话详情</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="text-primary text-sm font-medium"
            >
              点击重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部标题栏 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-8 h-8 -ml-2 flex items-center justify-center rounded-md hover:bg-muted"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">
            与 {session?.runnerName || '跑腿员'} 结算
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            订单号：{session?.orderNo || ''}
          </p>
        </div>
      </div>

      {/* 会话信息 */}
      {session && (
        <div className="bg-card border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-0.5">
                跑腿员：{session.runnerName}
                {session.runnerPhone && (
                  <span className="ml-2 tnum">{session.runnerPhone}</span>
                )}
              </p>
              <p className="text-lg font-bold text-primary tnum">
                {formatMoney(session.runnerAmountFen / 100)}
                <span className="text-[11px] font-normal text-muted-foreground ml-1">
                  应得金额
                </span>
              </p>
            </div>
            <span
              className={clsx(
                'shrink-0 px-2.5 py-1 text-xs font-medium rounded-full',
                (session.status === 'pending_payment' || session.status === 'pending_settle') &&
                  'bg-red-100 text-red-700',
                session.status === 'paid' && 'bg-green-600 text-white',
                session.status === 'refunded' &&
                  'bg-gray-200 text-gray-600',
              )}
            >
              {SETTLEMENT_SESSION_STATUS_LABELS[session.status]}
            </span>
          </div>
          {session.wechatQrUrl && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">跑腿员收款码</p>
              <div
                className="w-36 h-36 rounded-lg overflow-hidden border border-border cursor-pointer bg-muted/30 flex items-center justify-center"
                onClick={() => setPreviewImage(session.wechatQrUrl)}
              >
                <Image
                  src={session.wechatQrUrl}
                  alt="收款码"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">点击查看大图</p>
            </div>
          )}
        </div>
      )}

      {/* 消息流 */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8">
            <p className="text-xs text-muted-foreground">
              暂无消息
            </p>
          </div>
        ) : (
          messages.map((msg) => renderMessage(msg))
        )}
      </div>

      {/* 底部输入区 + 标记打款 */}
      <div className="border-t border-border bg-card safe-bottom">
        {(session?.status === 'pending_settle' || session?.status === 'pending_payment') && (
          <div className="px-4 pt-3">
            <Button
              className="w-full h-10 text-sm"
              onClick={() => {
                setMarkPaidRemark('');
                setMarkPaidOpen(true);
              }}
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
              标记已打款
            </Button>
          </div>
        )}
        <div className="p-3">
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                uploading
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
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="flex-1 h-9"
              disabled={uploading || sending}
            />
            <button
              type="button"
              onClick={() => void sendTextMessage()}
              disabled={!inputValue.trim() || sending || uploading}
              className={clsx(
                'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
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

      {/* 标记打款确认弹窗 */}
      <AlertDialog
        open={markPaidOpen}
        onOpenChange={(open) => {
          if (!open && !markPaidSubmitting) {
            setMarkPaidOpen(false);
            setMarkPaidRemark('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>确认标记已打款？</AlertDialogTitle>
          <AlertDialogDescription>
            标记后将向跑腿员发送系统通知，此操作不可撤销。
          </AlertDialogDescription>
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-muted-foreground">打款金额</span>
              <span className="text-lg font-bold text-primary tnum">
                {session ? formatMoney(session.runnerAmountFen / 100) : '¥0.00'}
              </span>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">备注说明</label>
              <Input
                value={markPaidRemark}
                onChange={(e) => setMarkPaidRemark(e.target.value)}
                placeholder="选填，如转账流水号等"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markPaidSubmitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleMarkPaid();
              }}
            >
              确认打款
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSettlementDetailPage;
