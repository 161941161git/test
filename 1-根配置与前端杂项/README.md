# 顺手捎 · 校园快递代取

Vite + React 前端、NestJS 后端、PostgreSQL 数据库。全部代码自包含，不依赖任何第三方平台的 SDK。
前端构建产物由后端一起托管，**一个服务就能跑完整个应用**（页面 + `/api` + 上传图片）。

---

## 一、目录结构

```
.
├── client/                 前端（Vite + React 19）
│   ├── index.html
│   ├── public/             favicon.svg、pay-qr.jpg（开发者收款码兜底图）
│   └── src/
│       ├── api/            接口封装（axios，读 VITE_API_BASE_URL）
│       ├── components/     布局组件 + shadcn/ui 基础组件（55 个）
│       ├── lib/shims/      上传、日志、确认框的本地实现
│       ├── pages/          买家端 / 接单员端 / 后台，共 42 个页面
│       ├── store/          本地登录态
│       ├── app.tsx         路由表
│       └── index.tsx       入口
├── server/                 后端（NestJS 10）
│   ├── common/             统一返回体、全局异常过滤器
│   ├── database/           Drizzle 连接（database.module.ts）与表结构（schema.ts）
│   ├── modules/            auth users orders payment chat refund settlement
│   │                       notification runner support admin upload health view
│   ├── app.module.ts
│   └── main.ts
├── shared/api.interface.ts 前后端共用类型
├── uploads/                运行时上传目录（.gitkeep 占位，代码也会自动创建）
├── railway.json            Railway 构建 / 启动配置
├── render.yaml             备用：如果以后要回 Render 部署
├── drizzle.config.ts       建表工具配置
├── nest-cli.json
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig*.json
├── vite.config.ts
├── .env.example            环境变量模板（只有说明，没有真实密码）
├── .gitignore
├── push-to-github.ps1      一键推送到 GitHub 的脚本
└── push-to-github.README.md  脚本用法
```

---

## 二、本地运行

```bash
npm install
cp .env.example .env      # 改 DATABASE_URL、VITE_API_BASE_URL
npm run db:push           # 建表（需要一个能连上的 PostgreSQL）
npm run build
npm start                 # 默认 http://localhost:3000
```

开发时也可以分开跑：`npm run dev:server` + `npm run dev:client`。
后端用了 TypeScript 路径别名（`@server/*`），所以更推荐 `npm run build && npm start`。

---

## 三、上传到 GitHub

### 方式 A：跑脚本（推荐，262 个文件一次推完）

先在 GitHub 建一个**完全空的**仓库（不要勾 Add a README / .gitignore / license），
拿到地址后在本文件夹里执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\push-to-github.ps1 -RepoUrl "https://github.com/你的账号/仓库名.git"
```

### 方式 B：网页拖拽

GitHub 网页端「Upload files」**一次最多 100 个文件**，本项目有 262 个，所以要拖 3 次：

1. 第一次拖根目录这些：`package.json`、`package-lock.json`、`railway.json`、`render.yaml`、
   `drizzle.config.ts`、`nest-cli.json`、`tailwind.config.ts`、`postcss.config.js`、
   `tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`、`vite.config.ts`、
   `.env.example`、`.gitignore`、`README.md`、`push-to-github.ps1`、`push-to-github.README.md`
2. 第二次拖整个 `client` 文件夹（156 个文件，超过 100 时 GitHub 会提示，改成分两次：
   先拖 `client/index.html`、`client/public`、`client/package` 相关，再拖 `client/src`）
3. 第三次拖 `server`（88 个）+ `shared`（1 个）+ `uploads/.gitkeep`

> 拖拽容易漏 `.env.example` 这类点号开头的文件，漏了也不影响部署（那只是模板）；
> 但 `package.json`、`package-lock.json`、`vite.config.ts`、`nest-cli.json`、`tsconfig*.json`
> 一个都不能漏，否则 Railway 构建会直接失败。

---

## 四、部署到 Railway

1. 登录 <https://railway.com>，**New Project → Deploy from GitHub repo**，授权并选中刚推上去的仓库。
2. 在同一个 Project 里 **New → Database → Add PostgreSQL**（会自动生成 `DATABASE_URL`）。
3. 打开 Web Service 的 **Variables**，把 Postgres 服务里的 `DATABASE_URL` 引用过来，
   再补下面几个变量：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | 指向 Railway 的 Postgres（用 `${{Postgres.DATABASE_URL}}` 引用即可） |
| `DATABASE_SSL` | 否 | 不用填。Railway 内网库不需要 SSL，代码会自动判断；填 `true` 才会强开 |
| `DATABASE_POOL_MAX` | 否 | 连接池上限，`5` 足够 |
| `PUBLIC_BASE_URL` | 是 | 你的 Railway 公网域名，如 `https://shunshou-production.up.railway.app`，用于拼上传图片的完整地址 |
| `VITE_API_BASE_URL` | 否 | **前后端同域部署时可以留空**，留空即请求当前域名；只有前后端分开部署才需要填后端地址 |
| `SEED_ADMIN_USERNAME` | 否 | 首次启动创建的后台账号，默认 `xushenxin050831` |
| `SEED_ADMIN_PASSWORD` | 是 | 后台密码，自己定；不填不会创建管理员 |

