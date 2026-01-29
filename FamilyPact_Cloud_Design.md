# FamilyPact Cloud 设计规约 (V2.0)

## 1. 核心愿景

从单机版工具升级为家庭共享云平台。实现数据永久保存、多子管理、家长/孩子身份隔离以及历史数据追溯。

## 2. 技术栈架构

* **前端 (Frontend)**: Vite + Vanilla JS (iPhone 风格 Tab 布局)
* **部署 (Hosting)**: [Cloudflare Pages](https://pages.cloudflare.com/)
* **后端 (Backend)**: [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions/) (Serverless)
* **数据库 (Database)**: [Neon PostgreSQL](https://neon.tech/) (Serverless DB)

## 3. 数据库设计 (Neon)

采用三张核心表，重点使用 `JSONB` 存储打分灵活性。

* `families`: 存储家庭邀请码。
* `users`: 区分家长/孩子身份，关联家庭 ID。
* `daily_logs`: 核心表。存储日期、明细 (JSONB)、总分。

## 4. API 接口设计

所有接口位于 `/functions/api/*` 路径下：

* `POST /api/auth`: 校验家庭码，获取成员列表。
* `GET /api/logs`: 加载特定日期的打分快照。
* `POST /api/logs`: 实时同步今日进度 (Upsert 逻辑)。
* `GET /api/week`: 聚合查询本周得分曲线。

## 5. UI/UX 深度体验优化

* **身份选择器**: 进入 APP 首先确定角色。
* **多子切换 (Parent Only)**: 家长端顶部显示多个孩子头像，滑动切换数据。
* **胶囊周视图**: 在状态页顶部显示周日历，通过小圆点标识历史完成情况。
* **静默同步**: 用户操作后后台自动发起同步，无 loading 弹窗，保证极致流畅。

## 6. 部署指南

1. 在 Neon 创建 DB 并执行 `init.sql`。
2. 在 Cloudflare Pages 绑定 GitHub 仓库。
3. 在控制台环境变量中添加 `DATABASE_URL`。
4. 推送代码至 `main` 分支即可自动上线。
