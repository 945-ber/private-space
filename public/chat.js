/**
 * 树洞 —— 前端逻辑
 * 覆盖：话题广场 / 群房间 / 私信申请 / 用户主页 / 个性化设置 / 阅后即焚 / 主题切换
 */

// ========== 全局状态 ==========
let socket = null;        // Socket.IO 连接（全局唯一）
let socketReady = false;
let me = null;            // 当前用户完整资料
let myName = null;
let currentRoom = null;   // 当前聊天房间（group / dm）
let currentNav = 'square';
let currentPost = null;   // 当前查看的帖子
let createMode = 'create';
let toastTimer = null;
let aiEnabled = false;    // AI 版主/智能回复是否可用
let allPosts = [];        // 广场帖子缓存（供标签筛选）
let postFilter = 'all';   // 广场筛选：all / 深度分析 / 经验分享 / 求助 / 情绪宣泄 / high

const $ = (id) => document.getElementById(id);

// ========== 国际化（多语言） ==========
const LANGS = ['zh', 'en', 'fr', 'de'];
const I18N = {
  zh: {
    appName:'树洞', 'nav.square':'广场', 'nav.rooms':'房间', 'nav.dms':'私信', 'nav.me':'我的', 'nav.system':'系统', 'nav.logout':'退出', 'nav.settings':'设置',
    'panel.square':'话题广场', 'panel.rooms':'我的房间', 'panel.dms':'私信', 'panel.me':'我的空间', 'panel.system':'系统设置',
    'btn.newPost':'＋ 发帖', 'btn.createRoom':'＋ 创建房间', 'btn.joinRoom':'🔑 加入房间', 'btn.findUser':'＋ 找人', 'btn.leave':'离开', 'btn.send':'发送', 'btn.confirm':'确定', 'btn.cancel':'取消', 'btn.publish':'发布',
    'ph.joinId':'输入房间号，回车加入', 'ph.roomName':'给你的房间起个名字', 'ph.roomPass':'设置访问密码', 'ph.roomId':'8位房间号', 'ph.message':'输入消息，回车发送...', 'ph.postTitle':'想聊点什么？', 'ph.postContent':'写下你的想法...',
    'modal.createTitle':'创建房间', 'modal.roomName':'房间名称', 'modal.roomPass':'房间密码（可选，留空则无需密码）', 'modal.roomId':'房间号（加入时填写）', 'modal.postTitle':'发布话题', 'modal.postTitleLabel':'标题（≤60字）', 'modal.postContentLabel':'内容（≤5000字）',
    'ai.helper':'🤖 AI 小助手', 'ai.smartReply':'✨ 智能回复', 'burn.normal':'普通', 'burn.sec':'秒',
    'welcome.title':'欢迎来到树洞', 'welcome.l1':'在「广场」发现有意思的话题和同好', 'welcome.l2':'点开感兴趣的人 → 申请私密交流', 'welcome.l3':'或创建 / 加入专属房间实时畅聊',
    'sys.lang':'语言 / Language', 'sys.changelog':'更新说明',
    'me.profile':'个人资料', 'me.profileSub':'头像 · 简介 · 兴趣标签', 'me.theme':'主题皮肤', 'me.themeSub':'四套配色自由切换', 'me.chatBg':'聊天背景', 'me.chatBgSub':'渐变或自定义图片', 'me.password':'修改密码', 'me.passwordSub':'定期更换更安全', 'me.descPlaceholder':'点击编辑头像与简介，让别人更想认识你', 'me.adminBadge':'管理员',
    'set.profile':'个人资料', 'set.theme':'主题皮肤', 'set.background':'聊天背景', 'set.password':'修改密码',
    'theme.ocean':'海洋青绿', 'theme.dark':'午夜暗黑', 'theme.sunset':'日落暖橙', 'theme.nebula':'星空幻紫',
    'filter.all':'全部', 'filter.deep':'🧠 深度', 'filter.exp':'📚 经验', 'filter.help':'🆘 求助', 'filter.emo':'💭 情绪', 'filter.high':'⭐ 高质量',
    'room.dmSession':'私密会话', 'room.info':'房间号 {id} · {n} 人',
    'toast.fast':'操作太快啦，稍等片刻再切换～', 'toast.tooFast':'操作太快啦，稍等片刻～', 'toast.langOk':'已切换语言'
  },
  en: {
    appName:'Tree Hole', 'nav.square':'Square', 'nav.rooms':'Rooms', 'nav.dms':'Messages', 'nav.me':'Me', 'nav.system':'System', 'nav.logout':'Log out', 'nav.settings':'Settings',
    'panel.square':'Topics', 'panel.rooms':'My Rooms', 'panel.dms':'Messages', 'panel.me':'My Space', 'panel.system':'System',
    'btn.newPost':'＋ New post', 'btn.createRoom':'＋ Create room', 'btn.joinRoom':'🔑 Join room', 'btn.findUser':'＋ Find', 'btn.leave':'Leave', 'btn.send':'Send', 'btn.confirm':'Confirm', 'btn.cancel':'Cancel', 'btn.publish':'Publish',
    'ph.joinId':'Enter room id, press Enter to join', 'ph.roomName':'Name your room', 'ph.roomPass':'Set a password', 'ph.roomId':'8-digit room id', 'ph.message':'Type a message, Enter to send...', 'ph.postTitle':'What do you want to talk about?', 'ph.postContent':'Write your thoughts...',
    'modal.createTitle':'Create Room', 'modal.roomName':'Room name', 'modal.roomPass':'Password (optional)', 'modal.roomId':'Room id (for joining)', 'modal.postTitle':'New Topic', 'modal.postTitleLabel':'Title (≤60 chars)', 'modal.postContentLabel':'Content (≤5000 chars)',
    'ai.helper':'🤖 AI Assistant', 'ai.smartReply':'✨ Smart reply', 'burn.normal':'Normal', 'burn.sec':'s',
    'welcome.title':'Welcome to Tree Hole', 'welcome.l1':'Find interesting topics in the Square', 'welcome.l2':'Open someone\u2019s profile → request a private chat', 'welcome.l3':'Or create / join a private room to chat live',
    'sys.lang':'Language', 'sys.changelog':'Changelog',
    'me.profile':'Profile', 'me.profileSub':'Avatar · Bio · Interests', 'me.theme':'Theme', 'me.themeSub':'4 color themes', 'me.chatBg':'Chat background', 'me.chatBgSub':'Gradient or image', 'me.password':'Change password', 'me.passwordSub':'Stay secure', 'me.descPlaceholder':'Click to edit avatar and bio', 'me.adminBadge':'Admin',
    'set.profile':'Profile', 'set.theme':'Theme', 'set.background':'Chat background', 'set.password':'Change password',
    'theme.ocean':'Ocean', 'theme.dark':'Midnight', 'theme.sunset':'Sunset', 'theme.nebula':'Nebula',
    'filter.all':'All', 'filter.deep':'🧠 Deep', 'filter.exp':'📚 Experience', 'filter.help':'🆘 Help', 'filter.emo':'💭 Emotion', 'filter.high':'⭐ Top',
    'room.dmSession':'Private chat', 'room.info':'Room {id} · {n} people',
    'toast.fast':'Too fast, take a breath～', 'toast.tooFast':'Too fast, take a breath～', 'toast.langOk':'Language switched'
  },
  fr: {
    appName:'Trou d\u2019arbre', 'nav.square':'Place', 'nav.rooms':'Chambres', 'nav.dms':'Messages', 'nav.me':'Profil', 'nav.system':'Syst\u00e8me', 'nav.logout':'D\u00e9connexion', 'nav.settings':'R\u00e9glages',
    'panel.square':'Sujets', 'panel.rooms':'Mes chambres', 'panel.dms':'Messages', 'panel.me':'Mon espace', 'panel.system':'Syst\u00e8me',
    'btn.newPost':'＋ Nouveau sujet', 'btn.createRoom':'＋ Cr\u00e9er une chambre', 'btn.joinRoom':'🔑 Rejoindre', 'btn.findUser':'＋ Chercher', 'btn.leave':'Quitter', 'btn.send':'Envoyer', 'btn.confirm':'Confirmer', 'btn.cancel':'Annuler', 'btn.publish':'Publier',
    'ph.joinId':'Entrer un n\u00b0 de chambre', 'ph.roomName':'Nommez votre chambre', 'ph.roomPass':'D\u00e9finir un mot de passe', 'ph.roomId':'N\u00b0 \u00e0 8 chiffres', 'ph.message':'Saisir un message, Entr\u00e9e pour envoyer...', 'ph.postTitle':'De quoi parler ?', 'ph.postContent':'\u00c9crivez vos pens\u00e9es...',
    'modal.createTitle':'Cr\u00e9er une chambre', 'modal.roomName':'Nom de la chambre', 'modal.roomPass':'Mot de passe (optionnel)', 'modal.roomId':'N\u00b0 de chambre', 'modal.postTitle':'Nouveau sujet', 'modal.postTitleLabel':'Titre (\u226460 car.)', 'modal.postContentLabel':'Contenu (\u22645000 car.)',
    'ai.helper':'🤖 Assistant IA', 'ai.smartReply':'✨ R\u00e9ponse maligne', 'burn.normal':'Normal', 'burn.sec':'s',
    'welcome.title':'Bienvenue dans le Trou d\u2019arbre', 'welcome.l1':'D\u00e9couvrez des sujets int\u00e9ressants', 'welcome.l2':'Ouvrez un profil → demandez un chat priv\u00e9', 'welcome.l3':'Ou cr\u00e9ez / rejoignez une chambre priv\u00e9e',
    'sys.lang':'Langue', 'sys.changelog':'Journal des versions',
    'me.profile':'Profil', 'me.profileSub':'Avatar · Bio · Centres d\u2019int\u00e9r\u00eat', 'me.theme':'Th\u00e8me', 'me.themeSub':'4 couleurs', 'me.chatBg':'Arri\u00e8re-plan', 'me.chatBgSub':'D\u00e9grad\u00e9 ou image', 'me.password':'Changer le mot de passe', 'me.passwordSub':'Restez s\u00e9curis\u00e9', 'me.descPlaceholder':'Cliquez pour modifier', 'me.adminBadge':'Admin',
    'set.profile':'Profil', 'set.theme':'Th\u00e8me', 'set.background':'Arri\u00e8re-plan', 'set.password':'Mot de passe',
    'theme.ocean':'Oc\u00e9an', 'theme.dark':'Minuit', 'theme.sunset':'Coucher de soleil', 'theme.nebula':'N\u00e9buleuse',
    'filter.all':'Tous', 'filter.deep':'🧠 Profond', 'filter.exp':'📚 Exp\u00e9rience', 'filter.help':'🆘 Aide', 'filter.emo':'💭 \u00c9motion', 'filter.high':'⭐ Top',
    'room.dmSession':'Conversation priv\u00e9e', 'room.info':'Chambre {id} · {n} pers.',
    'toast.fast':'Trop rapide, respirez～', 'toast.tooFast':'Trop rapide, respirez～', 'toast.langOk':'Langue chang\u00e9e'
  },
  de: {
    appName:'Baumloch', 'nav.square':'Platz', 'nav.rooms':'R\u00e4ume', 'nav.dms':'Nachrichten', 'nav.me':'Ich', 'nav.system':'System', 'nav.logout':'Abmelden', 'nav.settings':'Einstellungen',
    'panel.square':'Themen', 'panel.rooms':'Meine R\u00e4ume', 'panel.dms':'Nachrichten', 'panel.me':'Mein Bereich', 'panel.system':'System',
    'btn.newPost':'＋ Neuer Beitrag', 'btn.createRoom':'＋ Raum erstellen', 'btn.joinRoom':'🔑 Beitreten', 'btn.findUser':'＋ Suchen', 'btn.leave':'Verlassen', 'btn.send':'Senden', 'btn.confirm':'Best\u00e4tigen', 'btn.cancel':'Abbrechen', 'btn.publish':'Ver\u00f6ffentlichen',
    'ph.joinId':'Raumnummer eingeben, Enter zum Beitreten', 'ph.roomName':'Name deinen Raum', 'ph.roomPass':'Passwort festlegen', 'ph.roomId':'8-stellige Raumnummer', 'ph.message':'Nachricht eingeben, Enter zum Senden...', 'ph.postTitle':'Wor\u00fcber m\u00f6chtest du reden?', 'ph.postContent':'Schreibe deine Gedanken...',
    'modal.createTitle':'Raum erstellen', 'modal.roomName':'Raumname', 'modal.roomPass':'Passwort (optional)', 'modal.roomId':'Raumnummer', 'modal.postTitle':'Neues Thema', 'modal.postTitleLabel':'Titel (\u226460 Zeichen)', 'modal.postContentLabel':'Inhalt (\u22645000 Zeichen)',
    'ai.helper':'🤖 KI-Assistent', 'ai.smartReply':'✨ Intelligente Antwort', 'burn.normal':'Normal', 'burn.sec':'s',
    'welcome.title':'Willkommen im Baumloch', 'welcome.l1':'Finde interessante Themen auf dem Platz', 'welcome.l2':'\u00d6ffne ein Profil → bitte um privaten Chat', 'welcome.l3':'Oder erstelle / tritt einem privaten Raum bei',
    'sys.lang':'Sprache', 'sys.changelog':'Versionsprotokoll',
    'me.profile':'Profil', 'me.profileSub':'Avatar · Bio · Interessen', 'me.theme':'Design', 'me.themeSub':'4 Farbthemen', 'me.chatBg':'Chat-Hintergrund', 'me.chatBgSub':'Verlauf oder Bild', 'me.password':'Passwort \u00e4ndern', 'me.passwordSub':'Bleib sicher', 'me.descPlaceholder':'Klicken zum Bearbeiten', 'me.adminBadge':'Admin',
    'set.profile':'Profil', 'set.theme':'Design', 'set.background':'Chat-Hintergrund', 'set.password':'Passwort \u00e4ndern',
    'theme.ocean':'Ozean', 'theme.dark':'Mitternacht', 'theme.sunset':'Sonnenuntergang', 'theme.nebula':'Nebel',
    'filter.all':'Alle', 'filter.deep':'🧠 Tief', 'filter.exp':'📚 Erfahrung', 'filter.help':'🆘 Hilfe', 'filter.emo':'💭 Emotion', 'filter.high':'⭐ Top',
    'room.dmSession':'Privater Chat', 'room.info':'Raum {id} · {n} Personen',
    'toast.fast':'Zu schnell, atme durch～', 'toast.tooFast':'Zu schnell, atme durch～', 'toast.langOk':'Sprache gewechselt'
  }
};
let lang = localStorage.getItem('sd_lang') || 'zh';
function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.zh[key] || key; }
function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  document.documentElement.lang = lang;
  if (currentNav === 'me') renderMe();
  if (currentNav === 'square') renderPostFilter();
  const sub = $('room-sub');
  if (sub && currentRoom) renderRoomSub();
}
function setLang(l) {
  lang = l;
  localStorage.setItem('sd_lang', l);
  applyLang();
  document.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === l));
  toast(t('toast.langOk'));
}
// 版本更迭说明（简洁版）
const CHANGELOG = [
  ['v1', '基础上线：账号注册登录、私密房间实时聊天、私信'],
  ['v2', '话题广场：发帖、回帖、点赞讨论'],
  ['v3', '个性化：主题皮肤、自定义头像、聊天背景'],
  ['v4', 'AI 版主：帖子自动打标、智能回复建议'],
  ['v5', '移动端适配 + 专属 LOGO'],
  ['v6', '登录动画、个人主页重构、管理员账号'],
  ['v7', '欢迎动画、页面转场、「我的」页升级'],
  ['v8', '修复房间创建与退出、移动端适配、性能优化'],
  ['v9', '修复主题与聊天背景、自定义主页封面、防连点'],
  ['v10', '更名「树洞」、新增系统设置（多语言）、安全加固']
];
function renderSystem() {
  const el = $('changelog');
  el.innerHTML = CHANGELOG.map(([v, txt]) => `<div class="cl-item"><span class="cl-ver">${v}</span><span class="cl-txt">${txt}</span></div>`).join('');
  document.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
}
function renderRoomSub() {
  if (!currentRoom) return;
  $('room-sub').textContent = currentRoom.type === 'dm'
    ? t('room.dmSession')
    : t('room.info').replace('{id}', currentRoom.id).replace('{n}', currentRoom.members ? currentRoom.members.length : '?');
}

