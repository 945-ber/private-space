/**
 * ai.js —— AI 版主 + 智能回复（火山引擎方舟 / 豆包）
 *
 * 能力：
 *   1. classifyPost()   给帖子打标签（深度分析/经验分享/求助/情绪宣泄/灌水）+ 质量分
 *   2. suggestReplies() 根据聊天记录生成 3 条候选回复
 *
 * 配置：把 API Key 填进同目录 ai.config.json 的 apiKey 字段即可。
 *   base_url: https://ark.cn-beijing.volces.com/api/v3 （OpenAI 兼容）
 *   模型默认 doubao-seed-1-6-251015，可自行改 model。
 *
 * 设计原则：AI 不可用（没配 key / 网络失败 / 超时）时所有函数返回 null，
 * 上层据此优雅降级——标签显示"待分类"、快捷回复按钮隐藏，聊天功能不受影响。
 */

const fs = require('fs');
const path = require('path');

let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai.config.json'), 'utf8'));
} catch (e) {
  /* 配置文件缺失时用空配置 */
}

const BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL = cfg.model || process.env.ARK_MODEL || 'doubao-seed-1-6-251015';
const API_KEY = (cfg.apiKey || process.env.ARK_API_KEY || '').trim();

/** AI 是否已配置可用 */
function enabled() {
  return !!API_KEY;
}

/** 通用对话调用（OpenAI 兼容格式），返回助手文本；失败/超时返回 null */
async function chat(messages, opts = {}) {
  if (!enabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 60000);
  try {
    const res = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens || 512,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[AI] HTTP ' + res.status + ': ' + body.slice(0, 200));
      return null;
    }
    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;
    return content;
  } catch (e) {
    if (e.name === 'AbortError') console.error('[AI] 请求超时');
    else console.error('[AI] 调用失败: ' + e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 安全解析 AI 返回的 JSON，失败返回 null */
function parseJson(text) {
  if (!text) return null;
  try {
    // 去掉可能的 markdown 代码块包裹
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

/**
 * 给帖子打标签
 * 返回 { tags:[], quality:0-100, verdict:'high'|'normal'|'low', summary } 或 null
 */
async function classifyPost({ title, content }) {
  const out = await chat([
    {
      role: 'system',
      content:
        '你是社区版主，负责给用户帖子做质量分类。只输出 JSON，格式：' +
        '{"tags":["深度分析"|"经验分享"|"求助"|"情绪宣泄"|"灌水"|"讨论"|"吐槽"],' +
        '"quality":0到100的整数,"verdict":"high"|"normal"|"low","summary":"不超过20字的一句话摘要"}。' +
        '判定规则：有干货、有逻辑、值得讨论的给 high；普通闲聊给 normal；纯灌水、广告、无意义刷屏给 low。'
    },
    {
      role: 'user',
      content: '帖子标题：' + String(title || '') + '\n帖子内容：' + String(content || '')
    }
  ], { maxTokens: 300, temperature: 0.2 });
  const j = parseJson(out);
  if (!j) return null;
  const tags = Array.isArray(j.tags) ? j.tags.filter((t) => typeof t === 'string').slice(0, 3) : [];
  const quality = Math.max(0, Math.min(100, Math.round(Number(j.quality) || 50)));
  const verdict = ['high', 'normal', 'low'].includes(j.verdict) ? j.verdict : 'normal';
  return { tags, quality, verdict, summary: String(j.summary || '').slice(0, 20) };
}

/**
 * 生成 3 条候选回复
 * 入参 recent: [{ username, text }, ...]（最近若干条消息）
 * 返回 [回复1, 回复2, 回复3] 或 null
 */
async function suggestReplies({ recent, myName }) {
  const history = (recent || []).map((m) => (m.username + '：' + m.text)).join('\n');
  if (!history) return null;
  const out = await chat([
    {
      role: 'system',
      content:
        '你是聊天辅助助手。根据最近聊天记录，站在「' + String(myName || '我') + '」的角度，' +
        '给出 3 条自然、简短、贴合场景的中文回复候选。只输出 JSON：' +
        '{"replies":["回复1","回复2","回复3"]}。每条不超过 30 字，语气自然口语化，不要客套废话。'
    },
    { role: 'user', content: '最近的聊天记录：\n' + history }
  ], { maxTokens: 200, temperature: 0.8 });
  const j = parseJson(out);
  if (j && Array.isArray(j.replies)) {
    const list = j.replies.filter((r) => typeof r === 'string' && r.trim()).slice(0, 3);
    if (list.length) return list;
  }
  return null;
}

module.exports = { enabled, classifyPost, suggestReplies, MODEL };
