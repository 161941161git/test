/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, foreignKey, index, integer, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const supportMessages = pgTable("support_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  senderRole: varchar("sender_role", { length: 20 }).notNull(),
  senderId: varchar("sender_id", { length: 64 }),
  senderName: varchar("sender_name", { length: 50 }).notNull(),
  msgType: varchar("msg_type", { length: 20 }).notNull().default('text'),
  content: text("content").notNull(),
  imageUrl: text("image_url").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  relatedOrderId: uuid("related_order_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_support_messages_session_id").on(table.sessionId),
  index("idx_support_messages_created").on(table.createdAt),
]);

export const supportSessions = pgTable("support_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionType: varchar("session_type", { length: 20 }).notNull(),
  userId: uuid("user_id").notNull(),
  userName: varchar("user_name", { length: 50 }).notNull(),
  lastMessage: text("last_message").notNull(),
  lastMessageAt: customTimestamptz("last_message_at", { precision: 3 }),
  unreadAdminCount: integer("unread_admin_count").notNull().default(0),
  unreadUserCount: integer("unread_user_count").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_support_sessions_user_type").on(table.userId, table.sessionType),
  index("idx_support_sessions_status").on(table.status),
  index("idx_support_sessions_last_message_at").on(table.lastMessageAt),
  uniqueIndex("idx_support_sessions_user_type_unique").on(table.userId, table.sessionType),
]);

export const refundMessages = pgTable("refund_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  senderRole: varchar("sender_role", { length: 20 }).notNull(),
  senderId: varchar("sender_id", { length: 64 }),
  msgType: varchar("msg_type", { length: 20 }).notNull().default('text'),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  isSystem: boolean("is_system").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_refund_messages_session_id").on(table.sessionId),
  index("idx_refund_messages_created").on(table.createdAt),
]);

export const refundSessions = pgTable("refund_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  buyerId: uuid("buyer_id").notNull(),
  refundRequestId: uuid("refund_request_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  refundAmountFen: integer("refund_amount_fen"),
  refundRemark: text("refund_remark"),
  rejectReason: text("reject_reason"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_refund_sessions_order_id").on(table.orderId),
  index("idx_refund_sessions_buyer_id").on(table.buyerId),
  index("idx_refund_sessions_refund_request_id").on(table.refundRequestId),
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientType: varchar("recipient_type", { length: 20 }).notNull(),
  recipientId: varchar("recipient_id", { length: 64 }).notNull(),
  title: varchar("title", { length: 100 }).notNull(),
  content: text("content").notNull(),
  relatedType: varchar("related_type", { length: 30 }),
  relatedId: varchar("related_id", { length: 64 }),
  isRead: boolean("is_read").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_notifications_recipient").on(table.recipientType, table.recipientId, table.createdAt),
  index("idx_notifications_unread").on(table.recipientType, table.recipientId, table.isRead),
]);

export const runnerApplications = pgTable("runner_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: varchar("name", { length: 50 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  wechatId: varchar("wechat_id", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  rejectReason: text("reject_reason"),
  reviewedBy: varchar("reviewed_by", { length: 50 }),
  reviewedAt: customTimestamptz("reviewed_at", { precision: 3 }),
  paymentQrUrl: text("payment_qr_url").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_runner_applications_user_id").on(table.userId),
  index("idx_runner_applications_status").on(table.status),
  index("idx_runner_applications_created").on(table.createdAt),
]);

export const settlementMessages = pgTable("settlement_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  senderRole: varchar("sender_role", { length: 20 }).notNull(),
  msgType: varchar("msg_type", { length: 20 }).notNull().default('text'),
  content: text("content").notNull(),
  imageUrl: text("image_url").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_settlement_messages_session_id").on(table.sessionId),
  index("idx_settlement_messages_created").on(table.createdAt),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [settlementSessions.id],
    name: "settlement_messages_session_id_fkey",
  }).onDelete("cascade"),
]);

