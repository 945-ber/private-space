/**
 * 树洞 —— 数据迁移脚本：本机 MongoDB → MongoDB Atlas
 *
 * 用法：
 *   node migrate.js "mongodb+srv://用户名:密码@集群地址.mongodb.net"
 *
 * 说明：
 *   - 源库：本机 127.0.0.1:27017 / private_chat
 *   - 目标库：Atlas 上的同名库 private_chat（迁移前会清空目标这几个集合，以本机数据为准）
 *   - 迁移完成会重建索引，与 server.js 启动时的建索引保持一致
 */

const { MongoClient } = require('mongodb');

const SRC_URL = 'mongodb://127.0.0.1:27017';
const DST_URL = process.argv[2];
const DB_NAME = 'private_chat';
const COLLECTIONS = ['users', 'posts', 'rooms', 'messages', 'dm_invites'];

if (!DST_URL) {
  console.error('用法: node migrate.js "<Atlas连接串>"');
  process.exit(1);
}

(async () => {
  const src = new MongoClient(SRC_URL, { connectTimeoutMS: 10000 });
  const dst = new MongoClient(DST_URL, { connectTimeoutMS: 30000 });
  await src.connect();
  console.log('✔ 已连接本机 MongoDB');
  await dst.connect();
  console.log('✔ 已连接 MongoDB Atlas');

  const sdb = src.db(DB_NAME);
  const ddb = dst.db(DB_NAME);
  let total = 0;

  for (const c of COLLECTIONS) {
    const docs = await sdb.collection(c).find({}).toArray();
    const col = ddb.collection(c);
    await col.deleteMany({});                 // 目标集合清空，以本机为准
    if (docs.length) {
      await col.insertMany(docs, { ordered: false });
    }
    console.log(`✔ ${c}: ${docs.length} 条`);
    total += docs.length;
  }

  // 重建索引（与 server.js 的 connectDB 保持一致）
  await ddb.collection('users').createIndex({ username: 1 }, { unique: true });
  await ddb.collection('rooms').createIndex({ id: 1 }, { unique: true });
  await ddb.collection('posts').createIndex({ id: 1 }, { unique: true });
  const invites = ddb.collection('dm_invites');
  await invites.createIndex({ id: 1 }, { unique: true });
  await invites.createIndex({ to: 1, status: 1 });
  const msgs = ddb.collection('messages');
  await msgs.createIndex({ roomId: 1, createdAt: 1 });
  await msgs.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });

  console.log(`✔ 索引重建完成，迁移共 ${total} 条文档`);
  await src.close();
  await dst.close();
  console.log('迁移完成，可以关掉本机 MongoDB 了（可选）');
})().catch((e) => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
