import React, { useEffect, useState } from 'react';
import { Trophy, Crown, Medal } from 'lucide-react';
import { users, type LeaderboardItem } from '@client/src/api/modules';
import { formatMoney } from '@client/src/utils/format';

interface LeaderboardCardProps {
  /** 紧凑模式（后台侧边 / 页面内嵌） */
  compact?: boolean;
  limit?: number;
  /** 需要高亮的当前用户 id，让本人一眼看到自己排第几 */
  highlightUserId?: string;
  title?: string;
}

const RANK_COLORS: Record<number, string> = {
  1: 'bg-warning/15 text-warning border-warning/30',
  2: 'bg-secondary text-foreground border-border',
  3: 'bg-primary/10 text-primary border-primary/20',
};

const LeaderboardCard: React.FC<LeaderboardCardProps> = ({
  compact = false,
  limit = 10,
  highlightUserId,
  title = '接单排行榜',
}) => {
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void users
      .leaderboard(limit)
      .then((resp) => {
        if (!alive) return;
        if (resp.success) setItems(resp.data.items);
      })
      .catch(() => {
        // 静默失败，排行榜不影响主流程
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [limit]);

  const champion = items[0];

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Trophy className="w-4 h-4 text-warning" strokeWidth={2} />
        <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground">按接单量</span>
      </div>

      {loading ? (
        <div className="px-4 pb-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-muted-foreground">
          还没有人接单，冲第一的就是你
        </p>
      ) : (
        <>
          {/* 冠军展示 */}
          {!compact && champion && (
            <div className="mx-3 mb-2 rounded-lg bg-gradient-to-r from-warning/15 to-primary/10 border border-warning/20 px-3 py-2.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                <Crown className="w-4 h-4 text-warning" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">
                  {champion.name}
                  <span className="ml-1.5 text-[11px] font-normal text-warning">
                    第 1 名
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {champion.dormitory || '校内'} · {champion.orderCount} 单 · 已赚 ¥
                  {formatMoney(champion.earnings)}
                </p>
              </div>
            </div>
          )}

          <div className="px-2 pb-2">
            {items.map((item) => {
              const isSelf = highlightUserId && item.userId === highlightUserId;
              return (
                <div
                  key={item.userId}
                  className={
                    'flex items-center gap-2.5 px-2 py-2 rounded-lg ' +
                    (isSelf ? 'bg-primary/5 border border-primary/20' : '')
                  }
                >
                  <span
                    className={
                      'w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 border ' +
                      (RANK_COLORS[item.rank] ?? 'bg-muted text-muted-foreground border-border')
                    }
                  >
                    {item.rank <= 3 ? (
                      <Medal className="w-3.5 h-3.5" strokeWidth={2} />
                    ) : (
                      item.rank
                    )}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-foreground truncate">
                    {item.name}
                    {isSelf && (
                      <span className="ml-1.5 text-[10px] text-primary">（我）</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground tnum flex-shrink-0">
                    {item.orderCount} 单
                  </span>
                  <span className="text-xs font-semibold text-primary tnum flex-shrink-0 w-16 text-right">
                    ¥{formatMoney(item.earnings)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default LeaderboardCard;