export const settlementSessions = pgTable("settlement_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  runnerId: uuid("runner_id").notNull(),
  totalAmountFen: integer("total_amount_fen").notNull().default(0),
  runnerAmountFen: integer("runner_amount_fen").notNull().default(0),
  platformFeeFen: integer("platform_fee_fen").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default('pending_payment'),
  paidAt: customTimestamptz("paid_at", { precision: 3 }),
  paidRemark: varchar("paid_remark", { length: 200 }),
  payProofUrl: text("pay_proof_url"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_settlement_sessions_order_id").on(table.orderId),
  index("idx_settlement_sessions_runner_id").on(table.runnerId),
  index("idx_settlement_sessions_status").on(table.status),
  foreignKey({
    columns: [table.orderId],
    foreignColumns: [orders.id],
    name: "settlement_sessions_order_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.runnerId],
    foreignColumns: [users.id],
    name: "settlement_sessions_runner_id_fkey",
  }),
]);

export const qrConfigs = pgTable("qr_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  wechatQrUrl: text("wechat_qr_url").notNull(),
  alipayQrUrl: text("alipay_qr_url").notNull(),
  payeeNickname: varchar("payee_nickname", { length: 50 }).notNull().default('开发者'),
  paymentNote: text("payment_note").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const profitSharingRecords = pgTable("profit_sharing_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  paymentOrderId: uuid("payment_order_id"),
  totalAmountFen: integer("total_amount_fen").notNull(),
  runnerAmountFen: integer("runner_amount_fen").notNull(),
  platformAmountFen: integer("platform_amount_fen").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  thirdPartyNo: varchar("third_party_no", { length: 100 }),
  failReason: text("fail_reason"),
  retryCount: integer("retry_count").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_profit_sharing_order_id").on(table.orderId),
  index("idx_profit_sharing_status").on(table.status),
  foreignKey({
    columns: [table.orderId],
    foreignColumns: [orders.id],
    name: "profit_sharing_records_order_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.paymentOrderId],
    foreignColumns: [paymentOrders.id],
    name: "profit_sharing_records_payment_order_id_fkey",
  }),
]);

export const paymentConfigs = pgTable("payment_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentMode: varchar("payment_mode", { length: 10 }).notNull().default('mock'),
  wechatAppId: varchar("wechat_app_id", { length: 100 }),
  wechatMchId: varchar("wechat_mch_id", { length: 100 }),
  wechatApiV3Key: varchar("wechat_api_v3_key", { length: 255 }),
  wechatCertSerial: varchar("wechat_cert_serial", { length: 100 }),
  wechatPrivateKey: text("wechat_private_key"),
  wechatPlatformCert: text("wechat_platform_cert"),
  alipayAppId: varchar("alipay_app_id", { length: 100 }),
  alipayPrivateKey: text("alipay_private_key"),
  alipayPublicKey: text("alipay_public_key"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const adminPaymentAccounts = pgTable("admin_payment_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull(),
  channel: varchar("channel", { length: 20 }).notNull(),
  accountNo: varchar("account_no", { length: 100 }).notNull(),
  realName: varchar("real_name", { length: 50 }),
  isDefault: boolean("is_default").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_admin_payment_acc_admin_channel").on(table.adminId, table.channel),
  foreignKey({
    columns: [table.adminId],
    foreignColumns: [admins.id],
    name: "admin_payment_accounts_admin_id_fkey",
  }).onDelete("cascade"),
]);

export const paymentAccounts = pgTable("payment_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  accountType: varchar("account_type", { length: 20 }).notNull(),
  channel: varchar("channel", { length: 20 }).notNull(),
  accountNo: varchar("account_no", { length: 100 }).notNull(),
  realName: varchar("real_name", { length: 50 }),
  isDefault: boolean("is_default").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_payment_acc_user_channel").on(table.userId, table.channel),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "payment_accounts_user_id_fkey",
  }).onDelete("cascade"),
]);

