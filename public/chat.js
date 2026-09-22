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
let myRoomsCache = [];    // 房间缓存（语言切换时重渲）
let dmCache = { sessions: [], received: [], sent: [] }; // 私信缓存（语言切换时重渲）
let postFilter = 'all';   // 广场筛选：all / 深度分析 / 经验分享 / 求助 / 情绪宣泄 / high

const $ = (id) => document.getElementById(id);

// ========== 国际化（多语言） ==========
const LANGS = ['zh', 'en', 'fr', 'de'];
const I18N = {
  zh: {
    appName:'树洞', 'nav.square':'广场', 'nav.rooms':'房间', 'nav.dms':'私信', 'nav.me':'我的', 'nav.system':'系统', 'nav.logout':'退出', 'nav.settings':'设置',
    'panel.square':'话题广场', 'panel.rooms':'我的房间', 'panel.dms':'私信', 'panel.me':'我的空间', 'panel.system':'系统设置',
    'btn.newPost':'＋ 发帖', 'btn.createRoom':'＋ 创建房间', 'btn.joinRoom':'🔑 加入房间', 'btn.findUser':'＋ 找人', 'btn.leave':'离开', 'btn.send':'发送', 'btn.confirm':'确定', 'btn.cancel':'取消', 'btn.publish':'发布', 'btn.edit':'编辑', 'btn.search':'搜索', 'btn.comment':'评论',
    'ph.joinId':'输入房间号，回车加入', 'ph.roomName':'给你的房间起个名字', 'ph.roomPass':'设置访问密码', 'ph.roomId':'8位房间号', 'ph.message':'输入消息，回车发送...', 'ph.postTitle':'想聊点什么？', 'ph.postContent':'写下你的想法...', 'ph.comment':'写下你的评论...',
    'modal.createTitle':'创建房间', 'modal.joinTitle':'加入房间', 'modal.roomName':'房间名称', 'modal.roomPass':'房间密码（可选，留空则无需密码）', 'modal.roomId':'房间号（加入时填写）', 'modal.postTitle':'发布话题', 'modal.postTitleLabel':'标题（≤60字）', 'modal.postContentLabel':'内容（≤5000字）',
    'ai.helper':'🤖 AI 小助手', 'ai.smartReply':'✨ 智能回复', 'burn.normal':'普通', 'burn.sec':'秒', 'burn.destroyed':'🔥 已销毁', 'burn.in':'🔥 {s}秒后销毁', 'burn.tip':'阅后即焚：消息在指定时间后自动销毁',
    'welcome.title':'欢迎来到树洞', 'welcome.l1':'在「广场」发现有意思的话题和同好', 'welcome.l2':'点开感兴趣的人 → 申请私密交流', 'welcome.l3':'或创建 / 加入专属房间实时畅聊',
    'sys.lang':'语言 / Language', 'sys.changelog':'更新说明',
    'sys.history':'—— 加载到 {n} 条历史消息 ——', 'sys.noHistory':'暂无历史消息，快来发第一条吧', 'sys.dmRequest':'收到来自 {name} 的私信申请', 'sys.dmAccepted':'对方已同意你的私信申请', 'sys.reconnecting':'连接已断开，正在重连...', 'sys.reconnected':'已重新连接', 'sys.enterRoom':'已进入房间「{name}」', 'sys.enterDm':'已进入私密会话', 'sys.leftRoom':'已退出房间',
    'content.postDetail':'帖子详情', 'content.find':'找人', 'content.profile':'个人主页',
    'confirm.delPost':'确定删除这条帖子吗？删除后不可恢复。',
    'post.aiAnalyzing':'⏳ AI分析中', 'post.delTip':'删除此帖', 'post.comments':'评论（{n}）', 'post.noComments':'暂无评论，来抢沙发', 'post.empty':'这个分类下还没有帖子<br>去「＋ 发帖」开启第一帖',
    'rooms.empty':'还没有加入任何房间<br>点击上方「创建房间」开始', 'rooms.members':'{n}人', 'rooms.leaveTip':'退出房间',
    'dms.pending':'待处理申请（{n}）', 'dms.defaultMsg':'想和你聊聊～', 'dms.accept':'同意', 'dms.decline':'拒绝', 'dms.sent':'我发出的申请', 'dms.waiting':'⏳ 等待对方同意...', 'dms.sessions':'我的会话', 'dms.empty':'还没有私信会话<br>去「广场」或「找人」发现想聊的人', 'dms.online':'● 在线', 'dms.offline':'○ 离线', 'dms.with':'与 {name} 的私密会话',
    'find.title':'寻找同好', 'find.searchBy':'按用户名搜索', 'ph.find':'输入用户名，支持模糊搜索...', 'find.empty':'没有找到相关用户', 'find.results':'搜索结果', 'find.mystery':'这个人很神秘',
    'profile.title':'个人主页', 'profile.loading':'加载中...', 'profile.noUser':'用户不存在', 'profile.noPosts':'TA 还没有发布话题', 'profile.noInterests':'还没有设置兴趣标签', 'profile.joined':'加入于 {date}', 'profile.posts':'话题', 'profile.comments':'获评', 'profile.days':'入驻天数', 'profile.interests':'🧩 兴趣标签', 'profile.signature':'✍️ 个性签名', 'profile.mysteryBio':'这个人很神秘，什么都没写～', 'profile.myTopics':'📝 我的话题', 'profile.taTopics':'📝 TA 的话题', 'profile.editMe':'✏️ 编辑我的资料', 'profile.dmTa':'💌 私信 TA', 'profile.dmPrompt':'向 {name} 发送私信申请（可附一句话，留空直接发送）：',
    'me.profile':'个人资料', 'me.profileSub':'头像 · 简介 · 兴趣标签', 'me.theme':'主题皮肤', 'me.themeSub':'四套配色自由切换', 'me.chatBg':'聊天背景', 'me.chatBgSub':'渐变或自定义图片', 'me.password':'修改密码', 'me.passwordSub':'定期更换更安全', 'me.descPlaceholder':'点击编辑头像与简介，让别人更想认识你', 'me.adminBadge':'管理员',
    'set.profile':'个人资料', 'set.theme':'主题皮肤', 'set.background':'聊天背景', 'set.password':'修改密码', 'set.changeAvatar':'更换头像', 'set.removeAvatar':'移除头像', 'set.bioLabel':'个性简介（≤200字）', 'ph.setBio':'介绍一下自己，让别人更想认识你', 'set.interestsLabel':'兴趣标签（最多6个，用逗号分隔）', 'ph.setInterests':'例如：夜谈、心理学、科技', 'set.pbgLabel':'主页背景（你的个性封面，别人查看主页时可见）', 'set.upload':'🖼️ 上传图片', 'set.reset':'↺ 恢复默认', 'set.save':'保存资料', 'set.themeHint':'切换后全局生效，立即预览', 'set.bgHint':'进入聊天时生效，可随时更换', 'set.oldPwd':'原密码', 'set.newPwd':'新密码（至少6位）', 'set.confirmPwd':'确认新密码', 'set.confirmBtn':'确认修改',
    'theme.ocean':'海洋青绿', 'theme.dark':'午夜暗黑', 'theme.sunset':'日落暖橙', 'theme.nebula':'星空幻紫',
    'bg.green':'青绿', 'bg.blue':'淡蓝', 'bg.sun':'暖阳', 'bg.purple':'淡紫', 'bg.upload':'上传图片', 'bg.resetDefault':'恢复默认背景', 'bg.presetTip':'预设背景 {id}',
    'filter.all':'全部', 'filter.deep':'🧠 深度', 'filter.exp':'📚 经验', 'filter.help':'🆘 求助', 'filter.emo':'💭 情绪', 'filter.high':'⭐ 高质量',
    'tag.deep':'深度分析', 'tag.exp':'经验分享', 'tag.help':'求助', 'tag.emo':'情绪宣泄', 'tag.discuss':'讨论', 'tag.spam':'灌水', 'tag.high':'高质量',
    'room.dmSession':'私密会话', 'room.info':'房间号 {id} · {n} 人',
    'toast.fast':'操作太快啦，稍等片刻再切换～', 'toast.tooFast':'操作太快啦，稍等片刻～', 'toast.langOk':'已切换语言',
    'toast.deleted':'帖子已删除', 'toast.delFail':'删除失败', 'toast.needTitle':'请填写标题', 'toast.posted':'发布成功', 'toast.postFail':'发布失败', 'toast.noPost':'帖子不存在', 'toast.commentFail':'评论失败', 'toast.leaveFail':'退出失败', 'toast.needRoomName':'请填写房间名称', 'toast.createFail':'创建失败', 'toast.needRoomId':'请填写房间号', 'toast.joinFail':'加入失败', 'toast.joinFailPwd':'加入失败（可能需要密码）',
    'toast.aiNotCfg':'AI 未配置：在服务器 ai.config.json 填入 API Key 后重启', 'toast.noRef':'还没有可参考的消息', 'toast.aiThinking':'🤖 AI 思考中...', 'toast.aiEmpty':'AI 暂时没想好，稍后再试', 'toast.aiUnavailable':'AI 暂时不可用',
    'toast.accepted':'已同意，进入私密会话', 'toast.opFail':'操作失败', 'toast.dupRequest':'已发送过申请，等待对方处理', 'toast.sent':'私信申请已发送，等待对方同意', 'toast.sendFail':'发送失败',
    'toast.themeOk':'主题已切换', 'toast.themeFail':'切换失败', 'toast.bgUpdated':'聊天背景已更新', 'toast.updateFail':'更新失败', 'toast.bgReset':'已恢复默认背景', 'toast.saved':'资料已保存', 'toast.saveFail':'保存失败', 'toast.pbgUpdated':'主页背景已更新', 'toast.setFail':'设置失败', 'toast.avatarOk':'头像已更新', 'toast.uploadFail':'上传失败', 'toast.avatarRemoved':'已移除头像', 'toast.bgOk':'背景已更新', 'toast.pwdShort':'新密码至少 6 位', 'toast.pwdDiff':'两次输入的新密码不一致', 'toast.pwdOk':'密码修改成功', 'toast.pwdFail':'修改失败',
    'err.notLogin':'未登录', 'err.emptyCred':'用户名和密码不能为空', 'err.badUserFmt':'用户名需为2-20位字母/数字/下划线/中文', 'err.pwdShort':'密码至少 6 位', 'err.userTaken':'该用户名已被注册', 'err.server':'服务器内部错误', 'err.needCred':'请输入用户名和密码', 'err.badLogin':'用户名或密码错误', 'err.oldPwd':'原密码错误', 'err.avatarBig':'头像图片过大（需小于约300KB）', 'err.bioLong':'简介最多 200 字', 'err.noUser':'用户不存在', 'err.noPost':'帖子不存在', 'err.noPerm':'只有作者或管理员可以删除', 'err.selfDm':'不能和自己私信', 'err.inviteGone':'申请不存在或已处理', 'err.titleLong':'标题不能为空且不超过60字', 'err.contentLong':'内容不能为空且不超过5000字', 'err.commentEmpty':'评论不能为空', 'err.aiGen':'生成失败', 'err.roomName':'房间名不能为空且不超过30字', 'err.roomGone':'房间不存在，请检查房间号', 'err.roomPwd':'房间密码错误', 'err.roomMissing':'房间不存在', 'err.notMember':'你不是该房间成员'
  },
  en: {
    appName:'Tree Hole', 'nav.square':'Square', 'nav.rooms':'Rooms', 'nav.dms':'Messages', 'nav.me':'Me', 'nav.system':'System', 'nav.logout':'Log out', 'nav.settings':'Settings',
    'panel.square':'Topics', 'panel.rooms':'My Rooms', 'panel.dms':'Messages', 'panel.me':'My Space', 'panel.system':'System',
    'btn.newPost':'＋ New post', 'btn.createRoom':'＋ Create room', 'btn.joinRoom':'🔑 Join room', 'btn.findUser':'＋ Find', 'btn.leave':'Leave', 'btn.send':'Send', 'btn.confirm':'Confirm', 'btn.cancel':'Cancel', 'btn.publish':'Publish', 'btn.edit':'Edit', 'btn.search':'Search', 'btn.comment':'Comment',
    'ph.joinId':'Enter room id, press Enter to join', 'ph.roomName':'Name your room', 'ph.roomPass':'Set a password', 'ph.roomId':'8-digit room id', 'ph.message':'Type a message, Enter to send...', 'ph.postTitle':'What do you want to talk about?', 'ph.postContent':'Write your thoughts...', 'ph.comment':'Write a comment...',
    'modal.createTitle':'Create Room', 'modal.joinTitle':'Join Room', 'modal.roomName':'Room name', 'modal.roomPass':'Password (optional)', 'modal.roomId':'Room id (for joining)', 'modal.postTitle':'New Topic', 'modal.postTitleLabel':'Title (≤60 chars)', 'modal.postContentLabel':'Content (≤5000 chars)',
    'ai.helper':'🤖 AI Assistant', 'ai.smartReply':'✨ Smart reply', 'burn.normal':'Normal', 'burn.sec':'s', 'burn.destroyed':'🔥 Destroyed', 'burn.in':'🔥 destroyed in {s}s', 'burn.tip':'Self-destruct: message is deleted after the chosen time',
    'welcome.title':'Welcome to Tree Hole', 'welcome.l1':'Find interesting topics in the Square', 'welcome.l2':'Open someone\u2019s profile → request a private chat', 'welcome.l3':'Or create / join a private room to chat live',
    'sys.lang':'Language', 'sys.changelog':'Changelog',
    'sys.history':'-- Loaded {n} messages --', 'sys.noHistory':'No messages yet, send the first one', 'sys.dmRequest':'Private chat request from {name}', 'sys.dmAccepted':'Your request was accepted', 'sys.reconnecting':'Disconnected, reconnecting...', 'sys.reconnected':'Reconnected', 'sys.enterRoom':'Entered room "{name}"', 'sys.enterDm':'Entered private chat', 'sys.leftRoom':'Left the room',
    'content.postDetail':'Post', 'content.find':'Find people', 'content.profile':'Profile',
    'confirm.delPost':'Delete this post? This cannot be undone.',
    'post.aiAnalyzing':'⏳ AI analyzing', 'post.delTip':'Delete post', 'post.comments':'Comments ({n})', 'post.noComments':'No comments yet, be the first', 'post.empty':'No posts in this category yet<br>Start with "＋ New post"',
    'rooms.empty':'No rooms yet<br>Create one above', 'rooms.members':'{n} people', 'rooms.leaveTip':'Leave room',
    'dms.pending':'Pending requests ({n})', 'dms.defaultMsg':'Wants to chat with you', 'dms.accept':'Accept', 'dms.decline':'Decline', 'dms.sent':'Sent requests', 'dms.waiting':'⏳ Waiting for approval...', 'dms.sessions':'My conversations', 'dms.empty':'No conversations yet<br>Find people in the Square', 'dms.online':'● Online', 'dms.offline':'○ Offline', 'dms.with':'Private chat with {name}',
    'find.title':'Find people', 'find.searchBy':'Search by username', 'ph.find':'Enter a username...', 'find.empty':'No users found', 'find.results':'Search results', 'find.mystery':'A mysterious person',
    'profile.title':'Profile', 'profile.loading':'Loading...', 'profile.noUser':'User not found', 'profile.noPosts':'No topics yet', 'profile.noInterests':'No interests set', 'profile.joined':'Joined {date}', 'profile.posts':'Topics', 'profile.comments':'Replies', 'profile.days':'Days', 'profile.interests':'🧩 Interests', 'profile.signature':'✍️ Signature', 'profile.mysteryBio':'A mystery, wrote nothing', 'profile.myTopics':'📝 My topics', 'profile.taTopics':'📝 Their topics', 'profile.editMe':'✏️ Edit my profile', 'profile.dmTa':'💌 Message', 'profile.dmPrompt':'Send a request to {name} (optional message):',
    'me.profile':'Profile', 'me.profileSub':'Avatar · Bio · Interests', 'me.theme':'Theme', 'me.themeSub':'4 color themes', 'me.chatBg':'Chat background', 'me.chatBgSub':'Gradient or image', 'me.password':'Change password', 'me.passwordSub':'Stay secure', 'me.descPlaceholder':'Click to edit avatar and bio', 'me.adminBadge':'Admin',
    'set.profile':'Profile', 'set.theme':'Theme', 'set.background':'Chat background', 'set.password':'Change password', 'set.changeAvatar':'Change avatar', 'set.removeAvatar':'Remove avatar', 'set.bioLabel':'Bio (≤200 chars)', 'ph.setBio':'Introduce yourself', 'set.interestsLabel':'Interests (max 6, separated by commas)', 'ph.setInterests':'e.g. night talk, psychology, tech', 'set.pbgLabel':'Profile background (shown to others)', 'set.upload':'🖼️ Upload image', 'set.reset':'↺ Reset', 'set.save':'Save profile', 'set.themeHint':'Applies globally, instant preview', 'set.bgHint':'Applies in chat, change anytime', 'set.oldPwd':'Current password', 'set.newPwd':'New password (min 6)', 'set.confirmPwd':'Confirm new password', 'set.confirmBtn':'Confirm',
    'theme.ocean':'Ocean', 'theme.dark':'Midnight', 'theme.sunset':'Sunset', 'theme.nebula':'Nebula',
    'bg.green':'Green', 'bg.blue':'Light blue', 'bg.sun':'Sunny', 'bg.purple':'Light purple', 'bg.upload':'Upload image', 'bg.resetDefault':'Reset background', 'bg.presetTip':'Preset {id}',
    'filter.all':'All', 'filter.deep':'🧠 Deep', 'filter.exp':'📚 Experience', 'filter.help':'🆘 Help', 'filter.emo':'💭 Emotion', 'filter.high':'⭐ Top',
    'tag.deep':'Deep analysis', 'tag.exp':'Experience', 'tag.help':'Help', 'tag.emo':'Emotion', 'tag.discuss':'Discussion', 'tag.spam':'Spam', 'tag.high':'High quality',
    'room.dmSession':'Private chat', 'room.info':'Room {id} · {n} people',
    'toast.fast':'Too fast, take a breath～', 'toast.tooFast':'Too fast, take a breath～', 'toast.langOk':'Language switched',
    'toast.deleted':'Post deleted', 'toast.delFail':'Delete failed', 'toast.needTitle':'Please enter a title', 'toast.posted':'Posted', 'toast.postFail':'Failed to post', 'toast.noPost':'Post not found', 'toast.commentFail':'Failed to comment', 'toast.leaveFail':'Failed to leave', 'toast.needRoomName':'Please enter a room name', 'toast.createFail':'Failed to create', 'toast.needRoomId':'Please enter a room id', 'toast.joinFail':'Failed to join', 'toast.joinFailPwd':'Failed to join (password may be needed)',
    'toast.aiNotCfg':'AI not configured: add your API Key to ai.config.json and restart', 'toast.noRef':'No messages to reference yet', 'toast.aiThinking':'🤖 AI thinking...', 'toast.aiEmpty':'AI has nothing yet, try later', 'toast.aiUnavailable':'AI unavailable',
    'toast.accepted':'Accepted, entering private chat', 'toast.opFail':'Operation failed', 'toast.dupRequest':'Request already sent', 'toast.sent':'Request sent, waiting for approval', 'toast.sendFail':'Failed to send',
    'toast.themeOk':'Theme applied', 'toast.themeFail':'Failed to switch', 'toast.bgUpdated':'Chat background updated', 'toast.updateFail':'Update failed', 'toast.bgReset':'Default background restored', 'toast.saved':'Profile saved', 'toast.saveFail':'Save failed', 'toast.pbgUpdated':'Profile background updated', 'toast.setFail':'Failed to set', 'toast.avatarOk':'Avatar updated', 'toast.uploadFail':'Upload failed', 'toast.avatarRemoved':'Avatar removed', 'toast.bgOk':'Background updated', 'toast.pwdShort':'Password must be at least 6 characters', 'toast.pwdDiff':'Passwords do not match', 'toast.pwdOk':'Password changed', 'toast.pwdFail':'Failed to change',
    'err.notLogin':'Not logged in', 'err.emptyCred':'Username and password required', 'err.badUserFmt':'Username must be 2-20 characters', 'err.pwdShort':'Password at least 6 characters', 'err.userTaken':'Username already taken', 'err.server':'Server error', 'err.needCred':'Enter username and password', 'err.badLogin':'Wrong username or password', 'err.oldPwd':'Wrong current password', 'err.avatarBig':'Avatar too large (under 300KB)', 'err.bioLong':'Bio max 200 characters', 'err.noUser':'User not found', 'err.noPost':'Post not found', 'err.noPerm':'Only the author or admin can delete', 'err.selfDm':'Cannot message yourself', 'err.inviteGone':'Request missing or already handled', 'err.titleLong':'Title required, max 60 characters', 'err.contentLong':'Content required, max 5000 characters', 'err.commentEmpty':'Comment cannot be empty', 'err.aiGen':'Generation failed', 'err.roomName':'Room name required, max 30 characters', 'err.roomGone':'Room not found, check the id', 'err.roomPwd':'Wrong room password', 'err.roomMissing':'Room not found', 'err.notMember':'You are not a member'
  },
  fr: {
    appName:'Trou d\u2019arbre', 'nav.square':'Place', 'nav.rooms':'Chambres', 'nav.dms':'Messages', 'nav.me':'Profil', 'nav.system':'Syst\u00e8me', 'nav.logout':'D\u00e9connexion', 'nav.settings':'R\u00e9glages',
    'panel.square':'Sujets', 'panel.rooms':'Mes chambres', 'panel.dms':'Messages', 'panel.me':'Mon espace', 'panel.system':'Syst\u00e8me',
    'btn.newPost':'＋ Nouveau sujet', 'btn.createRoom':'＋ Cr\u00e9er une chambre', 'btn.joinRoom':'🔑 Rejoindre', 'btn.findUser':'＋ Chercher', 'btn.leave':'Quitter', 'btn.send':'Envoyer', 'btn.confirm':'Confirmer', 'btn.cancel':'Annuler', 'btn.publish':'Publier', 'btn.edit':'Modifier', 'btn.search':'Chercher', 'btn.comment':'Commenter',
    'ph.joinId':'Entrer un n\u00b0 de chambre', 'ph.roomName':'Nommez votre chambre', 'ph.roomPass':'D\u00e9finir un mot de passe', 'ph.roomId':'N\u00b0 \u00e0 8 chiffres', 'ph.message':'Saisir un message, Entr\u00e9e pour envoyer...', 'ph.postTitle':'De quoi parler ?', 'ph.postContent':'\u00c9crivez vos pens\u00e9es...', 'ph.comment':'\u00c9crivez un commentaire...',
    'modal.createTitle':'Cr\u00e9er une chambre', 'modal.joinTitle':'Rejoindre une chambre', 'modal.roomName':'Nom de la chambre', 'modal.roomPass':'Mot de passe (optionnel)', 'modal.roomId':'N\u00b0 de chambre', 'modal.postTitle':'Nouveau sujet', 'modal.postTitleLabel':'Titre (\u226460 car.)', 'modal.postContentLabel':'Contenu (\u22645000 car.)',
    'ai.helper':'🤖 Assistant IA', 'ai.smartReply':'✨ R\u00e9ponse maligne', 'burn.normal':'Normal', 'burn.sec':'s', 'burn.destroyed':'🔥 D\u00e9truit', 'burn.in':'🔥 d\u00e9truit dans {s}s', 'burn.tip':'Message \u00e9ph\u00e9m\u00e8re : supprim\u00e9 apr\u00e8s le d\u00e9lai choisi',
    'welcome.title':'Bienvenue dans le Trou d\u2019arbre', 'welcome.l1':'D\u00e9couvrez des sujets int\u00e9ressants', 'welcome.l2':'Ouvrez un profil → demandez un chat priv\u00e9', 'welcome.l3':'Ou cr\u00e9ez / rejoignez une chambre priv\u00e9e',
    'sys.lang':'Langue', 'sys.changelog':'Journal des versions',
    'sys.history':'-- {n} messages charg\u00e9s --', 'sys.noHistory':'Aucun message, envoyez le premier', 'sys.dmRequest':'Demande de chat priv\u00e9 de {name}', 'sys.dmAccepted':'Votre demande a \u00e9t\u00e9 accept\u00e9e', 'sys.reconnecting':'D\u00e9connect\u00e9, reconnexion...', 'sys.reconnected':'Reconnect\u00e9', 'sys.enterRoom':'Entr\u00e9 dans la chambre "{name}"', 'sys.enterDm':'Conversation priv\u00e9e', 'sys.leftRoom':'Chambre quitt\u00e9e',
    'content.postDetail':'Sujet', 'content.find':'Chercher', 'content.profile':'Profil',
    'confirm.delPost':'Supprimer ce sujet ? Action irr\u00e9versible.',
    'post.aiAnalyzing':'⏳ Analyse IA...', 'post.delTip':'Supprimer', 'post.comments':'Commentaires ({n})', 'post.noComments':'Aucun commentaire, soyez le premier', 'post.empty':'Aucun sujet dans cette cat\u00e9gorie<br>Commencez avec "＋ Nouveau sujet"',
    'rooms.empty':'Aucune chambre<br>Cr\u00e9ez-en une ci-dessus', 'rooms.members':'{n} pers.', 'rooms.leaveTip':'Quitter',
    'dms.pending':'Demandes ({n})', 'dms.defaultMsg':'Veut discuter avec vous', 'dms.accept':'Accepter', 'dms.decline':'Refuser', 'dms.sent':'Demandes envoy\u00e9es', 'dms.waiting':'⏳ En attente...', 'dms.sessions':'Mes conversations', 'dms.empty':'Aucune conversation<br>Trouvez des gens sur la Place', 'dms.online':'● En ligne', 'dms.offline':'○ Hors ligne', 'dms.with':'Chat priv\u00e9 avec {name}',
    'find.title':'Trouver des gens', 'find.searchBy':'Chercher par nom', 'ph.find':'Entrez un nom...', 'find.empty':'Aucun utilisateur trouv\u00e9', 'find.results':'R\u00e9sultats', 'find.mystery':'Une personne myst\u00e9rieuse',
    'profile.title':'Profil', 'profile.loading':'Chargement...', 'profile.noUser':'Utilisateur introuvable', 'profile.noPosts':'Aucun sujet pour l\u2019instant', 'profile.noInterests':'Aucun centre d\u2019int\u00e9r\u00eat', 'profile.joined':'Inscrit le {date}', 'profile.posts':'Sujets', 'profile.comments':'R\u00e9ponses', 'profile.days':'Jours', 'profile.interests':'🧩 Centres d\u2019int\u00e9r\u00eat', 'profile.signature':'✍️ Signature', 'profile.mysteryBio':'Un myst\u00e8re, n\u2019a rien \u00e9crit', 'profile.myTopics':'📝 Mes sujets', 'profile.taTopics':'📝 Ses sujets', 'profile.editMe':'✏️ Modifier mon profil', 'profile.dmTa':'💌 \u00c9crire', 'profile.dmPrompt':'Envoyer une demande \u00e0 {name} (message optionnel) :',
    'me.profile':'Profil', 'me.profileSub':'Avatar · Bio · Centres d\u2019int\u00e9r\u00eat', 'me.theme':'Th\u00e8me', 'me.themeSub':'4 couleurs', 'me.chatBg':'Arri\u00e8re-plan', 'me.chatBgSub':'D\u00e9grad\u00e9 ou image', 'me.password':'Changer le mot de passe', 'me.passwordSub':'Restez s\u00e9curis\u00e9', 'me.descPlaceholder':'Cliquez pour modifier', 'me.adminBadge':'Admin',
    'set.profile':'Profil', 'set.theme':'Th\u00e8me', 'set.background':'Arri\u00e8re-plan', 'set.password':'Mot de passe', 'set.changeAvatar':'Changer l\u2019avatar', 'set.removeAvatar':'Retirer l\u2019avatar', 'set.bioLabel':'Bio (\u2264200 car.)', 'ph.setBio':'Pr\u00e9sentez-vous', 'set.interestsLabel':'Centres d\u2019int\u00e9r\u00eat (max 6, s\u00e9par\u00e9s par des virgules)', 'ph.setInterests':'ex. nuit, psychologie, tech', 'set.pbgLabel':'Fond du profil (visible par les autres)', 'set.upload':'🖼️ Importer une image', 'set.reset':'↺ R\u00e9tablir', 'set.save':'Enregistrer', 'set.themeHint':'Appliqu\u00e9 globalement, aper\u00e7u imm\u00e9diat', 'set.bgHint':'Appliqu\u00e9 dans le chat', 'set.oldPwd':'Mot de passe actuel', 'set.newPwd':'Nouveau mot de passe (min 6)', 'set.confirmPwd':'Confirmer le nouveau', 'set.confirmBtn':'Confirmer',
    'theme.ocean':'Oc\u00e9an', 'theme.dark':'Minuit', 'theme.sunset':'Coucher de soleil', 'theme.nebula':'N\u00e9buleuse',
    'bg.green':'Vert', 'bg.blue':'Bleu clair', 'bg.sun':'Soleil', 'bg.purple':'Violet clair', 'bg.upload':'Importer une image', 'bg.resetDefault':'R\u00e9tablir le fond', 'bg.presetTip':'Pr\u00e9r\u00e9glage {id}',
    'filter.all':'Tous', 'filter.deep':'🧠 Profond', 'filter.exp':'📚 Exp\u00e9rience', 'filter.help':'🆘 Aide', 'filter.emo':'💭 \u00c9motion', 'filter.high':'⭐ Top',
    'tag.deep':'Analyse profonde', 'tag.exp':'Exp\u00e9rience', 'tag.help':'Aide', 'tag.emo':'\u00c9motion', 'tag.discuss':'Discussion', 'tag.spam':'Spam', 'tag.high':'Haute qualit\u00e9',
    'room.dmSession':'Conversation priv\u00e9e', 'room.info':'Chambre {id} · {n} pers.',
    'toast.fast':'Trop rapide, respirez～', 'toast.tooFast':'Trop rapide, respirez～', 'toast.langOk':'Langue chang\u00e9e',
    'toast.deleted':'Sujet supprim\u00e9', 'toast.delFail':'\u00c9chec de suppression', 'toast.needTitle':'Veuillez saisir un titre', 'toast.posted':'Publi\u00e9', 'toast.postFail':'\u00c9chec de publication', 'toast.noPost':'Sujet introuvable', 'toast.commentFail':'\u00c9chec du commentaire', 'toast.leaveFail':'\u00c9chec de sortie', 'toast.needRoomName':'Veuillez saisir un nom de chambre', 'toast.createFail':'Cr\u00e9ation \u00e9chou\u00e9e', 'toast.needRoomId':'Veuillez saisir un n\u00b0 de chambre', 'toast.joinFail':'\u00c9chec de l\u2019entr\u00e9e', 'toast.joinFailPwd':'\u00c9chec de l\u2019entr\u00e9e (mot de passe requis ?)',
    'toast.aiNotCfg':'IA non configur\u00e9e : ajoutez votre cl\u00e9 API dans ai.config.json', 'toast.noRef':'Aucun message de r\u00e9f\u00e9rence', 'toast.aiThinking':'🤖 L\u2019IA r\u00e9fl\u00e9chit...', 'toast.aiEmpty':'L\u2019IA n\u2019a rien trouv\u00e9, r\u00e9essayez', 'toast.aiUnavailable':'IA indisponible',
    'toast.accepted':'Accept\u00e9, entr\u00e9e en conversation priv\u00e9e', 'toast.opFail':'Op\u00e9ration \u00e9chou\u00e9e', 'toast.dupRequest':'Demande d\u00e9j\u00e0 envoy\u00e9e', 'toast.sent':'Demande envoy\u00e9e, en attente', 'toast.sendFail':'Envoi \u00e9chou\u00e9',
    'toast.themeOk':'Th\u00e8me appliqu\u00e9', 'toast.themeFail':'\u00c9chec de changement', 'toast.bgUpdated':'Fond mis \u00e0 jour', 'toast.updateFail':'Mise \u00e0 jour \u00e9chou\u00e9e', 'toast.bgReset':'Fond par d\u00e9faut restaur\u00e9', 'toast.saved':'Profil enregistr\u00e9', 'toast.saveFail':'Enregistrement \u00e9chou\u00e9', 'toast.pbgUpdated':'Fond du profil mis \u00e0 jour', 'toast.setFail':'\u00c9chec', 'toast.avatarOk':'Avatar mis \u00e0 jour', 'toast.uploadFail':'Import \u00e9chou\u00e9', 'toast.avatarRemoved':'Avatar retir\u00e9', 'toast.bgOk':'Fond mis \u00e0 jour', 'toast.pwdShort':'Le mot de passe doit faire au moins 6 caract\u00e8res', 'toast.pwdDiff':'Les mots de passe ne correspondent pas', 'toast.pwdOk':'Mot de passe modifi\u00e9', 'toast.pwdFail':'\u00c9chec de modification',
    'err.notLogin':'Non connect\u00e9', 'err.emptyCred':'Nom et mot de passe requis', 'err.badUserFmt':'Le nom doit faire 2-20 caract\u00e8res', 'err.pwdShort':'Mot de passe : 6 caract\u00e8res min.', 'err.userTaken':'Ce nom est d\u00e9j\u00e0 pris', 'err.server':'Erreur serveur', 'err.needCred':'Entrez nom et mot de passe', 'err.badLogin':'Nom ou mot de passe incorrect', 'err.oldPwd':'Mot de passe actuel incorrect', 'err.avatarBig':'Avatar trop lourd (moins de 300KB)', 'err.bioLong':'Bio : 200 caract\u00e8res max', 'err.noUser':'Utilisateur introuvable', 'err.noPost':'Sujet introuvable', 'err.noPerm':'Seul l\u2019auteur ou l\u2019admin peut supprimer', 'err.selfDm':'Impossible de s\u2019\u00e9crire', 'err.inviteGone':'Demande introuvable ou d\u00e9j\u00e0 trait\u00e9e', 'err.titleLong':'Titre requis, 60 caract\u00e8res max', 'err.contentLong':'Contenu requis, 5000 caract\u00e8res max', 'err.commentEmpty':'Le commentaire ne peut pas \u00eatre vide', 'err.aiGen':'G\u00e9n\u00e9ration \u00e9chou\u00e9e', 'err.roomName':'Nom requis, 30 caract\u00e8res max', 'err.roomGone':'Chambre introuvable, v\u00e9rifiez le n\u00b0', 'err.roomPwd':'Mot de passe incorrect', 'err.roomMissing':'Chambre introuvable', 'err.notMember':'Vous n\u2019\u00eates pas membre'
  },
  de: {
    appName:'Baumloch', 'nav.square':'Platz', 'nav.rooms':'R\u00e4ume', 'nav.dms':'Nachrichten', 'nav.me':'Ich', 'nav.system':'System', 'nav.logout':'Abmelden', 'nav.settings':'Einstellungen',
    'panel.square':'Themen', 'panel.rooms':'Meine R\u00e4ume', 'panel.dms':'Nachrichten', 'panel.me':'Mein Bereich', 'panel.system':'System',
    'btn.newPost':'＋ Neuer Beitrag', 'btn.createRoom':'＋ Raum erstellen', 'btn.joinRoom':'🔑 Beitreten', 'btn.findUser':'＋ Suchen', 'btn.leave':'Verlassen', 'btn.send':'Senden', 'btn.confirm':'Best\u00e4tigen', 'btn.cancel':'Abbrechen', 'btn.publish':'Ver\u00f6ffentlichen', 'btn.edit':'Bearbeiten', 'btn.search':'Suchen', 'btn.comment':'Kommentieren',
    'ph.joinId':'Raumnummer eingeben, Enter zum Beitreten', 'ph.roomName':'Name deinen Raum', 'ph.roomPass':'Passwort festlegen', 'ph.roomId':'8-stellige Raumnummer', 'ph.message':'Nachricht eingeben, Enter zum Senden...', 'ph.postTitle':'Wor\u00fcber m\u00f6chtest du reden?', 'ph.postContent':'Schreibe deine Gedanken...', 'ph.comment':'Schreibe einen Kommentar...',
    'modal.createTitle':'Raum erstellen', 'modal.joinTitle':'Raum beitreten', 'modal.roomName':'Raumname', 'modal.roomPass':'Passwort (optional)', 'modal.roomId':'Raumnummer', 'modal.postTitle':'Neues Thema', 'modal.postTitleLabel':'Titel (\u226460 Zeichen)', 'modal.postContentLabel':'Inhalt (\u22645000 Zeichen)',
    'ai.helper':'🤖 KI-Assistent', 'ai.smartReply':'✨ Intelligente Antwort', 'burn.normal':'Normal', 'burn.sec':'s', 'burn.destroyed':'🔥 Zerst\u00f6rt', 'burn.in':'🔥 zerst\u00f6rt in {s}s', 'burn.tip':'Nachricht wird nach der gew\u00e4hlten Zeit gel\u00f6scht',
    'welcome.title':'Willkommen im Baumloch', 'welcome.l1':'Finde interessante Themen auf dem Platz', 'welcome.l2':'\u00d6ffne ein Profil → bitte um privaten Chat', 'welcome.l3':'Oder erstelle / tritt einem privaten Raum bei',
    'sys.lang':'Sprache', 'sys.changelog':'Versionsprotokoll',
    'sys.history':'-- {n} Nachrichten geladen --', 'sys.noHistory':'Noch keine Nachrichten, schreibe die erste', 'sys.dmRequest':'Private-Chat-Anfrage von {name}', 'sys.dmAccepted':'Deine Anfrage wurde angenommen', 'sys.reconnecting':'Getrennt, verbinde neu...', 'sys.reconnected':'Wieder verbunden', 'sys.enterRoom':'Raum "{name}" betreten', 'sys.enterDm':'Privater Chat', 'sys.leftRoom':'Raum verlassen',
    'content.postDetail':'Beitrag', 'content.find':'Personen suchen', 'content.profile':'Profil',
    'confirm.delPost':'Diesen Beitrag l\u00f6schen? Das kann nicht r\u00fcckg\u00e4ngig gemacht werden.',
    'post.aiAnalyzing':'⏳ KI analysiert...', 'post.delTip':'L\u00f6schen', 'post.comments':'Kommentare ({n})', 'post.noComments':'Noch keine Kommentare, sei der Erste', 'post.empty':'Noch keine Beitr\u00e4ge in dieser Kategorie<br>Starte mit "＋ Neuer Beitrag"',
    'rooms.empty':'Noch keine R\u00e4ume<br>Erstelle oben einen', 'rooms.members':'{n} Personen', 'rooms.leaveTip':'Verlassen',
    'dms.pending':'Anfragen ({n})', 'dms.defaultMsg':'M\u00f6chte mit dir chatten', 'dms.accept':'Annehmen', 'dms.decline':'Ablehnen', 'dms.sent':'Gesendete Anfragen', 'dms.waiting':'⏳ Warten auf Antwort...', 'dms.sessions':'Meine Chats', 'dms.empty':'Noch keine Chats<br>Finde Leute auf dem Platz', 'dms.online':'● Online', 'dms.offline':'○ Offline', 'dms.with':'Privater Chat mit {name}',
    'find.title':'Personen suchen', 'find.searchBy':'Nach Benutzername suchen', 'ph.find':'Benutzername eingeben...', 'find.empty':'Keine Benutzer gefunden', 'find.results':'Ergebnisse', 'find.mystery':'Eine mysteri\u00f6se Person',
    'profile.title':'Profil', 'profile.loading':'Laden...', 'profile.noUser':'Benutzer nicht gefunden', 'profile.noPosts':'Noch keine Themen', 'profile.noInterests':'Keine Interessen gesetzt', 'profile.joined':'Beigetreten {date}', 'profile.posts':'Themen', 'profile.comments':'Antworten', 'profile.days':'Tage', 'profile.interests':'🧩 Interessen', 'profile.signature':'✍️ Signatur', 'profile.mysteryBio':'Ein R\u00e4tsel, hat nichts geschrieben', 'profile.myTopics':'📝 Meine Themen', 'profile.taTopics':'📝 Seine/Ihre Themen', 'profile.editMe':'✏️ Profil bearbeiten', 'profile.dmTa':'💌 Nachricht', 'profile.dmPrompt':'Anfrage an {name} senden (optionale Nachricht):',
    'me.profile':'Profil', 'me.profileSub':'Avatar · Bio · Interessen', 'me.theme':'Design', 'me.themeSub':'4 Farbthemen', 'me.chatBg':'Chat-Hintergrund', 'me.chatBgSub':'Verlauf oder Bild', 'me.password':'Passwort \u00e4ndern', 'me.passwordSub':'Bleib sicher', 'me.descPlaceholder':'Klicken zum Bearbeiten', 'me.adminBadge':'Admin',
    'set.profile':'Profil', 'set.theme':'Design', 'set.background':'Chat-Hintergrund', 'set.password':'Passwort \u00e4ndern', 'set.changeAvatar':'Avatar \u00e4ndern', 'set.removeAvatar':'Avatar entfernen', 'set.bioLabel':'Bio (\u2264200 Zeichen)', 'ph.setBio':'Stell dich vor', 'set.interestsLabel':'Interessen (max 6, mit Kommas getrennt)', 'ph.setInterests':'z.B. Nachtgespr\u00e4che, Psychologie, Tech', 'set.pbgLabel':'Profil-Hintergrund (f\u00fcr andere sichtbar)', 'set.upload':'🖼️ Bild hochladen', 'set.reset':'↺ Zur\u00fccksetzen', 'set.save':'Profil speichern', 'set.themeHint':'Gilt \u00fcberall, sofortige Vorschau', 'set.bgHint':'Gilt im Chat', 'set.oldPwd':'Aktuelles Passwort', 'set.newPwd':'Neues Passwort (min 6)', 'set.confirmPwd':'Neues Passwort best\u00e4tigen', 'set.confirmBtn':'Best\u00e4tigen',
    'theme.ocean':'Ozean', 'theme.dark':'Mitternacht', 'theme.sunset':'Sonnenuntergang', 'theme.nebula':'Nebel',
    'bg.green':'Gr\u00fcn', 'bg.blue':'Hellblau', 'bg.sun':'Sonnig', 'bg.purple':'Hellviolett', 'bg.upload':'Bild hochladen', 'bg.resetDefault':'Hintergrund zur\u00fccksetzen', 'bg.presetTip':'Voreinstellung {id}',
    'filter.all':'Alle', 'filter.deep':'🧠 Tief', 'filter.exp':'📚 Erfahrung', 'filter.help':'🆘 Hilfe', 'filter.emo':'💭 Emotion', 'filter.high':'⭐ Top',
    'tag.deep':'Tiefenanalyse', 'tag.exp':'Erfahrung', 'tag.help':'Hilfe', 'tag.emo':'Emotion', 'tag.discuss':'Diskussion', 'tag.spam':'Spam', 'tag.high':'Hochwertig',
    'room.dmSession':'Privater Chat', 'room.info':'Raum {id} · {n} Personen',
    'toast.fast':'Zu schnell, atme durch～', 'toast.tooFast':'Zu schnell, atme durch～', 'toast.langOk':'Sprache gewechselt',
    'toast.deleted':'Beitrag gel\u00f6scht', 'toast.delFail':'L\u00f6schen fehlgeschlagen', 'toast.needTitle':'Bitte einen Titel eingeben', 'toast.posted':'Ver\u00f6ffentlicht', 'toast.postFail':'Ver\u00f6ffentlichung fehlgeschlagen', 'toast.noPost':'Beitrag nicht gefunden', 'toast.commentFail':'Kommentar fehlgeschlagen', 'toast.leaveFail':'Verlassen fehlgeschlagen', 'toast.needRoomName':'Bitte einen Raumnamen eingeben', 'toast.createFail':'Erstellen fehlgeschlagen', 'toast.needRoomId':'Bitte eine Raumnummer eingeben', 'toast.joinFail':'Beitritt fehlgeschlagen', 'toast.joinFailPwd':'Beitritt fehlgeschlagen (Passwort n\u00f6tig?)',
    'toast.aiNotCfg':'KI nicht konfiguriert: API-Key in ai.config.json eintragen', 'toast.noRef':'Noch keine Nachrichten zum Referenzieren', 'toast.aiThinking':'🤖 KI denkt nach...', 'toast.aiEmpty':'KI hat nichts gefunden, versuche es sp\u00e4ter', 'toast.aiUnavailable':'KI nicht verf\u00fcgbar',
    'toast.accepted':'Angenommen, Privater Chat startet', 'toast.opFail':'Operation fehlgeschlagen', 'toast.dupRequest':'Anfrage bereits gesendet', 'toast.sent':'Anfrage gesendet, warte auf Antwort', 'toast.sendFail':'Senden fehlgeschlagen',
    'toast.themeOk':'Design angewendet', 'toast.themeFail':'Wechsel fehlgeschlagen', 'toast.bgUpdated':'Chat-Hintergrund aktualisiert', 'toast.updateFail':'Aktualisierung fehlgeschlagen', 'toast.bgReset':'Standard-Hintergrund wiederhergestellt', 'toast.saved':'Profil gespeichert', 'toast.saveFail':'Speichern fehlgeschlagen', 'toast.pbgUpdated':'Profil-Hintergrund aktualisiert', 'toast.setFail':'Fehlgeschlagen', 'toast.avatarOk':'Avatar aktualisiert', 'toast.uploadFail':'Upload fehlgeschlagen', 'toast.avatarRemoved':'Avatar entfernt', 'toast.bgOk':'Hintergrund aktualisiert', 'toast.pwdShort':'Passwort: mindestens 6 Zeichen', 'toast.pwdDiff':'Passw\u00f6rter stimmen nicht \u00fcberein', 'toast.pwdOk':'Passwort ge\u00e4ndert', 'toast.pwdFail':'\u00c4nderung fehlgeschlagen',
    'err.notLogin':'Nicht angemeldet', 'err.emptyCred':'Benutzername und Passwort erforderlich', 'err.badUserFmt':'Benutzername: 2-20 Zeichen', 'err.pwdShort':'Passwort: mindestens 6 Zeichen', 'err.userTaken':'Benutzername bereits vergeben', 'err.server':'Serverfehler', 'err.needCred':'Benutzername und Passwort eingeben', 'err.badLogin':'Falscher Benutzername oder falsches Passwort', 'err.oldPwd':'Falsches aktuelles Passwort', 'err.avatarBig':'Avatar zu gro\u00df (unter 300KB)', 'err.bioLong':'Bio: max. 200 Zeichen', 'err.noUser':'Benutzer nicht gefunden', 'err.noPost':'Beitrag nicht gefunden', 'err.noPerm':'Nur Autor oder Admin kann l\u00f6schen', 'err.selfDm':'Du kannst dir nicht selbst schreiben', 'err.inviteGone':'Anfrage fehlt oder bereits bearbeitet', 'err.titleLong':'Titel erforderlich, max. 60 Zeichen', 'err.contentLong':'Inhalt erforderlich, max. 5000 Zeichen', 'err.commentEmpty':'Kommentar darf nicht leer sein', 'err.aiGen':'Generierung fehlgeschlagen', 'err.roomName':'Raumname erforderlich, max. 30 Zeichen', 'err.roomGone':'Raum nicht gefunden, pr\u00fcfe die Nummer', 'err.roomPwd':'Falsches Raum-Passwort', 'err.roomMissing':'Raum nicht gefunden', 'err.notMember':'Du bist kein Mitglied'
  }
};let lang = localStorage.getItem('sd_lang') || 'zh';
function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.zh[key] || key; }
// 服务端返回的中文错误 → 当前语言
const ERR_MAP = { '未登录':'err.notLogin', '用户名和密码不能为空':'err.emptyCred', '用户名需为2-20位字母/数字/下划线/中文':'err.badUserFmt', '密码至少 6 位':'err.pwdShort', '该用户名已被注册':'err.userTaken', '服务器内部错误':'err.server', '请输入用户名和密码':'err.needCred', '用户名或密码错误':'err.badLogin', '原密码错误':'err.oldPwd', '头像图片过大（需小于约300KB）':'err.avatarBig', '简介最多 200 字':'err.bioLong', '用户不存在':'err.noUser', '帖子不存在':'err.noPost', '只有作者或管理员可以删除':'err.noPerm', '不能和自己私信':'err.selfDm', '申请不存在或已处理':'err.inviteGone', '标题不能为空且不超过60字':'err.titleLong', '内容不能为空且不超过5000字':'err.contentLong', '评论不能为空':'err.commentEmpty', '生成失败':'err.aiGen', '房间名不能为空且不超过30字':'err.roomName', '房间不存在，请检查房间号':'err.roomGone', '房间密码错误':'err.roomPwd', '房间不存在':'err.roomMissing', '你不是该房间成员':'err.notMember' };
function eMsg(e) { return (typeof e === 'string' && ERR_MAP[e]) ? t(ERR_MAP[e]) : e; }
// AI 打标存储值 → 当前语言显示
const TAG_MAP = { '深度分析':'tag.deep', '经验分享':'tag.exp', '求助':'tag.help', '情绪宣泄':'tag.emo', '讨论':'tag.discuss', '灌水':'tag.spam', '高质量':'tag.high' };
function tagText(tag) { return TAG_MAP[tag] ? t(TAG_MAP[tag]) : tag; }
function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.getAttribute('data-i18n-title')); });
  document.documentElement.lang = lang;
  if (currentNav === 'me') renderMe();
  if (currentNav === 'square') { renderPostFilter(); renderPostList(); if (currentPost) renderPostDetail(currentPost); }
  if (currentNav === 'rooms') renderRooms(myRoomsCache);
  if (currentNav === 'dms') renderDms(dmCache.sessions, dmCache.received, dmCache.sent);
  const sub = $('room-sub');
  if (sub && currentRoom) renderRoomSub();
  if (currentNav === 'system') renderSystem();
}
function setLang(l) {
  lang = l;
  localStorage.setItem('sd_lang', l);
  applyLang();
  document.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === l));
  toast(t('toast.langOk'));
}
// 版本更迭说明（简洁版，随语言切换）
const CHANGELOG = {
  zh: [
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
  ],
  en: [
    ['v1', 'Launch: register/login, private rooms, DMs'],
    ['v2', 'Topic square: posts, replies, likes'],
    ['v3', 'Personalization: themes, avatars, chat backgrounds'],
    ['v4', 'AI mod: auto tags + smart reply suggestions'],
    ['v5', 'Mobile layout + logo'],
    ['v6', 'Login animation, profile revamp, admin account'],
    ['v7', 'Welcome animation, page transitions, profile upgrade'],
    ['v8', 'Room & mobile fixes, performance'],
    ['v9', 'Theme/background fixes, profile covers, anti-spam'],
    ['v10', 'Renamed "Tree Hole", system settings (languages), security']
  ],
  fr: [
    ['v1', 'Lancement : inscription/connexion, chambres priv\u00e9es, messages'],
    ['v2', 'Place aux sujets : publier, r\u00e9pondre, liker'],
    ['v3', 'Personnalisation : th\u00e8mes, avatars, fonds de chat'],
    ['v4', 'Mod\u00e9ration IA : \u00e9tiquettes + r\u00e9ponses intelligentes'],
    ['v5', 'Adaptation mobile + logo'],
    ['v6', 'Animation de connexion, profil, compte admin'],
    ['v7', 'Animation d\u2019accueil, transitions, profil am\u00e9lior\u00e9'],
    ['v8', 'Corrections chambres & mobile, performance'],
    ['v9', 'Corrections th\u00e8mes/fonds, couvertures, anti-spam'],
    ['v10', 'Renomm\u00e9 "Trou d\u2019arbre", r\u00e9glages (langues), s\u00e9curit\u00e9']
  ],
  de: [
    ['v1', 'Start: Registrierung/Login, private R\u00e4ume, Nachrichten'],
    ['v2', 'Themenplatz: Beitr\u00e4ge, Antworten, Likes'],
    ['v3', 'Personalisierung: Designs, Avatare, Chat-Hintergr\u00fcnde'],
    ['v4', 'KI-Moderator: Tags + intelligente Antworten'],
    ['v5', 'Mobile Anpassung + Logo'],
    ['v6', 'Login-Animation, Profil, Admin-Konto'],
    ['v7', 'Willkommens-Animation, \u00dcberg\u00e4nge, Profil-Upgrade'],
    ['v8', 'Raum- & Mobile-Fixes, Performance'],
    ['v9', 'Design/Hintergrund-Fixes, Cover, Anti-Spam'],
    ['v10', 'Umbenannt "Baumloch", System (Sprachen), Sicherheit']
  ]
};
function renderSystem() {
  const el = $('changelog');
  el.innerHTML = (CHANGELOG[lang] || CHANGELOG.zh).map(([v, txt]) => `<div class="cl-item"><span class="cl-ver">${v}</span><span class="cl-txt">${txt}</span></div>`).join('');
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
      addSystemMsg(t('sys.history').replace('{n}', msgs.length));
      msgs.forEach((m) => addChatMsg(m.username, m.text, m.time, m.username === myName, m.burn, m.expireAt));
    } else {
      addSystemMsg(t('sys.noHistory'));
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
    toast(t('sys.dmRequest').replace('{name}', data.invite.from));
    loadDmBadge();
    if (currentNav === 'dms') loadDms();
  });
  socket.on('dm_accepted', () => {
    toast(t('sys.dmAccepted'));
    loadDmBadge();
    if (currentNav === 'dms') loadDms();
  });

  socket.on('disconnect', () => {
    socketReady = false;
    if (currentRoom) addSystemMsg(t('sys.reconnecting'));
  });
  socket.on('reconnect', () => {
    socketReady = true;
    if (currentRoom) {
      socket.emit('join_room', currentRoom.id);
      addSystemMsg(t('sys.reconnected'));
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
    el.innerHTML = '<div class="empty-tip">' + t('post.empty') + '</div>';
    return;
  }
  list.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'list-item' + (p.aiVerdict === 'low' ? ' low-quality' : '');
    let tagHtml = '';
    if (p.aiStatus === 'pending') {
      tagHtml = '<span class="post-tag">' + t('post.aiAnalyzing') + '</span>';
    } else if (p.tags && p.tags.length) {
      tagHtml = p.tags.map((tag) =>
        `<span class="post-tag ${p.aiVerdict === 'high' ? 'high' : p.aiVerdict === 'low' ? 'low' : ''}">${escapeHtml(tagText(tag))}</span>`
      ).join('');
    }
    const canDel = myName === p.author || myName === 'admin';
    item.innerHTML = `
      <div class="info">
        <div class="name">${escapeHtml(p.title)}</div>
        <div class="desc">${escapeHtml(p.author)} · 💬 ${p.commentCount} · ${fmtDate(p.createdAt)}</div>
        ${tagHtml ? `<div class="post-tags">${tagHtml}</div>` : ''}
      </div>
      ${canDel ? `<button class="post-del" onclick="event.stopPropagation();deletePost('${p.id}')" title="${t('post.delTip')}">✕</button>` : ''}`;
    item.onclick = () => openPost(p.id);
    el.appendChild(item);
  });
}

