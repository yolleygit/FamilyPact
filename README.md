# FamilyPact (家庭公约) 🏠✨

> 一个极简、优雅的家庭任务与积分管理系统，采用 iOS 原生设计美学。

FamilyPact 旨在帮助家庭建立健康的日常习惯，通过可视化的积分系统鼓励孩子完成生活、学习和劳动任务。它拥有媲美原生 iOS 应用的流畅体验和精致 UI。

## ✨ 核心特性

- **🍎 iOS 极致美学**: 深度复刻 iOS 设计语言，包含毛玻璃特效、平滑动画、触觉反馈和黑暗模式。
- **📝 多维任务管理**:
  - **生活 (Living)**: 运动、早起、用餐习惯等。
  - **学习 (Learning)**: 作业、阅读、练琴等。
  - **劳动 (Labor)**: 家务分担、整理收纳。
- **🏆 积分与惩罚**: 支持加分项、扣分项（如拖延、不专注）以及“必做项”检查。
- **🔒 角色权限**:
  - **孩子**: 查看任务、打卡（部分需要确认）、查看奖励。
  - **家长**: PIN 码保护，拥有最高权限（复核、调整分数、配置任务）。
- **☁️ 云端同步**: 基于 Cloudflare Pages + Workers (KV/D1) 实现多端实时数据同步。
- **📊 数据可视化**: 周趋势图表，直观展示孩子的成长曲线。

## 🛠️ 技术栈

- **前端**: 原生 HTML5, CSS3 (Variables, Flexbox/Grid, Backdrop-filter), Vanilla JavaScript (ES6+)。
- **后端/部署**: [Cloudflare Pages](https://pages.cloudflare.com/)。
- **构建工具**: Wrangler (Cloudflare CLI).
- **无依赖**: 零框架（No React/Vue），追求极致的轻量化和加载速度。

## 🚀 快速开始

### 1. 环境准备

确保你已安装 [Node.js](https://nodejs.org/) 和 [pnpm/npm](https://pnpm.io/)。

```bash
# 安装 Wrangler CLI
npm install -g wrangler
```

### 2. 启动本地开发服务器

```bash
# 进入应用目录
cd app

# 启动开发服务 (默认端口 8788)
npx wrangler pages dev .
```

访问 `http://localhost:8788` 即可看到应用。

### 3. 部署到 Cloudflare Pages

```bash
# 登录 Cloudflare 账号
npx wrangler login

# 部署
npx wrangler pages deploy . --project-name family-pact
```

## 📱 移动端体验

本项目专为移动端（特别是 iPhone）优化：

- 支持 `PWA`（可添加到主屏幕）。
- 适配刘海屏和灵动岛区域。
- 禁用双击缩放，提供原生 App 般的触控响应。

## 📂 项目结构

```
FamilyPact/
├── app/
│   ├── index.html      # 入口文件
│   ├── style.css       # 全局样式与 iOS 设计系统
│   ├── main.js         # 核心业务逻辑 (UI渲染 + 数据交互)
│   ├── data.js         # 任务配置数据
│   └── functions/      # Cloudflare Workers 后端函数
└── README.md
```

## 📄 许可证

MIT License