// ========== 工具函数 ==========
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const AVATAR_COLORS = ['#0f766e', '#6d28d9', '#c2410c', '#0ea5e9', '#be185d', '#4d7c0f', '#7c3aed', '#b45309'];

function avatarHtml(name, avatar, cls) {
  const c = AVATAR_COLORS[(name || '?').length % AVATAR_COLORS.length];
  const av = avatar
    ? `style="background-image:url('${avatar}')"`
    : `style="background:${c}"`;
  const ch = avatar ? '' : escapeHtml((name || '?')[0].toUpperCase());
  return `<div class="avatar ${cls || 'sm'}" ${av}>${ch}</div>`;
}

function readImage(file, maxSize, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function scrollToBottom() {
  const box = $('messages');
  box.scrollTop = box.scrollHeight;
}

function showView(id, anim) {
  ['view-chat', 'view-post', 'view-profile', 'view-settings', 'view-finduser', 'view-welcome']
    .forEach((v) => {
      const el = $(v);
      el.classList.remove('view-enter', 'view-pop');
      el.classList.add('hidden');
    });
  const el = $(id);
  el.classList.remove('hidden');
  const cls = anim || 'view-enter';
  el.classList.remove(cls);
  void el.offsetWidth; // 触发 reflow 重放动画
  el.classList.add(cls);
}

function closeModal(id) {
  $(id).classList.add('hidden');
}

// ========== 移动端响应式 ==========
function isMobile() {
  return window.innerWidth <= 768;
}

// 移动端进入"内容页"（聊天/详情/设置等全屏显示，列表隐藏）
function showContent(title, useChatHeader) {
  if (!isMobile()) return;
  document.body.classList.add('m-content');
  $('mobile-top').classList.toggle('hidden', !!useChatHeader);
  if (title) $('mobile-top-title').textContent = title;
}

// 移动端返回：退出内容页回到列表
function mobileBack() {
  if (currentRoom) {
    leaveRoom();
    return;
  }
  document.body.classList.remove('m-content');
  $('mobile-top').classList.remove('hidden');
}

// ========== 初始化 ==========
(async function init() {
  const meRes = await fetch('/api/me', { credentials: 'include' });
  const meData = await meRes.json();
  if (!meData.user) { location.href = 'index.html'; return; }
  myName = meData.user.username;

  const pRes = await fetch('/api/me/profile', { credentials: 'include' });
  const pData = await pRes.json();
  me = pData.profile || { username: myName, avatar: null, bio: '', theme: 'ocean', chatBg: null };
  applyTheme(me.theme);
  renderNavUser();
  ensureSocket();
  loadDmBadge();
  checkAi();
  applyLang();
  switchNav('square');
})();

function renderNavUser() {
  $('nav-username').textContent = me.username;
  $('nav-avatar').innerHTML = avatarHtml(me.username, me.avatar, 'md');
}

// ========== Socket 统一管理 ==========
function ensureSocket() {
  if (socket) return;
  socket = io();

  socket.on('connect', () => {
    socketReady = true;
    if (currentRoom) socket.emit('join_room', currentRoom.id);
  });

  socket.on('history', (data) => {
    const msgs = data.messages || [];
    if (msgs.length) {
      addSystemMsg(`—— 加载到 ${msgs.length} 条历史消息 ——`);
      msgs.forEach((m) => addChatMsg(m.username, m.text, m.time, m.username === myName, m.burn, m.expireAt));
    } else {
      addSystemMsg('暂无历史消息，快来发第一条吧');
    }
  });

  socket.on('chat_message', (msg) => {
    addChatMsg(msg.username, msg.text, msg.time, msg.username === myName, msg.burn, msg.expireAt);
  });

  socket.on('system', (info) => addSystemMsg(info.text));

  socket.on('members_update', (info) => {
    if (currentRoom) {
      currentRoom.members = info.members;
      renderRoomSub();
    }
  });

  // 私信通知
  socket.on('dm_invite', (data) => {
    toast(`收到来自 ${data.invite.from} 的私信申请`);
    loadDmBadge();
    if (currentNav === 'dms') loadDms();
  });
  socket.on('dm_accepted', () => {
    toast('对方已同意你的私信申请');
    loadDmBadge();
    if (currentNav === 'dms') loadDms();
  });

  socket.on('disconnect', () => {
    socketReady = false;
    if (currentRoom) addSystemMsg('连接已断开，正在重连...');
  });
  socket.on('reconnect', () => {
    socketReady = true;
    if (currentRoom) {
      socket.emit('join_room', currentRoom.id);
      addSystemMsg('已重新连接');
    }
  });
}

async function loadDmBadge() {
  try {
    const res = await fetch('/api/dm/invites', { credentials: 'include' });
    const data = await res.json();
    const n = (data.received || []).length;
    const badge = $('dm-badge');
    badge.textContent = n > 99 ? '99+' : n;
    badge.classList.toggle('hidden', n === 0);
  } catch (e) { /* ignore */ }
}

// ========== 导航切换（带 300ms 冷却，防止急躁用户连点卡顿） ==========
let navCooldownUntil = 0;
function switchNav(view) {
  const now = Date.now();
  if (now < navCooldownUntil) {
    toast(t('toast.fast'));
    return;
  }
  navCooldownUntil = now + 300;
  currentNav = view;
  // 移动端：切 tab 回到列表
  document.body.classList.remove('m-content');
  $('mobile-top').classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  ['square', 'rooms', 'dms', 'me', 'system'].forEach((v) => {
    $('panel-' + v).classList.toggle('hidden', v !== view);
  });
  // 面板切换动画
  const panel = $('panel-' + view);
  panel.classList.remove('panel-enter');
  void panel.offsetWidth;
  panel.classList.add('panel-enter');
  if (view === 'square') loadPosts();
  else if (view === 'rooms') loadRooms();
  else if (view === 'dms') { loadDms(); loadDmBadge(); }
  else if (view === 'me') renderMe();
  else if (view === 'system') renderSystem();
}

// ========== 话题广场 ==========
async function loadPosts() {
  const res = await fetch('/api/posts', { credentials: 'include' });
  const data = await res.json();
  allPosts = data.posts || [];
  renderPostFilter();
  renderPostList();
}

// 筛选条（AI 版主标签）
function renderPostFilter() {
  const chips = [
    ['all', t('filter.all')],
    ['深度分析', t('filter.deep')],
    ['经验分享', t('filter.exp')],
    ['求助', t('filter.help')],
    ['情绪宣泄', t('filter.emo')],
    ['high', t('filter.high')]
  ];
  $('post-filter').innerHTML = chips.map(([v, label]) =>
    `<span class="filter-chip ${postFilter === v ? 'active' : ''}" onclick="setPostFilter('${v}')">${label}</span>`
  ).join('');
}

function setPostFilter(v) {
  postFilter = v;
  renderPostFilter();
  renderPostList();
}

function renderPostList() {
  const el = $('post-list');
  el.innerHTML = '';
  let list = allPosts.slice();
  if (postFilter !== 'all') {
    if (postFilter === 'high') list = list.filter((p) => p.aiVerdict === 'high');
    else list = list.filter((p) => (p.tags || []).includes(postFilter));
  }
  // 高质量优先（AI 打完标才有 quality，未打标排后面）
  list.sort((a, b) => {
    const qa = typeof a.quality === 'number' ? a.quality : -1;
    const qb = typeof b.quality === 'number' ? b.quality : -1;
    return qb - qa;
  });
  if (!list.length) {
    el.innerHTML = '<div class="empty-tip">这个分类下还没有帖子<br>去「＋ 发帖」开启第一帖</div>';
    return;
  }
  list.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'list-item' + (p.aiVerdict === 'low' ? ' low-quality' : '');
    let tagHtml = '';
    if (p.aiStatus === 'pending') {
      tagHtml = '<span class="post-tag">⏳ AI分析中</span>';
    } else if (p.tags && p.tags.length) {
      tagHtml = p.tags.map((t) =>
        `<span class="post-tag ${p.aiVerdict === 'high' ? 'high' : p.aiVerdict === 'low' ? 'low' : ''}">${escapeHtml(t)}</span>`
      ).join('');
    }
    const canDel = myName === p.author || myName === 'admin';
    item.innerHTML = `
      <div class="info">
        <div class="name">${escapeHtml(p.title)}</div>
        <div class="desc">${escapeHtml(p.author)} · 💬 ${p.commentCount} · ${fmtDate(p.createdAt)}</div>
        ${tagHtml ? `<div class="post-tags">${tagHtml}</div>` : ''}
      </div>
      ${canDel ? `<button class="post-del" onclick="event.stopPropagation();deletePost('${p.id}')" title="删除此帖">✕</button>` : ''}`;
    item.onclick = () => openPost(p.id);
    el.appendChild(item);
  });
}

