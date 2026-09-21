/* 一次性种子脚本：
   1) 创建管理员账号 admin（如不存在）
   2) 清空广场测试残留帖子
   3) 预置一批贴合产品定位的优质话题（作者 admin，直接带 AI 打标结果，无需等待） */
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const MONGODB_URL = 'mongodb://127.0.0.1:27017';
const DB = 'private_chat';
const ADMIN = 'admin';
const ADMIN_PASS = 'admin123';

const seedPosts = [
  {
    title: '深夜话题：你有多久没和陌生人好好聊过天了？',
    content: '现代人聊天很多，但大多停留在"在吗/哈哈/好的"。上一次和一个陌生人真诚地、不带目的地聊上一个小时，是什么时候的事？\n\n在这个越来越快的世界里，我想给"慢下来好好聊天"留一个位置。如果你也这么想，欢迎留言，或者直接申请和我私聊。',
    tags: ['讨论', '深度分析'], quality: 88, verdict: '深度分析'
  },
  {
    title: '私密空间使用心法：如何让一场私聊不尴尬、有深度',
    content: '用这个产品有一阵了，分享几条让私聊质量更高的心得：\n\n1. 开场别问"在吗"，直接抛出你看到对方的话题/主页里感兴趣的点；\n2. 一次只聊一个话题，聊透再换；\n3. 遇到说不清的情绪，直接说"我现在需要的是倾听"；\n4. 聊完觉得投缘，主动约下一次。\n\n欢迎补充你的心得。',
    tags: ['经验分享', '讨论'], quality: 90, verdict: '经验分享'
  },
  {
    title: '打工人 vs 学生党：你们的睡前 1 小时都在做什么？',
    content: '睡前 1 小时，是最容易暴露一个人状态的时间。\n\n打工人：报复性刷手机？\n学生党：赶作业/打游戏/躺平刷视频？\n\n评论区说说你的睡前 1 小时，看看有没有和你一样的人。',
    tags: ['讨论', '情绪宣泄'], quality: 78, verdict: '讨论'
  },
  {
    title: '想要被倾听的时候，你一般会怎么做？',
    content: '有些话憋在心里很难受，但打开通讯录，又不知道该发给谁。\n\n想要被倾听的时候，你会：A. 硬扛 B. 找朋友 C. 写下来 D. 找陌生人倾诉？\n\n说说你的答案和原因，也欢迎直接私信我聊聊。',
    tags: ['求助', '情绪宣泄'], quality: 82, verdict: '求助'
  },
  {
    title: '如果 AI 帮你筛选出"真正值得聊的人"，你想聊什么？',
    content: '广场现在有 AI 版主：给帖子自动打标签、筛出高质量内容、甚至在你聊天时生成回复建议。\n\n如果 AI 能更进一步——根据你的兴趣帮你匹配"值得深聊的人"，你最想和对方聊什么？\n\n评论区聊聊，说不定能遇到你的同好。',
    tags: ['讨论', '深度分析'], quality: 86, verdict: '深度分析'
  },
  {
    title: '「树洞」说出你今天最想被听见的一句话',
    content: '这里是树洞。\n\n把今天最想被听见的那句话留在这里吧——可以是委屈、是开心、是困惑，也可以只是一句"今天有点累"。\n\n会有人认真读，也可能有人私信你聊聊。',
    tags: ['情绪宣泄', '求助'], quality: 80, verdict: '情绪宣泄'
  }
];

(async () => {
  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  const db = client.db(DB);
  const users = db.collection('users');
  const posts = db.collection('posts');

  // 1) 管理员账号
  let admin = await users.findOne({ username: ADMIN });
  if (!admin) {
    await users.insertOne({
      username: ADMIN,
      passwordHash: await bcrypt.hash(ADMIN_PASS, 10),
      bio: '私密空间管理员 · 负责广场内容维护与秩序',
      avatar: null,
      theme: 'ocean',
      chatBg: null,
      createdAt: new Date()
    });
    console.log('✅ 管理员账号已创建:', ADMIN, '/', ADMIN_PASS);
  } else {
    console.log('ℹ️ 管理员账号已存在');
  }

  // 2) 清空广场测试残留帖子
  const before = await posts.countDocuments({});
  const del = await posts.deleteMany({});
  console.log('🗑 清理广场帖子:', before, '→ 删除', del.deletedCount);

  // 3) 预置优质内容（错开发布时间）
  for (let i = 0; i < seedPosts.length; i++) {
    const p = seedPosts[i];
    await posts.insertOne({
      id: crypto.randomBytes(4).toString('hex'),
      title: p.title,
      content: p.content,
      author: ADMIN,
      comments: [],
      createdAt: new Date(Date.now() - (i * 3 + 1) * 3600 * 1000), // 每篇间隔约3小时
      aiStatus: 'done',
      tags: p.tags,
      quality: p.quality,
      aiVerdict: p.verdict
    });
  }
  console.log('🌱 已预置', seedPosts.length, '条优质话题（作者:', ADMIN, '）');
  const after = await posts.countDocuments({});
  console.log('📊 广场当前帖子数:', after);

  await client.close();
  console.log('✅ 种子脚本完成');
})().catch((e) => { console.error('❌ 种子脚本失败:', e.message); process.exit(1); });