export const fundTransactions = pgTable("fund_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id"),
  txType: varchar("tx_type", { length: 30 }).notNull(),
  amountFen: integer("amount_fen").notNull(),
  direction: varchar("direction", { length: 10 }).notNull(),
  channel: varchar("channel", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  thirdPartyNo: varchar("third_party_no", { length: 100 }),
  runnerId: uuid("runner_id"),
  adminId: uuid("admin_id"),
  remark: text("remark"),
  rawSummary: text("raw_summary"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_fund_tx_order_id").on(table.orderId),
  index("idx_fund_tx_type").on(table.txType),
  index("idx_fund_tx_status").on(table.status),
  index("idx_fund_tx_created").on(table.createdAt),
  foreignKey({
    columns: [table.orderId],
    foreignColumns: [orders.id],
    name: "fund_transactions_order_id_fkey",
  }),
  foreignKey({
    columns: [table.runnerId],
    foreignColumns: [users.id],
    name: "fund_transactions_runner_id_fkey",
  }),
  foreignKey({
    columns: [table.adminId],
    foreignColumns: [admins.id],
    name: "fund_transactions_admin_id_fkey",
  }),
]);

export const paymentOrders = pgTable("payment_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  payNo: varchar("pay_no", { length: 64 }).notNull().unique(),
  amountFen: integer("amount_fen").notNull(),
  channel: varchar("channel", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  thirdPartyTradeNo: varchar("third_party_trade_no", { length: 100 }),
  paidAt: customTimestamptz("paid_at", { precision: 3 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("payment_orders_pay_no_key").on(table.payNo),
  index("idx_payment_orders_order_id").on(table.orderId),
  index("idx_payment_orders_status").on(table.status),
  foreignKey({
    columns: [table.orderId],
    foreignColumns: [orders.id],
    name: "payment_orders_order_id_fkey",
  }).onDelete("cascade"),
]);

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 50 }).notNull().default('管理员'),
  platformEarnings: numeric("platform_earnings").notNull().default('0'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("admins_username_key").on(table.username),
]);

export const withdrawRequests = pgTable("withdraw_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  amount: numeric("amount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  wechatId: varchar("wechat_id", { length: 100 }).notNull(),
  reviewedBy: varchar("reviewed_by", { length: 50 }),
  reviewedAt: customTimestamptz("reviewed_at", { precision: 3 }),
  channel: varchar("channel", { length: 20 }).notNull().default('wechat'),
  payAccountNo: varchar("pay_account_no", { length: 100 }),
  realName: varchar("real_name", { length: 50 }),
  paidAt: customTimestamptz("paid_at", { precision: 3 }),
  failReason: text("fail_reason"),
  payQrUrl: text("pay_qr_url").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_withdraw_requests_status").on(table.status),
  index("idx_withdraw_requests_user_id").on(table.userId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "withdraw_requests_user_id_fkey",
  }),
]);

export const refundRequests = pgTable("refund_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().unique(),
  buyerId: uuid("buyer_id").notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  rejectReason: text("reject_reason").notNull(),
  reviewedBy: varchar("reviewed_by", { length: 50 }),
  reviewedAt: customTimestamptz("reviewed_at", { precision: 3 }),
  screenshotUrl: text("screenshot_url"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("refund_requests_order_id_key").on(table.orderId),
  index("idx_refund_requests_status").on(table.status),
  foreignKey({
    columns: [table.orderId],
    foreignColumns: [orders.id],
    name: "refund_requests_order_id_fkey",
  }),
  foreignKey({
    columns: [table.buyerId],
    foreignColumns: [users.id],
    name: "refund_requests_buyer_id_fkey",
  }),
]);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  senderId: uuid("sender_id").notNull(),
  senderRole: varchar("sender_role", { length: 20 }).notNull(),
  msgType: varchar("msg_type", { length: 20 }).notNull().default('text'),
  content: text("content").notNull(),
  imageUrl: text("image_url").notNull(),
  isDeliveryPhoto: boolean("is_delivery_photo").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_chat_messages_order_id").on(table.orderId),
  foreignKey({
    columns: [table.orderId],
    foreignColumns: [orders.id],
    name: "chat_messages_order_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.senderId],
    foreignColumns: [users.id],
    name: "chat_messages_sender_id_fkey",
  }),
]);