// 删除帖子（作者本人或管理员）
async function deletePost(id) {
  if (!confirm('确定删除这条帖子吗？删除后不可恢复。')) return;
  const res = await fetch('/api/posts/' + id, { method: 'DELETE', credentials: 'include' });
  const data = await res.json();
  if (data.ok) {
    toast('帖子已删除');
    loadPosts();
    if (currentPost && currentPost.id === id) {
      currentPost = null;
      showView('view-welcome');
      document.body.classList.remove('m-content');
      $('mobile-top').classList.remove('hidden');
    }
  } else {
    toast(data.error || '删除失败');
  }
}

function openNewPost() {
  $('post-title').value = '';
  $('post-content').value = '';
  $('post-modal').classList.remove('hidden');
}

async function submitPost() {
  const title = $('post-title').value.trim();
  const content = $('post-content').value.trim();
  if (!title) return toast('请填写标题');
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, content })
  });
  const data = await res.json();
  if (data.ok) {
    closeModal('post-modal');
    toast('发布成功');
    loadPosts();
    scheduleAiPoll();
  } else {
    toast(data.error || '发布失败');
  }
}

// AI 打标轮询：仅当广场仍有 pending 帖才继续，最多 4 次，避免频繁重渲染拖慢页面
let aiPollTimer = null;
function scheduleAiPoll() {
  if (aiPollTimer) return;
  let tries = 0;
  const steps = [6000, 18000, 32000, 50000];
  const step = async () => {
    await loadPosts();
    tries++;
    const stillPending = (allPosts || []).some((p) => p.aiStatus === 'pending');
    if (stillPending && tries < steps.length) {
      aiPollTimer = setTimeout(step, steps[tries]);
    } else {
      aiPollTimer = null;
    }
  };
  aiPollTimer = setTimeout(step, steps[0]);
}