4. 构建与启动由仓库里的 `railway.json` 决定：

   - Build：`npm ci --include=dev && npm run build && npm run db:push`
   - Start：`npm start`
   - 健康检查：`/api/health`

   其中 `npm run db:push` 就是建表，每次部署都会跑一遍（幂等，不会清数据）。
   如果第一次构建时 Postgres 还没加好，等数据库创建完再点一次 **Redeploy**。

5. 部署成功后打开域名，后台入口是 `/admin/login`，用 `SEED_ADMIN_USERNAME` +
   `SEED_ADMIN_PASSWORD` 登录。

> `VITE_API_BASE_URL` 是**构建期**变量（会被打进前端 JS），改了必须重新部署才生效。
> 同域部署留空最省事，也不用担心域名变化。

---

## 五、Railway / Render 免费实例的已知限制

- **文件系统是临时的**：`uploads/` 里的图片（兼职收款码、退款截图、送达照片）在重新部署后
  会丢。要长期保留，把 `server/modules/upload/upload.controller.ts` 换成对象存储
  （Cloudflare R2 / S3），固定素材（如开发者收款码）建议直接放 `client/public/`。
- **Railway 免费额度**是按用量计的 trial credit，用完需要绑卡；服务空闲不会休眠（这点比 Render 好）。
- 单实例足够用；本项目没有做多实例共享会话，多副本部署会导致上传图片各存一份。

---

## 六、已实现的功能

- 买家下单：多包裹计价（≤2 件 ¥1.00，超出每件 +¥0.50，下雨/急送各 +¥0.50，后端重算）
- 下单后弹出开发者收款码，付完才能点「我已完成付款」
- 接单大厅：展示待接单订单，校验买家不能接自己的单、未通过审核不能接
- 送达必须在会话里先发照片，买家确认或 24 小时自动确认
- 按 90% / 10% 结算，送达后自动开通「跑腿员 ↔ 平台」结算会话并提示出示收款码
- 买家退款：申请后自动开通「买家 ↔ 平台」会话并提示出示收款码，后台审核
- 兼职申请（上传收款码）→ 后台看到申请信息与收款码 → 通过后回写用户角色
- 站内通知：下单 / 接单 / 送达 / 完成 / 退款 / 审核
- 后台：数据看板、订单、用户、兼职审核、退款、结算、资金流水、支付配置、站内通知、客服会话

状态色口径：等待接单 `#1D4ED8`、进行中 `#16A34A`、已送达 `#1D4ED8`、已完成 `#1E3A8A`、
退款中 `#2563EB`、已退款 `#475569`；后台待办统一醒目红 `#DC2626`。
