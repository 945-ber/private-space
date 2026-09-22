/**
 * 树洞 —— 后端服务器（MongoDB 版）
 * 技术栈：Express + Socket.IO + bcryptjs + express-session + MongoDB(官方驱动)
 *
 * 数据库：本机 MongoDB，库名 private_chat
 *   - users        用户账号（密码 bcrypt 哈希；头像/简介/主题/聊天背景）
 *   - rooms        房间（group 群房间 / dm 私信会话）
 *   - messages     聊天历史（支持阅后即焚，TTL 到期物理删除）
 *   - posts        话题广场帖子（含评论）
 *   - dm_invites   私信申请（pending/accepted/declined）
 *
 * 启动方式：npm start（先确认 MongoDB 已启动）
 * 访问地址：http://localhost:3000
 */

const path = require('path');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const ai = require('./ai'); // AI 版主 + 智能回复（火山方舟/豆包，可配置可降级）

// ============================================================
// 一、基础配置
// ============================================================
const PORT = 3000;
const MONGODB_URL = 'mongodb://127.0.0.1:27017'; // 本机 MongoDB
const DB_NAME = 'private_chat';
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const THEMES = ['ocean', 'dark', 'sunset', 'nebula'];
// 管理员账户：可删除广场任意帖子（含他人）
const ADMIN_USER = 'admin';

// 转义正则特殊字符：防止用户输入被当作正则元字符执行（如 .* 会匹配全部用户）
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ---------- MongoDB 连接 ----------
const client = new MongoClient(MONGODB_URL);
let db;

function usersCol() { return db.collection('users'); }
function roomsCol() { return db.collection('rooms'); }
function messagesCol() { return db.collection('messages'); }
function postsCol() { return db.collection('posts'); }
function dmInvitesCol() { return db.collection('dm_invites'); }

// 当前在线用户（用于用户主页展示在线状态）
const onlineUsers = new Set();

async function connectDB() {
  await client.connect();
  db = client.db(DB_NAME);
  await usersCol().createIndex({ username: 1 }, { unique: true });
  await roomsCol().createIndex({ id: 1 }, { unique: true });
  await postsCol().createIndex({ id: 1 }, { unique: true });
  await dmInvitesCol().createIndex({ id: 1 }, { unique: true });
  await dmInvitesCol().createIndex({ to: 1, status: 1 });
  await messagesCol().createIndex({ roomId: 1, createdAt: 1 });
  // 阅后即焚：带 expireAt 的文档到期自动物理删除
  await messagesCol().createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  console.log('✅ MongoDB 连接成功');
}

// ---------- 中间件 ----------
app.use(express.json({ limit: '5mb' })); // 允许上传头像/背景图（base64）

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
});
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

function requireLogin(req, res, next) {
  if (req.session.user) next();
  else res.status(401).json({ error: '未登录' });
}

// ---------- 公共对象格式化 ----------
function publicRoom(room) {
  return {
    id: room.id,
    name: room.name,
    owner: room.owner,
    hasPassword: room.hasPassword,
    members: room.members || [],
    type: room.type || 'group'
  };
}

function publicPost(p) {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    author: p.author,
    comments: p.comments || [],
    createdAt: p.createdAt,
    // AI 打标字段（未配置/未完成时为 undefined，前端据此显示"待分类"或隐藏）
    tags: p.tags || [],
    quality: p.quality,
    aiVerdict: p.aiVerdict,
    aiStatus: p.aiStatus,
    aiSummary: p.aiSummary || ''
  };
}

function publicInvite(i) {
  return {
    id: i.id,
    from: i.from,
    to: i.to,
    message: i.message || '',
    status: i.status,
    createdAt: i.createdAt
  };
}

function cleanMessage(m) {
  return {
    username: m.username,
    text: m.text,
    time: m.time,
    burn: m.burn || null,
    expireAt: m.expireAt ? m.expireAt.getTime() : null
  };
}

// ============================================================
// 二、账号体系 API
// ============================================================