async function openPost(id) {
  const res = await fetch('/api/posts/' + id, { credentials: 'include' });
  const data = await res.json();
  if (!data.post) return toast('帖子不存在');
  currentPost = data.post;
  showView('view-post');
  showContent('帖子详情');
  renderPostDetail(data.post);
}

function renderPostDetail(post) {
  const tags = (post.tags || []).length
    ? `<div class="post-tags" style="margin:8px 0 0;">${post.tags.map((t) => `<span class="post-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';
  const summary = post.aiSummary
    ? `<div class="ai-summary">🤖 ${escapeHtml(post.aiSummary)}</div>`
    : '';
  const el = $('post-detail');
  const canDel = myName === post.author || myName === 'admin';
  el.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div class="post-title" style="flex:1;min-width:0;">${escapeHtml(post.title)}</div>
        ${canDel ? `<button class="post-del lg" onclick="deletePost('${post.id}')" title="删除此帖">✕</button>` : ''}
      </div>
      ${tags}
      ${summary}
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);cursor:pointer;"
           onclick="openProfile('${escapeHtml(post.author)}')">
        ${avatarHtml(post.author, '', 'sm')}<span style="color:var(--text-2);font-weight:600;">${escapeHtml(post.author)}</span>
        <span>· ${fmtDate(post.createdAt)}</span>
      </div>
      <div class="post-content">${escapeHtml(post.content)}</div>
    </div>
    <div class="card">
      <h3 style="font-size:15px;margin-bottom:6px;">评论（${post.comments.length}）</h3>
      <div id="comment-list">${renderComments(post.comments)}</div>
      <div class="comment-input">
        <input id="comment-text" placeholder="写下你的评论..." onkeydown="if(event.key==='Enter')submitComment()">
        <button class="btn" onclick="submitComment()">评论</button>
      </div>
    </div>`;
}

function renderComments(comments) {
  if (!comments.length) return '<div class="empty-tip">暂无评论，来抢沙发</div>';
  return comments.map((c) => `
    <div class="comment">
      <div>${avatarHtml(c.username, '', 'sm')}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;gap:8px;align-items:center;cursor:pointer;" onclick="openProfile('${escapeHtml(c.username)}')">
          <span class="c-name">${escapeHtml(c.username)}</span><span class="c-time">${escapeHtml(c.time)}</span>
        </div>
        <div class="c-text">${escapeHtml(c.text)}</div>
      </div>
    </div>`).join('');
}

async function submitComment() {
  const text = $('comment-text').value.trim();
  if (!text || !currentPost) return;
  const res = await fetch('/api/posts/' + currentPost.id + '/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  if (data.ok) {
    currentPost.comments.push(data.comment);
    renderPostDetail(currentPost);
  } else {
    toast(data.error || '评论失败');
  }
}

// ========== 群房间 ==========
async function loadRooms() {
  const res = await fetch('/api/rooms', { credentials: 'include' });
  const data = await res.json();
  renderRooms(data.rooms || []);
}

function renderRooms(rooms) {
  const list = $('room-list');
  list.innerHTML = '';
  if (!rooms.length) {
    list.innerHTML = '<div class="empty-tip">还没有加入任何房间<br>点击上方「创建房间」开始</div>';
    return;
  }
  rooms.forEach((room) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="avatar sm" style="background:linear-gradient(135deg,var(--primary),var(--primary-2));border-radius:10px;">${room.hasPassword ? '🔒' : '💬'}</div>
      <div class="info">
        <div class="name">${escapeHtml(room.name)}</div>
        <div class="desc">${room.id} · ${room.members.length}人</div>
      </div>
      <button class="room-leave" title="退出房间" onclick="event.stopPropagation();exitRoom('${room.id}')">✕</button>`;
    item.onclick = () => enterRoom(room);
    list.appendChild(item);
  });
}

// 主动退出房间：从成员列表移除并刷新
async function exitRoom(roomId) {
  const res = await fetch('/api/rooms/' + roomId + '/leave', {
    method: 'POST',
    credentials: 'include'
  });
  const data = await res.json();
  if (data.ok) {
    if (currentRoom && currentRoom.id === roomId) {
      currentRoom = null;
      showView('view-welcome');
      document.body.classList.remove('m-content');
      $('mobile-top').classList.remove('hidden');
    }
    loadRooms();
    toast('已退出房间');
  } else {
    toast(data.error || '退出失败');
  }
}

function openCreateRoom(isJoin) {
  createMode = isJoin ? 'join' : 'create';
  $('create-modal-title').textContent = isJoin ? '加入房间' : '创建房间';
  $('create-name').classList.toggle('hidden', isJoin);
  $('join-id').classList.toggle('hidden', !isJoin);
  $('create-pass').value = '';
  $('create-modal').classList.remove('hidden');
  // 打开后自动聚焦，让用户直接就能输入房间名
  const target = isJoin ? $('join-id') : $('create-name');
  setTimeout(() => { try { target.focus(); } catch (e) {} }, 120);
}

