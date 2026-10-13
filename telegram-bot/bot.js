/**
 * HACKERAI Telegram Bot
 * سازنده: امیرحسین پهلوان (@Amir13900001)
 *
 * Env:
 *   BOT_TOKEN   - توکن ربات
 *   PROVIDER    - gemini | openai | deepseek
 *   API_KEY     - کلید هوش مصنوعی
 *   MODEL       - نام مدل (اختیاری)
 */

const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PROVIDER = (process.env.PROVIDER || 'gemini').toLowerCase();
const API_KEY = process.env.API_KEY;
const MODEL = process.env.MODEL || (
  PROVIDER === 'openai' ? 'gpt-4o-mini' :
  PROVIDER === 'deepseek' ? 'deepseek-chat' : 'gemini-3.8-flash'
);

if (!BOT_TOKEN || !API_KEY) {
  console.error('BOT_TOKEN و API_KEY الزامی هستند');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const history = new Map(); // chatId -> messages[]

const SYSTEM = 'تو دستیار هوشمند HACKERAI هستی. ساخته شده توسط امیرحسین پهلوان. پاسخ‌ها را واضح و مفید بنویس.';

console.log('HACKERAI bot started · provider:', PROVIDER, '· model:', MODEL);

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '⬡ *HACKERAI*\n\nچت با هوش مصنوعی.\n\nدستورات:\n/code سوال — کدنویسی\n/music موضوع — متن آهنگ\n\nهر پیام عادی = چت\n\nسازنده: امیرحسین پهلوان',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/code (.+)/s, async (msg, match) => {
  await reply(msg, 'کد تمیز و کوتاه با توضیح بنویس:\n' + match[1]);
});

bot.onText(/\/music (.+)/s, async (msg, match) => {
  await reply(msg, 'شعر کامل فارسی با ورس و کورس + سبک:\n' + match[1]);
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  await reply(msg, msg.text);
});

async function reply(msg, userText) {
  const chatId = msg.chat.id;
  bot.sendChatAction(chatId, 'typing');

  try {
    const answer = await callAI(chatId, userText);
    // Telegram limit ~4096 chars
    const chunks = split(answer, 4000);
    for (const c of chunks) await bot.sendMessage(chatId, c);
  } catch (e) {
    await bot.sendMessage(chatId, '✗ خطا: ' + (e.message || 'نامشخص'));
  }
}

function split(text, max) {
  const out = [];
  for (let i = 0; i < text.length; i += max) out.push(text.slice(i, i + max));
  return out.length ? out : ['(خالی)'];
}

async function callAI(chatId, userText) {
  if (PROVIDER === 'openai' || PROVIDER === 'deepseek') {
    return callOpenAICompatible(chatId, userText);
  }
  return callGemini(chatId, userText);
}

async function callOpenAICompatible(chatId, userText) {
  const base = PROVIDER === 'deepseek'
    ? 'https://api.deepseek.com/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  let msgs = history.get(chatId) || [];
  msgs.push({ role: 'user', content: userText });
  if (msgs.length > 12) msgs = msgs.slice(-12);

  const res = await fetch(base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + API_KEY
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM }, ...msgs],
      max_tokens: 1024
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'HTTP ' + res.status);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('پاسخی نیامد');

  msgs.push({ role: 'assistant', content: text });
  history.set(chatId, msgs);
  return text;
}

async function callGemini(chatId, userText) {
  let msgs = history.get(chatId) || [];
  msgs.push({ role: 'user', content: userText });
  if (msgs.length > 8) msgs = msgs.slice(-8);

  const contents = msgs.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: SYSTEM }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'HTTP ' + res.status);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('پاسخی نیامد');

  msgs.push({ role: 'assistant', content: text });
  history.set(chatId, msgs);
  return text;
}