export const orderPackages = pgTable("order_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  trackingNo: varchar("tracking_no", { length: 100 }).notNull(),
  pickupPhone: varchar("pickup_phone", { length: 20 }).notNull(),
  size: varchar("size", { length: 20 }).notNull().default('small'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_order_packages_order_id").on(table.orderId),
  foreignKey({
    columns: [table.orderId],
    foreignColumns: [orders.id],
    name: "order_packages_order_id_fkey",
  }).onDelete("cascade"),
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNo: varchar("order_no", { length: 32 }).notNull().unique(),
  buyerId: uuid("buyer_id").notNull(),
  runnerId: uuid("runner_id"),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  totalAmount: numeric("total_amount").notNull().default('0'),
  baseFee: numeric("base_fee").notNull().default('0'),
  extraFee: numeric("extra_fee").notNull().default('0'),
  rainyFee: numeric("rainy_fee").notNull().default('0'),
  urgentFee: numeric("urgent_fee").notNull().default('0'),
  isRainy: boolean("is_rainy").notNull().default(false),
  isUrgent: boolean("is_urgent").notNull().default(false),
  packageCount: integer("package_count").notNull().default(0),
  dormitory: varchar("dormitory", { length: 50 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 20 }).notNull(),
  remark: text("remark").notNull(),
  runnerEarnings: numeric("runner_earnings").notNull().default('0'),
  platformFee: numeric("platform_fee").notNull().default('0'),
  deliveredAt: customTimestamptz("delivered_at", { precision: 3 }),
  confirmedAt: customTimestamptz("confirmed_at", { precision: 3 }),
  autoSettleAt: customTimestamptz("auto_settle_at", { precision: 3 }),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default('unpaid'),
  payChannel: varchar("pay_channel", { length: 20 }),
  thirdPartyTradeNo: varchar("third_party_trade_no", { length: 100 }),
  paidAt: customTimestamptz("paid_at", { precision: 3 }),
  payProofUrl: text("pay_proof_url").notNull(),
  payRemark: text("pay_remark").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("orders_order_no_key").on(table.orderNo),
  index("idx_orders_status").on(table.status),
  index("idx_orders_buyer_id").on(table.buyerId),
  index("idx_orders_runner_id").on(table.runnerId),
  foreignKey({
    columns: [table.buyerId],
    foreignColumns: [users.id],
    name: "orders_buyer_id_fkey",
  }),
  foreignKey({
    columns: [table.runnerId],
    foreignColumns: [users.id],
    name: "orders_runner_id_fkey",
  }),
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 50 }).notNull(),
  dormitory: varchar("dormitory", { length: 50 }).notNull(),
  balance: numeric("balance").notNull().default('0'),
  totalOrders: integer("total_orders").notNull().default(0),
  totalEarnings: numeric("total_earnings").notNull().default('0'),
  isRunner: boolean("is_runner").notNull().default(false),
  wechatId: varchar("wechat_id", { length: 100 }),
  userRole: varchar("user_role", { length: 20 }).notNull().default('buyer'),
  wechatQrUrl: text("wechat_qr_url").notNull(),
  alipayQrUrl: text("alipay_qr_url").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("users_phone_key").on(table.phone),
  index("idx_users_phone").on(table.phone),
]);

// table aliases
export const adminPaymentAccountsTable = adminPaymentAccounts;
export const adminsTable = admins;
export const chatMessagesTable = chatMessages;
export const fundTransactionsTable = fundTransactions;
export const notificationsTable = notifications;
export const orderPackagesTable = orderPackages;
export const ordersTable = orders;
export const paymentAccountsTable = paymentAccounts;
export const paymentConfigsTable = paymentConfigs;
export const paymentOrdersTable = paymentOrders;
export const profitSharingRecordsTable = profitSharingRecords;
export const qrConfigsTable = qrConfigs;
export const refundMessagesTable = refundMessages;
export const refundRequestsTable = refundRequests;
export const refundSessionsTable = refundSessions;
export const runnerApplicationsTable = runnerApplications;
export const settlementMessagesTable = settlementMessages;
export const settlementSessionsTable = settlementSessions;
export const supportMessagesTable = supportMessages;
export const supportSessionsTable = supportSessions;
export const usersTable = users;
export const withdrawRequestsTable = withdrawRequests;