async function submitCreateRoom() {
  if (createMode === 'create') {
    const name = $('create-name').value.trim();
    const password = $('create-pass').value;
    if (!name) return toast('请填写房间名称');
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, password: password || '' })
    });
    const data = await res.json();
    if (data.ok) {
      closeModal('create-modal');
      enterRoom(data.room);
      loadRooms();
    } else {
      toast(data.error || '创建失败');
    }
  } else {
    const id = $('join-id').value.trim();
    const password = $('create-pass').value;
    if (!id) return toast('请填写房间号');
    const res = await fetch('/api/rooms/' + id + '/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password: password || '' })
    });
    const data = await res.json();
    if (data.ok) {
      closeModal('create-modal');
      enterRoom(data.room);
      loadRooms();
    } else {
      toast(data.error || '加入失败');
    }
  }
}

async function joinByInput() {
  const id = $('join-id-input').value.trim();
  if (!id) return;
  const res = await fetch('/api/rooms/' + id + '/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password: '' })
  });
  const data = await res.json();
  if (data.ok) {
    $('join-id-input').value = '';
    enterRoom(data.room);
    loadRooms();
  } else {
    toast(data.error || '加入失败（可能需要密码）');
  }
}

// ========== 进入 / 离开聊天 ==========
function enterRoom(room) {
  if (currentRoom && socket && socketReady) socket.emit('leave_room');
  currentRoom = room;
  showView('view-chat', 'view-pop');
  showContent('', true); // 移动端：全屏聊天，用 chat-header 返回
  $('room-title').textContent = room.name;
  renderRoomSub();
  $('msg-input').disabled = false;
  $('send-btn').disabled = false;
  $('burn-select').value = '0';
  $('messages').innerHTML = '';
  applyChatBg();
  addSystemMsg(room.type === 'dm' ? '已进入私密会话' : `已进入房间「${room.name}」`);
  ensureSocket();
  if (socketReady) socket.emit('join_room', room.id);
}

function leaveRoom() {
  // 真正退出：通知后端把当前用户移出房间成员列表，避免一直挂在「我的房间」
  if (currentRoom && currentRoom.type === 'group') {
    fetch('/api/rooms/' + currentRoom.id + '/leave', { method: 'POST', credentials: 'include' })
      .then(() => { if (currentNav === 'rooms') loadRooms(); })
      .catch(() => {});
  }
  if (currentRoom && socket && socketReady) socket.emit('leave_room');
  currentRoom = null;
  showView('view-welcome');
  document.body.classList.remove('m-content');
  $('mobile-top').classList.remove('hidden');
  if (currentNav === 'rooms') loadRooms();
}

// ========== 发送消息（支持阅后即焚） ==========
function sendMessage() {
  const input = $('msg-input');
  const text = input.value.trim();
  if (!text || !socket || !currentRoom) return;
  const burn = parseInt($('burn-select').value, 10) || 0;
  socket.emit('chat_message', { text, burn });
  input.value = '';
  input.focus();
}

$('msg-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// ========== AI 智能回复 ==========
async function checkAi() {
  try {
    const res = await fetch('/api/ai/status', { credentials: 'include' });
    const data = await res.json();
    aiEnabled = !!data.enabled;
  } catch (e) {
    aiEnabled = false;
  }
  $('ai-bar').classList.toggle('hidden', !aiEnabled);
}

// 从当前聊天区收集最近的非系统消息（供 AI 参考）
function collectRecent() {
  const out = [];
  document.querySelectorAll('#messages .msg-row').forEach((row) => {
    const who = row.querySelector('.who');
    const bubble = row.querySelector('.bubble');
    if (who && bubble && bubble.textContent.trim()) {
      out.push({ username: who.textContent.trim(), text: bubble.textContent.trim() });
    }
  });
  return out.slice(-12);
}

async function openAiReplies() {
  if (!aiEnabled) return toast('AI 未配置：在服务器 ai.config.json 填入 API Key 后重启');
  const recent = collectRecent();
  if (!recent.length) return toast('还没有可参考的消息');
  $('ai-cands').innerHTML = '<div style="font-size:12px;color:var(--muted);padding:6px 2px;">🤖 AI 思考中...</div>';
  $('ai-cands').classList.remove('hidden');
  try {
    const res = await fetch('/api/ai/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ recent })
    });
    const data = await res.json();
    if (!data.replies || !data.replies.length) {
      $('ai-cands').innerHTML = '<div style="font-size:12px;color:var(--muted);padding:6px 2px;">AI 暂时没想好，稍后再试</div>';
      return;
    }
    $('ai-cands').innerHTML = data.replies.map((r, i) => `
      <div class="ai-cand">
        <span class="txt">${escapeHtml(r)}</span>
        <button class="btn sm ghost" onclick="fillAiReply(${i})">编辑</button>
        <button class="btn sm" onclick="sendAiReply(${i})">发送</button>
      </div>`).join('');
  } catch (e) {
    $('ai-cands').innerHTML = '<div style="font-size:12px;color:var(--muted);padding:6px 2px;">AI 暂时不可用</div>';
  }
}

function aiReplyAt(i) {
  const cands = $('ai-cands').querySelectorAll('.ai-cand .txt');
  return cands[i] ? cands[i].textContent : null;
}

// 点"编辑"：填入输入框，由用户改完再发
function fillAiReply(i) {
  const t = aiReplyAt(i);
  if (!t) return;
  $('msg-input').value = t;
  $('msg-input').focus();
  $('ai-cands').classList.add('hidden');
}

// 点"发送"：直接发出
function sendAiReply(i) {
  const t = aiReplyAt(i);
  if (!t) return;
  $('msg-input').value = t;
  $('ai-cands').classList.add('hidden');
  sendMessage();
}

// ========== 渲染消息 ==========
function addSystemMsg(text) {
  const div = document.createElement('div');
  div.className = 'msg-system';
  div.textContent = text;
  $('messages').appendChild(div);
  scrollToBottom();
}

function addChatMsg(username, text, time, mine, burn, expireAt) {
  const row = document.createElement('div');
  row.className = 'msg-row ' + (mine ? 'mine' : 'other');

  const av = mine ? avatarHtml(myName, me.avatar, 'sm') : avatarHtml(username, '', 'sm');
  const col = document.createElement('div');
  col.className = 'msg-col';

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = username;
  const when = document.createElement('span');
  when.textContent = time;
  meta.appendChild(who);
  meta.appendChild(when);

  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (burn ? ' burning' : '');
  bubble.textContent = text;

  col.appendChild(meta);
  col.appendChild(bubble);

  if (burn) {
    const tip = document.createElement('div');
    tip.className = 'burn-tip';
    tip.textContent = '🔥 ' + burn + '秒后销毁';
    col.appendChild(tip);
    const remainMs = (expireAt || Date.now() + burn * 1000) - Date.now();
    if (remainMs > 0) {
      setTimeout(() => {
        tip.textContent = '🔥 已销毁';
        row.style.opacity = '0.3';
        setTimeout(() => row.remove(), 400);
      }, remainMs);
    }
  }

  const avEl = document.createElement('div');
  avEl.innerHTML = av;
  row.appendChild(avEl.firstChild);
  row.appendChild(col);
  $('messages').appendChild(row);
  scrollToBottom();
}

// ========== 聊天背景 ==========
function applyChatBg() {
  const box = $('messages');
  box.className = 'messages';
  box.style.backgroundImage = '';
  const bg = me && me.chatBg;
  if (bg && bg.type === 'preset') {
    box.classList.add('bg-' + bg.value);
  } else if (bg && bg.type === 'upload') {
    box.classList.add('bg-upload');
    box.style.backgroundImage = "url('" + bg.value + "')";
  }
}

