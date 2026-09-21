# 私密空间

一个账号密码登录的实时社交网站：话题广场（发帖 / 回帖 / AI 打标筛选）+ 私密房间（实时聊天 / 阅后即焚）+ 私信 + 个性化设置。基于 Node.js + Express + Socket.IO + MongoDB，前后端一体，浏览器直接访问。

## 功能

- 账号体系：注册 / 登录 / 修改密码，会话 24 小时有效
- 话题广场：发帖、回帖、点赞，AI 自动打标签（深度分析 / 经验分享 / 求助 / 情绪宣泄 / 灌水），可按标签筛选，高质量内容置顶
- 智能回复建议：回复帖子或聊天时，AI 根据对方内容给出三个可选项，一键发送或自行编辑
- 私密房间：创建带密码的房间实时群聊，消息阅后即焚、不落库；支持自定义聊天背景和界面主题
- 私信：点开用户主页申请私聊，对方同意后建立一对一会话
- 个性化：自定义头像、简介、兴趣标签、四套主题（海洋 / 暗黑 / 日落 / 星空）、主页封面背景
- 管理员：admin 账号可删除广场任意帖子，维护内容秩序

## 技术栈

- 后端：Node.js + Express + Socket.IO
- 数据库：MongoDB（本机连接，无认证）
- 前端：原生 HTML / CSS / JavaScript，响应式适配手机与电脑
- AI：火山引擎方舟（豆包），OpenAI 兼容接口，服务端转发

## 本地运行

前置条件：安装 Node.js（16 以上）和 MongoDB。

```bash
# 1. 安装依赖
npm install

# 2. 首次运行初始化数据（创建管理员账号并预置话题）
node seed-posts.js

# 3. 启动
npm start
```

浏览器打开 http://localhost:3000。管理员账号：admin / admin123（登录后建议在设置里改密码）。

## AI 功能配置（可选）

AI 用于帖子打标和回复建议，不配置也能正常使用，只是这两项 AI 功能不生效。

1. 复制 `ai.config.example.json` 为 `ai.config.json`（该文件已在 .gitignore 中，不会提交到仓库）
2. 把火山引擎方舟的 API Key 填入 `apiKey` 字段
3. 重启服务

也可以不建文件，直接设置环境变量 `ARK_API_KEY`。

## 部署到公网

服务默认监听本机 3000 端口。要让别人通过网址访问，用 SSH 隧道映射到公网：

```bash
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=45 -o ServerAliveCountMax=3 -R 80:localhost:3000 nokey@localhost.run
```

运行后终端会打印一个 `https://xxxx.lhr.life` 地址，发给别人即可访问。免费隧道约 5~6 小时失效一次，失效后重跑命令换新地址。

项目里的 `刷新隧道.bat` 把这步做成了双击一键执行：自动关闭旧隧道、建立新隧道、打印新地址。

## 目录结构

```
├── server.js              # 后端入口：HTTP 接口 + Socket.IO 实时通信
├── ai.js                  # AI 打标与回复建议（服务端调用豆包 API）
├── ai.config.example.json # AI 配置模板（复制为 ai.config.json 使用）
├── seed-posts.js          # 初始化：管理员账号 + 预置话题
├── public/                # 前端页面、脚本、样式、LOGO
├── docs/                  # 产品使用说明、部署说明（网页版）
└── package.json           # 依赖清单
```

## 数据与隐私

- MongoDB 只在本机 127.0.0.1 监听，不对外开端口；对外访问唯一入口是 SSH 隧道
- 广场帖子、用户资料、聊天历史会存入数据库；私密房间消息只在内存中，关闭即消失
- 密码使用 bcrypt 加盐哈希存储
- AI 调用只发送需要打标或回复的内容，不涉及账号密码

## 常见问题

- 改完代码不生效？重启服务：停掉后重新 `npm start`
- 公网打不开？先确认本机 http://localhost:3000 能访问，再重跑刷新隧道
- 想清空数据？停掉服务后清空 MongoDB 数据目录内容，再跑一次 `node seed-posts.js`