// 删除帖子（作者本人或管理员）
async function deletePost(id) {
  if (!confirm(t('confirm.delPost'))) return;
  const res = await fetch('/api/posts/' + id, { method: 'DELETE', credentials: 'include' });
  const data = await res.json();
  if (data.ok) {
    toast(t('toast.deleted'));
    loadPosts();
    if (currentPost && currentPost.id === id) {
      currentPost = null;
      showView('view-welcome');
      document.body.classList.remove('m-content');
      $('mobile-top').classList.remove('hidden');
    }
  } else {
    toast(eMsg(data.error) || t('toast.delFail'));
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
  if (!title) return toast(t('toast.needTitle'));
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, content })
  });
  const data = await res.json();
  if (data.ok) {
    closeModal('post-modal');
    toast(t('toast.posted'));
    loadPosts();
    scheduleAiPoll();
  } else {
    toast(eMsg(data.error) || t('toast.postFail'));
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
  if (!data.post) return toast(t('toast.noPost'));
  currentPost = data.post;
  showView('view-post');
  showContent(t('content.postDetail'));
  renderPostDetail(data.post);
}

function renderPostDetail(post) {
  const tags = (post.tags || []).length
    ? `<div class="post-tags" style="margin:8px 0 0;">${post.tags.map((tag) => `<span class="post-tag">${escapeHtml(tagText(tag))}</span>`).join('')}</div>`
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
        ${canDel ? `<button class="post-del lg" onclick="deletePost('${post.id}')" title="${t('post.delTip')}">✕</button>` : ''}
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
      <h3 style="font-size:15px;margin-bottom:6px;">${t('post.comments').replace('{n}', post.comments.length)}</h3>
      <div id="comment-list">${renderComments(post.comments)}</div>
      <div class="comment-input">
        <input id="comment-text" placeholder="${t('ph.comment')}" onkeydown="if(event.key==='Enter')submitComment()">
        <button class="btn" onclick="submitComment()">${t('btn.comment')}</button>
      </div>
    </div>`;
}

function renderComments(comments) {
  if (!comments.length) return '<div class="empty-tip">' + t('post.noComments') + '</div>';
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
    toast(eMsg(data.error) || t('toast.commentFail'));
  }
}

// ========== 群房间 ==========
async function loadRooms() {
  const res = await fetch('/api/rooms', { credentials: 'include' });
  const data = await res.json();
  myRoomsCache = data.rooms || [];
  renderRooms(myRoomsCache);
}

function renderRooms(rooms) {
  const list = $('room-list');
  list.innerHTML = '';
  if (!rooms.length) {
    list.innerHTML = '<div class="empty-tip">' + t('rooms.empty') + '</div>';
    return;
  }
  rooms.forEach((room) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="avatar sm" style="background:linear-gradient(135deg,var(--primary),var(--primary-2));border-radius:10px;">${room.hasPassword ? '🔒' : '💬'}</div>
      <div class="info">
        <div class="name">${escapeHtml(room.name)}</div>
        <div class="desc">${room.id} · ${t('rooms.members').replace('{n}', room.members.length)}</div>
      </div>
      <button class="room-leave" title="${t('rooms.leaveTip')}" onclick="event.stopPropagation();exitRoom('${room.id}')">✕</button>`;
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
    toast(t('sys.leftRoom'));
  } else {
    toast(eMsg(data.error) || t('toast.leaveFail'));
  }
}