// ========== 私信 ==========
async function loadDms() {
  const [sRes, iRes] = await Promise.all([
    fetch('/api/dm/sessions', { credentials: 'include' }),
    fetch('/api/dm/invites', { credentials: 'include' })
  ]);
  const sData = await sRes.json();
  const iData = await iRes.json();
  renderDms(sData.sessions || [], iData.received || [], iData.sent || []);
}

function renderDms(sessions, received, sent) {
  const el = $('dm-list');
  let html = '';

  if (received.length) {
    html += `<div class="list-head" style="border:none;padding:10px 12px 4px;"><div class="title" style="font-size:13px;color:var(--danger);">待处理申请 (${received.length})</div></div>`;
    received.forEach((inv) => {
      html += `
        <div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin:6px 8px;background:var(--panel-2);">
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openProfile('${escapeHtml(inv.from)}')">
            ${avatarHtml(inv.from, '', 'sm')}
            <div style="min-width:0;flex:1;">
              <div style="font-size:13px;font-weight:600;">${escapeHtml(inv.from)}</div>
              <div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(inv.message || '想和你聊聊～')}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn sm" style="flex:1;" onclick="acceptInvite('${inv.id}')">同意</button>
            <button class="btn sm ghost" style="flex:1;" onclick="declineInvite('${inv.id}')">拒绝</button>
          </div>
        </div>`;
    });
  }

  if (sent.length) {
    html += `<div class="list-head" style="border:none;padding:10px 12px 4px;"><div class="title" style="font-size:13px;color:var(--muted);">我发出的申请</div></div>`;
    sent.forEach((inv) => {
      html += `
        <div style="padding:10px 12px;margin:4px 8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${avatarHtml(inv.to, '', 'sm')}
            <div style="min-width:0;flex:1;">
              <div style="font-size:13px;font-weight:600;">${escapeHtml(inv.to)}</div>
              <div style="font-size:12px;color:var(--muted);">⏳ 等待对方同意...</div>
            </div>
          </div>
        </div>`;
    });
  }

  html += `<div class="list-head" style="border:none;padding:10px 12px 4px;"><div class="title" style="font-size:13px;color:var(--muted);">我的会话</div></div>`;

  if (!sessions.length) {
    html += '<div class="empty-tip">还没有私信会话<br>去「广场」或「找人」发现想聊的人</div>';
  } else {
    sessions.forEach((s) => {
      html += `
        <div class="list-item" onclick="openDmSession(${JSON.stringify(s).replace(/"/g, '&quot;')})">
          <div class="avatar-wrap">
            ${avatarHtml(s.other, s.avatar, 'md')}
            <span class="dot-online ${s.isOnline ? '' : 'dot-off'}"></span>
          </div>
          <div class="info">
            <div class="name">${escapeHtml(s.other)}</div>
            <div class="desc">${s.isOnline ? '● 在线' : '○ 离线'} · 私密会话</div>
          </div>
        </div>`;
    });
  }

  el.innerHTML = html;
}

function openDmSession(s) {
  enterRoom({ id: s.roomId, name: '与 ' + s.other + ' 的私密会话', type: 'dm', members: [myName, s.other] });
}

async function acceptInvite(id) {
  const res = await fetch('/api/dm/invites/' + id + '/accept', {
    method: 'POST',
    credentials: 'include'
  });
  const data = await res.json();
  if (data.ok) {
    toast('已同意，进入私密会话');
    loadDms();
    enterRoom(data.room);
  } else {
    toast(data.error || '操作失败');
  }
}

async function declineInvite(id) {
  await fetch('/api/dm/invites/' + id + '/decline', { method: 'POST', credentials: 'include' });
  loadDms();
}

// 找人
function openFindUser() {
  showView('view-finduser');
  showContent('找人');
  $('finduser-detail').innerHTML = `
    <div class="card">
      <h2 style="margin-bottom:12px;">寻找同好</h2>
      <div class="form-group">
        <label>按用户名搜索</label>
        <input id="find-user-input" placeholder="输入用户名，支持模糊搜索..." onkeydown="if(event.key==='Enter')doSearchUser()">
      </div>
      <button class="btn" onclick="doSearchUser()">搜索</button>
    </div>
    <div id="find-user-result"></div>`;
  $('find-user-input').focus();
}

async function doSearchUser() {
  const q = $('find-user-input').value.trim();
  const res = await fetch('/api/users/search?q=' + encodeURIComponent(q), { credentials: 'include' });
  const data = await res.json();
  const box = $('find-user-result');
  const users = data.users || [];
  if (!users.length) {
    box.innerHTML = '<div class="empty-tip">没有找到相关用户</div>';
    return;
  }
  box.innerHTML = '<div class="list-head" style="border:none;padding:10px 12px 4px;"><div class="title" style="font-size:13px;color:var(--muted);">搜索结果</div></div>';
  users.forEach((u) => {
    const item = document.createElement('div');
    item.className = 'user-card';
    item.innerHTML = `
      <div class="avatar-wrap">
        ${avatarHtml(u.username, u.avatar, 'md')}
        <span class="dot-online ${u.isOnline ? '' : 'dot-off'}"></span>
      </div>
      <div style="min-width:0;flex:1;">
        <div style="font-size:14px;font-weight:600;">${escapeHtml(u.username)}</div>
        <div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(u.bio || '这个人很神秘')}</div>
      </div>`;
    item.onclick = () => openProfile(u.username);
    box.appendChild(item);
  });
}

// ========== 用户主页 ==========
async function openProfile(username) {
  showView('view-profile');
  showContent('个人主页');
  const el = $('profile-detail');
  el.innerHTML = '<div class="empty-tip">加载中...</div>';
  const res = await fetch('/api/users/' + encodeURIComponent(username), { credentials: 'include' });
  const data = await res.json();
  if (!data.user) {
    el.innerHTML = '<div class="empty-tip">用户不存在</div>';
    return;
  }
  const u = data.user;
  const isMe = u.username === myName;
  const isAdmin = u.username === 'admin';
  const posts = data.recentPosts || [];
  const days = u.createdAt ? Math.max(1, Math.floor((Date.now() - new Date(u.createdAt)) / 86400000)) : '—';
  // 主页背景：用户自定义优先，否则按用户名哈希自动配色（同一个人恒定一种）
  const covers = [
    'linear-gradient(135deg,#0f766e,#2dd4bf)',
    'linear-gradient(135deg,#4c1d95,#8b5cf6)',
    'linear-gradient(135deg,#be185d,#f472b6)',
    'linear-gradient(135deg,#b45309,#fbbf24)',
    'linear-gradient(135deg,#1e40af,#60a5fa)'
  ];
  const presetBg = {
    '1': 'linear-gradient(135deg,#0f766e,#2dd4bf)',
    '2': 'linear-gradient(135deg,#4c1d95,#8b5cf6)',
    '3': 'linear-gradient(135deg,#be185d,#f472b6)',
    '4': 'linear-gradient(135deg,#b45309,#fbbf24)',
    '5': 'linear-gradient(135deg,#1e40af,#60a5fa)',
    '6': 'linear-gradient(135deg,#0f172a,#475569)'
  };
  let bgStyle;
  const pb = u.profileBg;
  if (pb && pb.startsWith('preset:')) {
    bgStyle = 'background:' + (presetBg[pb.slice(7)] || covers[0]);
  } else if (pb && pb.startsWith('data:image')) {
    bgStyle = 'background-image:url("' + pb + '");background-size:cover;background-position:center;';
  } else {
    let hsh = 0;
    for (const ch of u.username) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    bgStyle = 'background:' + covers[hsh % covers.length];
  }

  const postItems = posts.length
    ? posts.map((p) => `
      <div class="profile-post" onclick="openPost('${p.id}')">
        <div class="pp-title">${escapeHtml(p.title)}</div>
        <div class="pp-meta">💬 ${p.commentCount} · ${fmtDate(p.createdAt)}${(p.tags || []).length ? ' · ' + p.tags.map((t) => escapeHtml(t)).join(' / ') : ''}</div>
      </div>`).join('')
    : '<div class="empty-tip" style="padding:24px 0;">TA 还没有发布话题</div>';

  const interests = u.interests || [];
  const chipsHtml = interests.length
    ? interests.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')
    : '<div class="empty-tip" style="padding:8px 0;font-size:12px;">还没有设置兴趣标签</div>';

  el.innerHTML = `
    <div class="profile-hero">
      <div class="ph-bg" style="${bgStyle}"></div>
      <div class="ph-orb"></div>
      <div class="ph-orb ph-orb2"></div>
      <div class="ph-mask"></div>
      <div class="ph-content">
        <div class="avatar-wrap">
          ${avatarHtml(u.username, u.avatar, 'lg')}
          <span class="dot-online ${u.isOnline ? '' : 'dot-off'}"></span>
        </div>
        <div class="ph-name">${escapeHtml(u.username)} ${isAdmin ? '<span class="admin-badge">' + t('me.adminBadge') + '</span>' : ''}</div>
        <div class="ph-meta">${u.isOnline ? '🟢 在线' : '⚪ 离线'} · 加入于 ${fmtDate(u.createdAt)}</div>
      </div>
    </div>
    <div class="profile-glass">
      <div class="gs"><div class="gs-num">${u.postCount}</div><div class="gs-label">话题</div></div>
      <div class="gs"><div class="gs-num">${u.commentReceived}</div><div class="gs-label">获评</div></div>
      <div class="gs"><div class="gs-num">${days}</div><div class="gs-label">入驻天数</div></div>
    </div>
    <div class="card">
      <div class="card-title">🧩 兴趣标签</div>
      <div class="chips">${chipsHtml}</div>
    </div>
    <div class="card">
      <div class="card-title">✍️ 个性签名</div>
      <div class="profile-bio">${escapeHtml(u.bio || '这个人很神秘，什么都没写～')}</div>
    </div>
    <div class="card">
      <div class="card-title">📝 ${isMe ? '我的话题' : 'TA 的话题'}</div>
      ${postItems}
    </div>
    <div class="profile-actions">
      ${isMe
        ? '<button class="btn" onclick="switchNav(\'me\')">✏️ 编辑我的资料</button>'
        : '<button class="btn" onclick="sendDmRequest(\'' + escapeHtml(u.username) + '\')">💌 私信 TA</button>'}
    </div>`;
}