// 注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    if (!/^[\w\u4e00-\u9fa5]{2,20}$/.test(username)) {
      return res.status(400).json({ error: '用户名需为2-20位字母/数字/下划线/中文' });
    }
    if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });

    const passwordHash = await bcrypt.hash(password, 10);
    try {
      await usersCol().insertOne({
        username,
        passwordHash,
        avatar: null,
        bio: '',
        theme: 'ocean',
        chatBg: null,
        createdAt: new Date()
      });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: '该用户名已被注册' });
      throw e;
    }
    req.session.user = { username };
    res.json({ ok: true, user: { username } });
  } catch (e) {
    console.error('注册失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }
    const user = await usersCol().findOne({ username });
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });
    const ok = await bcrypt.compare(password || '', user.passwordHash);
    if (!ok) return res.status(401).json({ error: '用户名或密码错误' });

    req.session.user = { username };
    res.json({ ok: true, user: { username } });
  } catch (e) {
    console.error('登录失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 登出
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// 当前登录用户（含个性化资料）
app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

// 我的完整资料（头像/主题/背景等）
app.get('/api/me/profile', requireLogin, async (req, res) => {
  const u = await usersCol().findOne({ username: req.session.user.username });
  res.json({
    profile: {
      username: u.username,
      avatar: u.avatar || null,
      bio: u.bio || '',
      theme: u.theme || 'ocean',
      chatBg: u.chatBg || null,
      profileBg: u.profileBg || null,
      interests: u.interests || [],
      createdAt: u.createdAt || null
    }
  });
});

// 修改密码
app.post('/api/me/password', requireLogin, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
    const user = await usersCol().findOne({ username: req.session.user.username });
    const ok = await bcrypt.compare(oldPassword || '', user.passwordHash);
    if (!ok) return res.status(403).json({ error: '原密码错误' });
    await usersCol().updateOne(
      { username: user.username },
      { $set: { passwordHash: await bcrypt.hash(newPassword, 10) } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('修改密码失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新资料（头像/简介/主题/聊天背景/主页背景/兴趣标签）
app.post('/api/me/profile', requireLogin, async (req, res) => {
  try {
    const { avatar, bio, theme, chatBg, profileBg, interests } = req.body;
    const update = {};
    if (avatar !== undefined) {
      if (avatar === null) update.avatar = null;
      else if (typeof avatar === 'string') {
        if (avatar.length > 400000) return res.status(400).json({ error: '头像图片过大（需小于约300KB）' });
        update.avatar = avatar || null;
      }
    }
    if (typeof bio === 'string') {
      if (bio.length > 200) return res.status(400).json({ error: '简介最多 200 字' });
      update.bio = bio;
    }
    if (typeof theme === 'string' && THEMES.includes(theme)) update.theme = theme;
    if (Array.isArray(interests)) {
      const list = interests.map((s) => String(s).trim().slice(0, 12)).filter(Boolean).slice(0, 6);
      update.interests = list;
    }
    if (chatBg !== undefined) {
      if (chatBg === null) update.chatBg = null;
      else if (chatBg && typeof chatBg === 'object') {
        if (chatBg.type === 'preset' && typeof chatBg.value === 'string') update.chatBg = chatBg;
        if (chatBg.type === 'upload' && typeof chatBg.value === 'string' && chatBg.value.length <= 700000) {
          update.chatBg = chatBg;
        }
      }
    }
    // 主页背景：preset:id 渐变 或 dataURL 上传图片（≤700KB），null 恢复默认
    if (profileBg === null) {
      update.profileBg = null;
    } else if (typeof profileBg === 'string') {
      if (profileBg.startsWith('preset:')) {
        update.profileBg = profileBg;
      } else if (profileBg.length <= 700000) {
        update.profileBg = profileBg;
      }
    }
    await usersCol().updateOne({ username: req.session.user.username }, { $set: update });
    res.json({ ok: true });
  } catch (e) {
    console.error('更新资料失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 三、用户查找与主页
// ============================================================

// 搜索用户（供发私信找人）
app.get('/api/users/search', requireLogin, async (req, res) => {
  const rawQ = req.query.q;
  const q = (typeof rawQ === 'string' ? rawQ : '').trim();
  let filter = {};
  if (q) filter = { username: { $regex: escapeRegExp(q), $options: 'i' } };
  const list = await usersCol().find(filter).limit(20).toArray();
  res.json({
    users: list.map((u) => ({
      username: u.username,
      avatar: u.avatar || null,
      bio: u.bio || '',
      isOnline: onlineUsers.has(u.username)
    }))
  });
});

// 用户公开主页（含统计与 TA 的话题）
app.get('/api/users/:username', requireLogin, async (req, res) => {
  const u = await usersCol().findOne({ username: req.params.username });
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const postCount = await postsCol().countDocuments({ author: req.params.username });
  const posts = await postsCol()
    .find({ author: req.params.username })
    .sort({ createdAt: -1 })
    .limit(8)
    .toArray();
  const commentReceived = posts.reduce((sum, p) => sum + (p.comments || []).length, 0);
  res.json({
    user: {
      username: u.username,
      avatar: u.avatar || null,
      bio: u.bio || '',
      interests: u.interests || [],
      profileBg: u.profileBg || null,
      createdAt: u.createdAt || null,
      isOnline: onlineUsers.has(u.username),
      postCount,
      commentReceived
    },
    recentPosts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      commentCount: (p.comments || []).length,
      createdAt: p.createdAt,
      tags: p.tags || [],
      quality: p.quality,
      aiStatus: p.aiStatus
    }))
  });
});

// 删除帖子（作者本人 或 管理员）
app.delete('/api/posts/:id', requireLogin, async (req, res) => {
  try {
    const post = await postsCol().findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    const me = req.session.user.username;
    if (post.author !== me && me !== ADMIN_USER) {
      return res.status(403).json({ error: '只有作者或管理员可以删除' });
    }
    await postsCol().deleteOne({ id: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    console.error('删除帖子失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 四、私信申请
// ============================================================

// 发起私信申请
app.post('/api/users/:username/dm', requireLogin, async (req, res) => {
  try {
    const targetName = req.params.username;
    const myName = req.session.user.username;
    if (targetName === myName) return res.status(400).json({ error: '不能和自己私信' });
    const target = await usersCol().findOne({ username: targetName });
    if (!target) return res.status(404).json({ error: '用户不存在' });

    // 已有私信会话 → 直接进入
    const exist = await roomsCol().findOne({ type: 'dm', members: { $all: [myName, targetName] } });
    if (exist) return res.json({ ok: true, room: publicRoom(exist), already: true });

    // 已有待处理申请
    const pending = await dmInvitesCol().findOne({ from: myName, to: targetName, status: 'pending' });
    if (pending) return res.json({ ok: true, pending: true, invite: publicInvite(pending) });

    const invite = {
      id: crypto.randomBytes(4).toString('hex'),
      from: myName,
      to: targetName,
      message: String(req.body.message || '').slice(0, 100),
      status: 'pending',
      createdAt: new Date()
    };
    await dmInvitesCol().insertOne(invite);
    io.to('user:' + targetName).emit('dm_invite', { invite: publicInvite(invite) });
    res.json({ ok: true, invite: publicInvite(invite) });
  } catch (e) {
    console.error('发起私信失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 我收到的申请 + 我发出的待处理申请
app.get('/api/dm/invites', requireLogin, async (req, res) => {
  const username = req.session.user.username;
  const received = await dmInvitesCol()
    .find({ to: username, status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  const sent = await dmInvitesCol()
    .find({ from: username, status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  res.json({
    received: received.map(publicInvite),
    sent: sent.map(publicInvite)
  });
});

// 同意私信申请 → 创建私信会话房间
app.post('/api/dm/invites/:id/accept', requireLogin, async (req, res) => {
  try {
    const invite = await dmInvitesCol().findOne({
      id: req.params.id,
      to: req.session.user.username,
      status: 'pending'
    });
    if (!invite) return res.status(404).json({ error: '申请不存在或已处理' });

    const exist = await roomsCol().findOne({ type: 'dm', members: { $all: [invite.from, invite.to] } });
    let room = exist;
    if (!room) {
      room = {
        id: crypto.randomBytes(4).toString('hex'),
        type: 'dm',
        name: `${invite.from} & ${invite.to} 的私密会话`,
        owner: invite.from,
        hasPassword: false,
        members: [invite.from, invite.to],
        createdAt: new Date()
      };
      await roomsCol().insertOne(room);
    }
    await dmInvitesCol().updateOne({ id: invite.id }, { $set: { status: 'accepted' } });
    io.to('user:' + invite.from).emit('dm_accepted', { roomId: room.id });
    res.json({ ok: true, room: publicRoom(room) });
  } catch (e) {
    console.error('同意私信失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 拒绝私信申请
app.post('/api/dm/invites/:id/decline', requireLogin, async (req, res) => {
  try {
    await dmInvitesCol().updateOne(
      { id: req.params.id, to: req.session.user.username },
      { $set: { status: 'declined' } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('拒绝私信失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 我的私信会话列表
app.get('/api/dm/sessions', requireLogin, async (req, res) => {
  const username = req.session.user.username;
  const rooms = await roomsCol().find({ type: 'dm', members: username }).toArray();
  const sessions = [];
  for (const room of rooms) {
    const other = (room.members || []).find((m) => m !== username);
    const u = other ? await usersCol().findOne({ username: other }) : null;
    sessions.push({
      roomId: room.id,
      other: other || null,
      avatar: u ? u.avatar : null,
      isOnline: other ? onlineUsers.has(other) : false,
      lastTime: room.lastAt ? new Date(room.lastAt) : room.createdAt
    });
  }
  sessions.sort((a, b) => (b.lastTime ? b.lastTime.getTime() : 0) - (a.lastTime ? a.lastTime.getTime() : 0));
  res.json({ sessions });
});

// ============================================================
// 五、话题广场（帖子 + 评论 + AI 打标）
// ============================================================

// AI 异步打标签（不阻塞发帖响应；失败/未配置时静默降级）
async function tagPostAsync(postId, title, content) {
  try {
    const r = await ai.classifyPost({ title, content });
    if (!r) return; // AI 未配置或调用失败
    await postsCol().updateOne(
      { id: postId },
      {
        $set: {
          aiStatus: 'done',
          tags: r.tags,
          quality: r.quality,
          aiVerdict: r.verdict,
          aiSummary: r.summary
        }
      }
    );
    console.log(`[AI] 帖子 ${postId} 打标完成: ${r.tags.join('/')} Q${r.quality}`);
  } catch (e) {
    console.error('AI 打标签失败:', e.message);
    await postsCol().updateOne({ id: postId }, { $set: { aiStatus: 'failed' } });
  }
}

app.post('/api/posts', requireLogin, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || title.length > 60) return res.status(400).json({ error: '标题不能为空且不超过60字' });
    if (!content || content.length > 5000) return res.status(400).json({ error: '内容不能为空且不超过5000字' });
    const post = {
      id: crypto.randomBytes(4).toString('hex'),
      title,
      content,
      author: req.session.user.username,
      comments: [],
      createdAt: new Date(),
      aiStatus: ai.enabled() ? 'pending' : 'off' // off=未配AI key
    };
    await postsCol().insertOne(post);
    if (ai.enabled()) {
      tagPostAsync(post.id, title, content); // 异步打标，立即返回
    }
    res.json({ ok: true, post: publicPost(post) });
  } catch (e) {
    console.error('发帖失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/posts', requireLogin, async (req, res) => {
  const posts = await postsCol().find().sort({ createdAt: -1 }).limit(100).toArray();
  res.json({
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      author: p.author,
      commentCount: (p.comments || []).length,
      createdAt: p.createdAt,
      tags: p.tags || [],
      quality: p.quality,
      aiVerdict: p.aiVerdict,
      aiStatus: p.aiStatus
    }))
  });
});

app.get('/api/posts/:id', requireLogin, async (req, res) => {
  const post = await postsCol().findOne({ id: req.params.id });
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  res.json({ post: publicPost(post) });
});

app.post('/api/posts/:id/comments', requireLogin, async (req, res) => {
  try {
    const text = String(req.body.text || '').trim().slice(0, 500);
    if (!text) return res.status(400).json({ error: '评论不能为空' });
    const comment = {
      username: req.session.user.username,
      text,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      createdAt: new Date()
    };
    await postsCol().updateOne({ id: req.params.id }, { $push: { comments: comment } });
    res.json({ ok: true, comment });
  } catch (e) {
    console.error('评论失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 五·二、AI 智能接口（AI 版主 / 快捷回复）
// ============================================================

// AI 是否可用（前端据此显示/隐藏智能回复按钮等）
app.get('/api/ai/status', requireLogin, (req, res) => {
  res.json({ enabled: ai.enabled(), model: ai.enabled() ? ai.MODEL : null });
});

// 智能回复：根据最近聊天记录生成 3 条候选
app.post('/api/ai/replies', requireLogin, async (req, res) => {
  if (!ai.enabled()) return res.json({ enabled: false, replies: [] });
  try {
    const recent = Array.isArray(req.body.recent)
      ? req.body.recent.slice(-12).map((m) => ({
          username: String(m.username || '').slice(0, 30),
          text: String(m.text || '').slice(0, 300)
        }))
      : [];
    const replies = await ai.suggestReplies({ recent, myName: req.session.user.username });
    res.json({ enabled: true, replies: replies || [] });
  } catch (e) {
    console.error('智能回复失败:', e.message);
    res.json({ enabled: true, replies: [], error: '生成失败' });
  }
});

// ============================================================
// 六、房间管理 API
// ============================================================

// 创建群房间
app.post('/api/rooms', requireLogin, async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || name.length > 30) return res.status(400).json({ error: '房间名不能为空且不超过30字' });

    const room = {
      id: crypto.randomBytes(4).toString('hex'),
      type: 'group',
      name,
      owner: req.session.user.username,
      hasPassword: !!password,
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      members: [req.session.user.username],
      createdAt: new Date()
    };
    await roomsCol().insertOne(room);
    res.json({ ok: true, room: publicRoom(room) });
  } catch (e) {
    console.error('创建房间失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 我的群房间列表
app.get('/api/rooms', requireLogin, async (req, res) => {
  try {
    const username = req.session.user.username;
    const rooms = await roomsCol()
      .find({ members: username, type: { $ne: 'dm' } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ rooms: rooms.map(publicRoom) });
  } catch (e) {
    console.error('获取房间失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 加入房间
app.post('/api/rooms/:id/join', requireLogin, async (req, res) => {
  try {
    const room = await roomsCol().findOne({ id: req.params.id });
    if (!room) return res.status(404).json({ error: '房间不存在，请检查房间号' });

    if (room.hasPassword) {
      const ok = await bcrypt.compare(req.body.password || '', room.passwordHash);
      if (!ok) return res.status(403).json({ error: '房间密码错误' });
    }

    if (!(room.members || []).includes(req.session.user.username)) {
      await roomsCol().updateOne(
        { id: room.id },
        { $addToSet: { members: req.session.user.username } }
      );
      room.members.push(req.session.user.username);
    }
    res.json({ ok: true, room: publicRoom(room) });
  } catch (e) {
    console.error('加入房间失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 离开房间
app.post('/api/rooms/:id/leave', requireLogin, async (req, res) => {
  try {
    await roomsCol().updateOne(
      { id: req.params.id },
      { $pull: { members: req.session.user.username } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('离开房间失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 房间历史消息（最近 50 条，过滤已过期的阅后即焚消息）
app.get('/api/rooms/:id/messages', requireLogin, async (req, res) => {
  try {
    const room = await roomsCol().findOne({ id: req.params.id });
    if (!room) return res.status(404).json({ error: '房间不存在' });
    if (!(room.members || []).includes(req.session.user.username)) {
      return res.status(403).json({ error: '你不是该房间成员' });
    }
    let msgs = await messagesCol()
      .find({ roomId: room.id })
      .sort({ createdAt: 1 })
      .limit(50)
      .toArray();
    msgs = msgs.filter((m) => !m.expireAt || m.expireAt > new Date());
    res.json({ messages: msgs.map(cleanMessage) });
  } catch (e) {
    console.error('获取历史消息失败:', e);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 七、WebSocket 实时通信
// ============================================================
io.engine.use(sessionMiddleware);

io.on('connection', (socket) => {
  const username = socket.request.session?.user?.username;
  if (!username) {
    socket.disconnect();
    return;
  }
  socket.data.username = username;
  onlineUsers.add(username);
  socket.join('user:' + username); // 用于私信等定向推送
  console.log(`[连接] ${username}`);

  // 加入房间：校验成员资格，并加载历史消息
  socket.on('join_room', async (roomId) => {
    try {
      const room = await roomsCol().findOne({ id: roomId });
      if (!room || !(room.members || []).includes(username)) return;

      // 切换房间：先离开旧房间，避免同时收到两个房间的消息
      const prev = socket.data.roomId;
      if (prev && prev !== roomId) {
        socket.leave(prev);
        const prevRoom = await roomsCol().findOne({ id: prev });
        if (prevRoom) io.to(prev).emit('system', { text: `${username} 离开了房间` });
      }

      socket.join(roomId);
      socket.data.roomId = roomId;

      // 更新房间最近活跃时间
      await roomsCol().updateOne({ id: roomId }, { $set: { lastAt: new Date() } });

      // 只把历史消息发给当前进入的连接（过滤已过期的阅后即焚）
      let history = await messagesCol()
        .find({ roomId })
        .sort({ createdAt: 1 })
        .limit(50)
        .toArray();
      history = history.filter((m) => !m.expireAt || m.expireAt > new Date());
      socket.emit('history', { messages: history.map(cleanMessage) });

      io.to(roomId).emit('system', { text: `${username} 加入了房间` });
      io.to(roomId).emit('members_update', { members: room.members });
    } catch (e) {
      console.error('join_room 失败:', e);
    }
  });

  // 收到聊天消息 -> 存入 MongoDB（可选阅后即焚） -> 广播给房间所有人
  socket.on('chat_message', async (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const text = String(data?.text || '').trim().slice(0, 2000);
    if (!text) return;

    const burn = Math.min(parseInt(data?.burn, 10) || 0, 3600);
    const msg = {
      roomId,
      username,
      text,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      createdAt: new Date()
    };
    if (burn > 0) {
      msg.burn = burn;
      msg.expireAt = new Date(Date.now() + burn * 1000);
    }

    try {
      await messagesCol().insertOne(msg); // 保存历史（阅后即焚由 TTL 自动清理）
    } catch (e) {
      console.error('保存消息失败:', e);
    }

    io.to(roomId).emit('chat_message', {
      username,
      text,
      time: msg.time,
      burn: msg.burn || null,
      expireAt: msg.expireAt ? msg.expireAt.getTime() : null
    });
  });

  // 主动离开房间
  socket.on('leave_room', async () => {
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.leave(roomId);
      const room = await roomsCol().findOne({ id: roomId });
      if (room) io.to(roomId).emit('system', { text: `${username} 离开了房间` });
      socket.data.roomId = null;
    }
  });

  // 断开连接
  socket.on('disconnect', async () => {
    onlineUsers.delete(username);
    const roomId = socket.data.roomId;
    if (roomId) {
      const room = await roomsCol().findOne({ id: roomId });
      if (room) io.to(roomId).emit('system', { text: `${username} 断开了连接` });
    }
    console.log(`[断开] ${username}`);
  });
});

// ============================================================
// 八、启动
// ============================================================
server.listen(PORT, async () => {
  try {
    await connectDB();
  } catch (e) {
    console.error('❌ MongoDB 连接失败，请确认本机 MongoDB 已启动（端口 27017）');
    console.error(e.message);
    process.exit(1);
  }
  console.log('==============================================');
  console.log('  树洞已启动（MongoDB 版）');
  console.log(`  本机访问:   http://localhost:${PORT}`);
  console.log(`  局域网访问: http://<你的电脑IP>:${PORT}`);
  console.log('==============================================');
});