function openCreateRoom(isJoin) {
  createMode = isJoin ? 'join' : 'create';
  $('create-modal-title').textContent = isJoin ? t('modal.joinTitle') : t('modal.createTitle');
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
    if (!name) return toast(t('toast.needRoomName'));
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
      toast(eMsg(data.error) || t('toast.createFail'));
    }
  } else {
    const id = $('join-id').value.trim();
    const password = $('create-pass').value;
    if (!id) return toast(t('toast.needRoomId'));
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
      toast(eMsg(data.error) || t('toast.joinFail'));
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
    toast(eMsg(data.error) || t('toast.joinFailPwd'));
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
  addSystemMsg(room.type === 'dm' ? t('sys.enterDm') : t('sys.enterRoom').replace('{name}', room.name));
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
  if (!aiEnabled) return toast(t('toast.aiNotCfg'));
  const recent = collectRecent();
  if (!recent.length) return toast(t('toast.noRef'));
  $('ai-cands').innerHTML = '<div style="font-size:12px;color:var(--muted);padding:6px 2px;">' + t('toast.aiThinking') + '</div>';
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
      $('ai-cands').innerHTML = '<div style="font-size:12px;color:var(--muted);padding:6px 2px;">' + t('toast.aiEmpty') + '</div>';
      return;
    }
    $('ai-cands').innerHTML = data.replies.map((r, i) => `
      <div class="ai-cand">
        <span class="txt">${escapeHtml(r)}</span>
        <button class="btn sm ghost" onclick="fillAiReply(${i})">${t('btn.edit')}</button>
        <button class="btn sm" onclick="sendAiReply(${i})">${t('btn.send')}</button>
      </div>`).join('');
  } catch (e) {
    $('ai-cands').innerHTML = '<div style="font-size:12px;color:var(--muted);padding:6px 2px;">' + t('toast.aiUnavailable') + '</div>';
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
    tip.textContent = t('burn.in').replace('{s}', burn);
    col.appendChild(tip);
    const remainMs = (expireAt || Date.now() + burn * 1000) - Date.now();
    if (remainMs > 0) {
      setTimeout(() => {
        tip.textContent = t('burn.destroyed');
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
  dmCache = { sessions: sData.sessions || [], received: iData.received || [], sent: iData.sent || [] };
  renderDms(dmCache.sessions, dmCache.received, dmCache.sent);
}

function renderDms(sessions, received, sent) {
  const el = $('dm-list');
  let html = '';

  if (received.length) {
    html += `<div class="list-head" style="border:none;padding:10px 12px 4px;"><div class="title" style="font-size:13px;color:var(--danger);">${t('dms.pending').replace('{n}', received.length)}</div></div>`;
    received.forEach((inv) => {
      html += `
        <div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin:6px 8px;background:var(--panel-2);">
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openProfile('${escapeHtml(inv.from)}')">
            ${avatarHtml(inv.from, '', 'sm')}
            <div style="min-width:0;flex:1;">
              <div style="font-size:13px;font-weight:600;">${escapeHtml(inv.from)}</div>
              <div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(inv.message || t('dms.defaultMsg'))}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn sm" style="flex:1;" onclick="acceptInvite('${inv.id}')">${t('dms.accept')}</button>
            <button class="btn sm ghost" style="flex:1;" onclick="declineInvite('${inv.id}')">${t('dms.decline')}</button>
          </div>
        </div>`;
    });
  }

  if (sent.length) {
    html += `<div class="list-head" style="border:none;padding:10px 12px 4px;"><div class="title" style="font-size:13px;color:var(--muted);">${t('dms.sent')}</div></div>`;
    sent.forEach((inv) => {
      html += `
        <div style="padding:10px 12px;margin:4px 8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${avatarHtml(inv.to, '', 'sm')}
            <div style="min-width:0;flex:1;">
              <div style="font-size:13px;font-weight:600;">${escapeHtml(inv.to)}</div>
              <div style="font-size:12px;color:var(--muted);">${t('dms.waiting')}</div>
            </div>
          </div>
        </div>`;
    });
  }

  html += `<div class="list-head" style="border:none;padding:10px 12px 4px;"><div class="title" style="font-size:13px;color:var(--muted);">${t('dms.sessions')}</div></div>`;

  if (!sessions.length) {
    html += '<div class="empty-tip">' + t('dms.empty') + '</div>';
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
            <div class="desc">${s.isOnline ? t('dms.online') : t('dms.offline')} · ${t('room.dmSession')}</div>
          </div>
        </div>`;
    });
  }

  el.innerHTML = html;
}

function openDmSession(s) {
  enterRoom({ id: s.roomId, name: t('dms.with').replace('{name}', s.other), type: 'dm', members: [myName, s.other] });
}

async function acceptInvite(id) {
  const res = await fetch('/api/dm/invites/' + id + '/accept', {
    method: 'POST',
    credentials: 'include'
  });
  const data = await res.json();
  if (data.ok) {
    toast(t('toast.accepted'));
    loadDms();
    enterRoom(data.room);
  } else {
    toast(eMsg(data.error) || t('toast.opFail'));
  }
}

async function declineInvite(id) {
  await fetch('/api/dm/invites/' + id + '/decline', { method: 'POST', credentials: 'include' });
  loadDms();
}

// 找人
function openFindUser() {
  showView('view-finduser');
  showContent(t('content.find'));
  $('finduser-detail').innerHTML = `
    <div class="card">
      <h2 style="margin-bottom:12px;">${t('find.title')}</h2>
      <div class="form-group">
        <label>${t('find.searchBy')}</label>
        <input id="find-user-input" placeholder="${t('ph.find')}" onkeydown="if(event.key==='Enter')doSearchUser()">
      </div>
      <button class="btn" onclick="doSearchUser()">${t('btn.search')}</button>
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
    box.innerHTML = '<div class="empty-tip">' + t('find.empty') + '</div>';
    return;
  }
  box.innerHTML = '<div class="list-head" style="border:none;padding:10px 12px 4px;"><div class="title" style="font-size:13px;color:var(--muted);">' + t('find.results') + '</div></div>';
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
        <div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(u.bio || t('find.mystery'))}</div>
      </div>`;
    item.onclick = () => openProfile(u.username);
    box.appendChild(item);
  });
}

// ========== 用户主页 ==========
async function openProfile(username) {
  showView('view-profile');
  showContent(t('content.profile'));
  const el = $('profile-detail');
  el.innerHTML = '<div class="empty-tip">' + t('profile.loading') + '</div>';
  const res = await fetch('/api/users/' + encodeURIComponent(username), { credentials: 'include' });
  const data = await res.json();
  if (!data.user) {
    el.innerHTML = '<div class="empty-tip">' + t('profile.noUser') + '</div>';
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
    : '<div class="empty-tip" style="padding:24px 0;">' + t('profile.noPosts') + '</div>';

  const interests = u.interests || [];
  const chipsHtml = interests.length
    ? interests.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')
    : '<div class="empty-tip" style="padding:8px 0;font-size:12px;">' + t('profile.noInterests') + '</div>';

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
        <div class="ph-meta">${u.isOnline ? '🟢 ' + t('dms.online') : '⚪ ' + t('dms.offline')} · ${t('profile.joined').replace('{date}', fmtDate(u.createdAt))}</div>
      </div>
    </div>
    <div class="profile-glass">
      <div class="gs"><div class="gs-num">${u.postCount}</div><div class="gs-label">${t('profile.posts')}</div></div>
      <div class="gs"><div class="gs-num">${u.commentReceived}</div><div class="gs-label">${t('profile.comments')}</div></div>
      <div class="gs"><div class="gs-num">${days}</div><div class="gs-label">${t('profile.days')}</div></div>
    </div>
    <div class="card">
      <div class="card-title">${t('profile.interests')}</div>
      <div class="chips">${chipsHtml}</div>
    </div>
    <div class="card">
      <div class="card-title">${t('profile.signature')}</div>
      <div class="profile-bio">${escapeHtml(u.bio || t('profile.mysteryBio'))}</div>
    </div>
    <div class="card">
      <div class="card-title">📝 ${isMe ? t('profile.myTopics') : t('profile.taTopics')}</div>
      ${postItems}
    </div>
    <div class="profile-actions">
      ${isMe
        ? '<button class="btn" onclick="switchNav(\'me\')">' + t('profile.editMe') + '</button>'
        : '<button class="btn" onclick="sendDmRequest(\'' + escapeHtml(u.username) + '\')">' + t('profile.dmTa') + '</button>'}
    </div>`;
}

async function sendDmRequest(username) {
  const message = prompt(t('profile.dmPrompt').replace('{name}', username));
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
    toast(t('toast.dupRequest'));
  } else if (data.ok) {
    toast(t('toast.sent'));
    loadDmBadge();
  } else {
    toast(eMsg(data.error) || t('toast.sendFail'));
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
            <button class="file-btn" onclick="document.getElementById('avatar-file').click()">${t('set.changeAvatar')}</button>
            <button class="file-btn" onclick="clearAvatar()">${t('set.removeAvatar')}</button>
            <input type="file" id="avatar-file" accept="image/*" class="hidden" onchange="uploadAvatar(this)">
          </div>
        </div>
        <div class="form-group" style="margin-top:16px;">
          <label>${t('set.bioLabel')}</label>
          <textarea id="set-bio" maxlength="200" placeholder="${t('ph.setBio')}">${escapeHtml(me.bio || '')}</textarea>
        </div>
        <div class="form-group">
          <label>${t('set.interestsLabel')}</label>
          <input id="set-interests" value="${(me.interests || []).map(escapeHtml).join('，')}" placeholder="${t('ph.setInterests')}">
        </div>
        <div class="form-group">
          <label>${t('set.pbgLabel')}</label>
          <div class="bg-preset-grid">${renderPbgPresets()}</div>
          <div class="bg-actions">
            <button class="file-btn" onclick="document.getElementById('pbg-file').click()">${t('set.upload')}</button>
            <button class="file-btn" onclick="setProfileBg(null)">${t('set.reset')}</button>
            <input type="file" id="pbg-file" accept="image/*" class="hidden" onchange="uploadProfileBg(this)">
          </div>
        </div>
        <button class="btn" onclick="saveProfile()">${t('set.save')}</button>
      </div>`;
  } else if (type === 'theme') {
    el.innerHTML = `
      <div class="card">
        <h2>${t('set.theme')}</h2>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${t('set.themeHint')}</div>
        <div class="theme-grid">${renderThemeCards()}</div>
      </div>`;
  } else if (type === 'background') {
    el.innerHTML = `
      <div class="card">
        <h2>${t('set.background')}</h2>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${t('set.bgHint')}</div>
        ${renderBgCards()}
      </div>`;
  } else if (type === 'password') {
    el.innerHTML = `
      <div class="card">
        <h2>${t('set.password')}</h2>
        <div class="form-group"><label>${t('set.oldPwd')}</label><input id="set-old-pass" type="password" autocomplete="current-password"></div>
        <div class="form-group"><label>${t('set.newPwd')}</label><input id="set-new-pass" type="password" autocomplete="new-password"></div>
        <div class="form-group"><label>${t('set.confirmPwd')}</label><input id="set-new-pass2" type="password"></div>
        <button class="btn" onclick="changePassword()">${t('set.confirmBtn')}</button>
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
  if (profileBusy.theme) { toast(t('toast.tooFast')); return; }
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
      toast(t('toast.themeOk'));
    } else {
      toast(t('toast.themeFail'));
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
    { id: 'p1', name: t('bg.green') },
    { id: 'p2', name: t('bg.blue') },
    { id: 'p3', name: t('bg.sun') },
    { id: 'p4', name: t('bg.purple') }
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
        <span style="color:#6b7280;text-shadow:none;">${t('bg.upload')}</span>
      </div>
      <input type="file" id="bg-file" accept="image/*" class="hidden" onchange="uploadChatBg(this)">
    </div>
    <div style="margin-top:14px;"><button class="btn ghost sm" onclick="resetChatBg()">${t('bg.resetDefault')}</button></div>`;
}

async function selectChatBg(type, value) {
  if (profileBusy.chatbg) { toast(t('toast.tooFast')); return; }
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
      toast(t('toast.bgUpdated'));
    } else {
      toast(eMsg(data.error) || t('toast.updateFail'));
    }
  } finally { profileBusy.chatbg = false; }
}

async function resetChatBg() {
  if (profileBusy.chatbg) { toast(t('toast.tooFast')); return; }
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
      toast(t('toast.bgReset'));
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
    toast(t('toast.saved'));
  } else {
    toast(eMsg(data.error) || t('toast.saveFail'));
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
      onclick="setProfileBg('preset:${id}')" title="${t('bg.presetTip').replace('{id}', id)}"></div>`).join('');
}

// 设置主页背景（preset:id 或 dataURL 或 null 恢复默认）
async function setProfileBg(val) {
  if (profileBusy.pbg) { toast(t('toast.tooFast')); return; }
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
      toast(val ? t('toast.pbgUpdated') : t('toast.bgReset'));
    } else {
      toast(eMsg(data.error) || t('toast.setFail'));
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
      toast(t('toast.avatarOk'));
    } else {
      toast(eMsg(data.error) || t('toast.uploadFail'));
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
    toast(t('toast.avatarRemoved'));
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
      toast(t('toast.bgOk'));
    } else {
      toast(eMsg(data.error) || t('toast.uploadFail'));
    }
  });
}

async function changePassword() {
  const oldPassword = $('set-old-pass').value;
  const newPassword = $('set-new-pass').value;
  const newPassword2 = $('set-new-pass2').value;
  if (!newPassword || newPassword.length < 6) return toast(t('toast.pwdShort'));
  if (newPassword !== newPassword2) return toast(t('toast.pwdDiff'));
  const res = await fetch('/api/me/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ oldPassword, newPassword })
  });
  const data = await res.json();
  if (data.ok) {
    toast(t('toast.pwdOk'));
    $('set-old-pass').value = '';
    $('set-new-pass').value = '';
    $('set-new-pass2').value = '';
  } else {
    toast(eMsg(data.error) || t('toast.pwdFail'));
  }
}

// ========== 退出登录 ==========
async function logout() {
  if (socket) socket.disconnect();
  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  location.href = 'index.html';
}