async function sendDmRequest(username) {
  const message = prompt('向 ' + username + ' 发送私信申请（可附一句话，留空直接发送）：');
  if (message === null) return; // 用户取消
  const res = await fetch('/api/users/' + encodeURIComponent(username) + '/dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ message: message || '' })
  });
  const data = await res.json();
  if (data.ok && data.already) {
    enterRoom(data.room);
  } else if (data.ok && data.pending) {
    toast('已发送过申请，等待对方处理');
  } else if (data.ok) {
    toast('私信申请已发送，等待对方同意');
    loadDmBadge();
  } else {
    toast(data.error || '发送失败');
  }
}

// ========== 我的 / 设置 ==========
function renderMe() {
  const el = $('me-list');
  const meCover = me.profileBg && me.profileBg.startsWith('data:image')
    ? `background-image:url("${me.profileBg}");background-size:cover;background-position:center;`
    : '';
  el.innerHTML = `
    <div class="me-hero card" style="${meCover}">
      <div class="me-cover"></div>
      <div class="me-orb"></div>
      <div class="me-orb me-orb2"></div>
      <div class="me-info">
        <div class="avatar-wrap">${avatarHtml(me.username, me.avatar, 'lg')}<span class="dot-online"></span></div>
        <div class="me-name">${escapeHtml(me.username)} ${me.username === 'admin' ? '<span class="admin-badge">' + t('me.adminBadge') + '</span>' : ''}</div>
        <div class="me-desc">${escapeHtml(me.bio || t('me.descPlaceholder'))}</div>
      </div>
    </div>
    <div class="me-grid">
      <div class="me-card" onclick="openSettings('profile')">
        <span class="me-ico" style="background:linear-gradient(135deg,#0ea5e9,#22d3ee)">✏️</span>
        <b>${t('me.profile')}</b><i>${t('me.profileSub')}</i>
      </div>
      <div class="me-card" onclick="openSettings('theme')">
        <span class="me-ico" style="background:linear-gradient(135deg,#8b5cf6,#c084fc)">🎨</span>
        <b>${t('me.theme')}</b><i>${t('me.themeSub')}</i>
      </div>
      <div class="me-card" onclick="openSettings('background')">
        <span class="me-ico" style="background:linear-gradient(135deg,#f59e0b,#fbbf24)">🖼️</span>
        <b>${t('me.chatBg')}</b><i>${t('me.chatBgSub')}</i>
      </div>
      <div class="me-card" onclick="openSettings('password')">
        <span class="me-ico" style="background:linear-gradient(135deg,#ef4444,#f87171)">🔑</span>
        <b>${t('me.password')}</b><i>${t('me.passwordSub')}</i>
      </div>
    </div>`;
}

function openSettings(type) {
  showView('view-settings');
  showContent(t('nav.settings'));
  const el = $('settings-detail');
  if (type === 'profile') {
    el.innerHTML = `
      <div class="card">
        <h2>${t('set.profile')}</h2>
        <div class="avatar-edit">
          <div id="set-avatar-preview">${avatarHtml(me.username, me.avatar, 'lg')}</div>
          <div>
            <button class="file-btn" onclick="document.getElementById('avatar-file').click()">更换头像</button>
            <button class="file-btn" onclick="clearAvatar()">移除头像</button>
            <input type="file" id="avatar-file" accept="image/*" class="hidden" onchange="uploadAvatar(this)">
          </div>
        </div>
        <div class="form-group" style="margin-top:16px;">
          <label>个性简介（≤200字）</label>
          <textarea id="set-bio" maxlength="200" placeholder="介绍一下自己，让别人更想认识你">${escapeHtml(me.bio || '')}</textarea>
        </div>
        <div class="form-group">
          <label>兴趣标签（最多6个，用逗号分隔）</label>
          <input id="set-interests" value="${(me.interests || []).map(escapeHtml).join('，')}" placeholder="例如：夜谈、心理学、科技">
        </div>
        <div class="form-group">
          <label>主页背景（你的个性封面，别人查看主页时可见）</label>
          <div class="bg-preset-grid">${renderPbgPresets()}</div>
          <div class="bg-actions">
            <button class="file-btn" onclick="document.getElementById('pbg-file').click()">🖼️ 上传图片</button>
            <button class="file-btn" onclick="setProfileBg(null)">↺ 恢复默认</button>
            <input type="file" id="pbg-file" accept="image/*" class="hidden" onchange="uploadProfileBg(this)">
          </div>
        </div>
        <button class="btn" onclick="saveProfile()">保存资料</button>
      </div>`;
  } else if (type === 'theme') {
    el.innerHTML = `
      <div class="card">
        <h2>${t('set.theme')}</h2>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">切换后全局生效，立即预览</div>
        <div class="theme-grid">${renderThemeCards()}</div>
      </div>`;
  } else if (type === 'background') {
    el.innerHTML = `
      <div class="card">
        <h2>${t('set.background')}</h2>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">进入聊天时生效，可随时更换</div>
        ${renderBgCards()}
      </div>`;
  } else if (type === 'password') {
    el.innerHTML = `
      <div class="card">
        <h2>${t('set.password')}</h2>
        <div class="form-group"><label>原密码</label><input id="set-old-pass" type="password" autocomplete="current-password"></div>
        <div class="form-group"><label>新密码（至少6位）</label><input id="set-new-pass" type="password" autocomplete="new-password"></div>
        <div class="form-group"><label>确认新密码</label><input id="set-new-pass2" type="password"></div>
        <button class="btn" onclick="changePassword()">确认修改</button>
      </div>`;
  }
}

