import { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { Send, Camera, Image as ImageIcon } from 'lucide-react';
import { getDataloom } from '@client/src/lib/shims/dataloom';
import { getDefaultBucketId } from '@client/src/lib/shims/storage';
import { chat } from '@client/src/api/modules';
import { useUser } from '@client/src/store/userStore';
import { formatDate } from '@client/src/utils/format';
import type { ChatMessage, OrderStatus } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

interface ChatSectionProps {
  orderId: string;
  orderStatus: OrderStatus;
  onHasDeliveryPhoto?: (has: boolean) => void;
}

const ChatSection: React.FC<ChatSectionProps> = ({ orderId, orderStatus, onHasDeliveryPhoto }) => {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deliveryFileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadMessages = useCallback(async () => {
    try {
      const res = await chat.list(orderId);
      if (res.success) {
        const list = res.data || [];
        setMessages(list);
        if (onHasDeliveryPhoto) {
          const hasDelivery = list.some((m: ChatMessage) => m.isDeliveryPhoto);
          onHasDeliveryPhoto(hasDelivery);
        }
      } else {
        toast.error(res.message || '获取聊天记录失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '获取聊天记录失败');
    }
  }, [orderId, onHasDeliveryPhoto]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const sendTextMessage = async () => {
    if (!user || !inputValue.trim() || sending) return;
    setSending(true);
    try {
      const res = await chat.send({
        orderId,
        senderId: user.id,
        senderRole: user.userRole,
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

  const uploadAndSendImage = async (file: File, isDelivery: boolean) => {
    if (!user) return;
    setUploading(true);
    try {
      const dataloom = await getDataloom();
      const { data, error } = await dataloom.storage.from(getDefaultBucketId()).uploadFile(file);
      if (error) throw error;
      if (!data) throw new Error('上传失败');
      const downloadUrl = data.download_url || '';

      const res = await chat.send({
        orderId,
        senderId: user.id,
        senderRole: user.userRole,
        msgType: 'image',
        content: isDelivery ? '[送达照片]' : '[图片]',
        imageUrl: downloadUrl,
        isDeliveryPhoto: isDelivery,
      });
      if (res.success) {
        setMessages((prev) => [...prev, res.data]);
        if (isDelivery && onHasDeliveryPhoto) {
          onHasDeliveryPhoto(true);
        }
        toast.success(isDelivery ? '送达照片已发送' : '图片已发送');
      } else {
        toast.error(res.message || '发送失败');
      }
    } catch (e) {
      const err = e as { message?: string; response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || err.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isDelivery: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      void uploadAndSendImage(file, isDelivery);
    }
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendTextMessage();
    }
  };

  const isRunner = user?.userRole === 'runner';
  const canSendDeliveryPhoto = isRunner && orderStatus === 'in_progress';

  return (
    <div className="flex flex-col bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-medium text-foreground">聊天沟通</p>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30 max-h-[400px] min-h-[300px]"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8">
            <p className="text-xs text-muted-foreground">暂无消息，打个招呼吧</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = user && msg.senderId === user.id;
            return (
              <div
                key={msg.id}
                className={clsx('flex flex-col gap-1', isSelf ? 'items-end' : 'items-start')}
              >
                {msg.msgType === 'image' ? (
                  <div
                    className={clsx(
                      'relative max-w-[200px] rounded-lg overflow-hidden',
                      isSelf
                        ? 'rounded-br-sm bg-primary/10'
                        : 'rounded-bl-sm bg-secondary',
                    )}
                  >
                    <Image
                      src={msg.imageUrl}
                      alt={msg.isDeliveryPhoto ? '送达照片' : '聊天图片'}
                      className="w-full h-auto block"
                    />
                    {msg.isDeliveryPhoto && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-status-completed text-white">
                        送达照片
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={clsx(
                      'max-w-[75%] px-3 py-2 text-sm rounded-lg',
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
          })
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          {canSendDeliveryPhoto && (
            <button
              type="button"
              onClick={() => deliveryFileInputRef.current?.click()}
              className={clsx(
                'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center btn-press',
                uploading
                  ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'bg-status-completed/10 text-status-completed hover:bg-status-completed/20',
              )}
              aria-label="送达拍照"
              disabled={uploading}
              title="送达拍照"
            >
              <Camera className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
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
            disabled={uploading}
          >
            <ImageIcon className="w-5 h-5" strokeWidth={2} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(e, false)}
          />
          <input
            ref={deliveryFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(e, true)}
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
        {canSendDeliveryPhoto && (
          <p className="text-[11px] text-status-completed mt-2 ml-1">
            📷 绿色相机按钮可发送送达照片，发送后「已送达」按钮即可用
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatSection;