function renderThemeCards() {
  const themes = [
    { id: 'ocean', name: t('theme.ocean'), sw: 'sw-ocean' },
    { id: 'dark', name: t('theme.dark'), sw: 'sw-dark' },
    { id: 'sunset', name: t('theme.sunset'), sw: 'sw-sunset' },
    { id: 'nebula', name: t('theme.nebula'), sw: 'sw-nebula' }
  ];
  return themes.map((t) => `
    <div class="theme-card ${me.theme === t.id ? 'active' : ''}" onclick="selectTheme('${t.id}')">
      <div class="theme-swatch ${t.sw}"></div>
      <div class="t-name">${t.name}</div>
    </div>`).join('');
}

function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name || 'ocean');
}

const profileBusy = {}; // 防急躁连点：同一设置操作进行中时忽略再次点击
async function selectTheme(name) {
  if (profileBusy.theme) { toast('操作太快啦，稍等片刻～'); return; }
  profileBusy.theme = true;
  try {
    const res = await fetch('/api/me/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ theme: name })
    });
    if (res.ok) {
      me.theme = name;
      applyTheme(name);
      openSettings('theme');
      toast('主题已切换');
    } else {
      toast('切换失败');
    }
  } finally { profileBusy.theme = false; }
}

function bgGradient(id) {
  const map = {
    p1: 'linear-gradient(160deg,#d6f0ee,#eef6f5)',
    p2: 'linear-gradient(160deg,#dbeafe,#eef5ff)',
    p3: 'linear-gradient(160deg,#fdebd0,#fef5e7)',
    p4: 'linear-gradient(160deg,#ede4f7,#f7f0fd)'
  };
  return map[id] || map.p1;
}

function renderBgCards() {
  const presets = [
    { id: 'p1', name: '青绿' },
    { id: 'p2', name: '淡蓝' },
    { id: 'p3', name: '暖阳' },
    { id: 'p4', name: '淡紫' }
  ];
  const activePreset = me.chatBg && me.chatBg.type === 'preset' ? me.chatBg.value : null;
  const activeUpload = me.chatBg && me.chatBg.type === 'upload';
  const cards = presets.map((p) => `
    <div class="bg-card ${activePreset === p.id ? 'active' : ''}" style="background:${bgGradient(p.id)}"
         onclick="selectChatBg('preset','${p.id}')"><span>${p.name}</span></div>`).join('');
  return `
    <div class="bg-grid">
      ${cards}
      <div class="bg-card ${activeUpload ? 'active' : ''}" style="background:linear-gradient(160deg,#f3f4f6,#e5e7eb);border-style:dashed;"
           onclick="document.getElementById('bg-file').click()">
        <span style="color:#6b7280;text-shadow:none;">上传图片</span>
      </div>
      <input type="file" id="bg-file" accept="image/*" class="hidden" onchange="uploadChatBg(this)">
    </div>
    <div style="margin-top:14px;"><button class="btn ghost sm" onclick="resetChatBg()">恢复默认背景</button></div>`;
}

async function selectChatBg(type, value) {
  if (profileBusy.chatbg) { toast('操作太快啦，稍等片刻～'); return; }
  profileBusy.chatbg = true;
  try {
    const res = await fetch('/api/me/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ chatBg: { type, value } })
    });
    const data = await res.json();
    if (data.ok) {
      me.chatBg = { type, value };
      openSettings('background');
      if (currentRoom) applyChatBg();
      toast('聊天背景已更新');
    } else {
      toast(data.error || '更新失败');
    }
  } finally { profileBusy.chatbg = false; }
}

async function resetChatBg() {
  if (profileBusy.chatbg) { toast('操作太快啦，稍等片刻～'); return; }
  profileBusy.chatbg = true;
  try {
    const res = await fetch('/api/me/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ chatBg: null })
    });
    if (res.ok) {
      me.chatBg = null;
      openSettings('background');
      if (currentRoom) applyChatBg();
      toast('已恢复默认背景');
    }
  } finally { profileBusy.chatbg = false; }
}

async function saveProfile() {
  const bio = $('set-bio').value.trim();
  const rawTags = $('set-interests').value.trim();
  const interests = rawTags ? rawTags.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean).slice(0, 6) : [];
  const res = await fetch('/api/me/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ bio, interests })
  });
  const data = await res.json();
  if (data.ok) {
    me.bio = bio;
    me.interests = interests;
    renderMe();
    toast('资料已保存');
  } else {
    toast(data.error || '保存失败');
  }
}

// 主页背景：预设渐变渲染（当前选中高亮）
function renderPbgPresets() {
  const presets = [
    ['1', 'linear-gradient(135deg,#0f766e,#2dd4bf)'],
    ['2', 'linear-gradient(135deg,#4c1d95,#8b5cf6)'],
    ['3', 'linear-gradient(135deg,#be185d,#f472b6)'],
    ['4', 'linear-gradient(135deg,#b45309,#fbbf24)'],
    ['5', 'linear-gradient(135deg,#1e40af,#60a5fa)'],
    ['6', 'linear-gradient(135deg,#0f172a,#475569)']
  ];
  return presets.map(([id, bg]) => `
    <div class="bg-preset ${me.profileBg === 'preset:' + id ? 'active' : ''}" style="background:${bg}"
      onclick="setProfileBg('preset:${id}')" title="预设背景 ${id}"></div>`).join('');
}

// 设置主页背景（preset:id 或 dataURL 或 null 恢复默认）
async function setProfileBg(val) {
  if (profileBusy.pbg) { toast('操作太快啦，稍等片刻～'); return; }
  profileBusy.pbg = true;
  try {
    const res = await fetch('/api/me/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ profileBg: val })
    });
    const data = await res.json();
    if (data.ok) {
      me.profileBg = val;
      const grid = document.querySelector('.bg-preset-grid');
      if (grid) grid.innerHTML = renderPbgPresets();
      toast(val ? '主页背景已更新' : '已恢复默认背景');
    } else {
      toast(data.error || '设置失败');
    }
  } finally { profileBusy.pbg = false; }
}

// 上传自定义主页背景图片
function uploadProfileBg(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  readImage(file, 1200, async (dataUrl) => {
    await setProfileBg(dataUrl);
    input.value = '';
  });
}

function uploadAvatar(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  readImage(file, 128, async (dataUrl) => {
    const res = await fetch('/api/me/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ avatar: dataUrl })
    });
    const data = await res.json();
    if (data.ok) {
      me.avatar = dataUrl;
      renderNavUser();
      openSettings('profile');
      toast('头像已更新');
    } else {
      toast(data.error || '上传失败');
    }
  });
}

async function clearAvatar() {
  const res = await fetch('/api/me/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ avatar: null })
  });
  if (res.ok) {
    me.avatar = null;
    renderNavUser();
    openSettings('profile');
    toast('已移除头像');
  }
}

function uploadChatBg(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  readImage(file, 1280, async (dataUrl) => {
    const res = await fetch('/api/me/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ chatBg: { type: 'upload', value: dataUrl } })
    });
    const data = await res.json();
    if (data.ok) {
      me.chatBg = { type: 'upload', value: dataUrl };
      openSettings('background');
      if (currentRoom) applyChatBg();
      toast('背景已更新');
    } else {
      toast(data.error || '上传失败');
    }
  });
}

async function changePassword() {
  const oldPassword = $('set-old-pass').value;
  const newPassword = $('set-new-pass').value;
  const newPassword2 = $('set-new-pass2').value;
  if (!newPassword || newPassword.length < 6) return toast('新密码至少 6 位');
  if (newPassword !== newPassword2) return toast('两次输入的新密码不一致');
  const res = await fetch('/api/me/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ oldPassword, newPassword })
  });
  const data = await res.json();
  if (data.ok) {
    toast('密码修改成功');
    $('set-old-pass').value = '';
    $('set-new-pass').value = '';
    $('set-new-pass2').value = '';
  } else {
    toast(data.error || '修改失败');
  }
}

// ========== 退出登录 ==========
async function logout() {
  if (socket) socket.disconnect();
  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  location.href = 'index.html';
}
