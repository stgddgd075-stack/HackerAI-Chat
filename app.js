// ===== Matrix =====
const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);
const chars = 'アイウエオカキクケコサシスセソ0123456789ABCDEF<>[]{}#$%&';
const fs = 14; let cols, drops;
function initM() { cols = Math.floor(canvas.width / fs); drops = Array(cols).fill(1); }
function drawM() {
  ctx.fillStyle = 'rgba(5,8,15,0.05)'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#00ff9f'; ctx.font = fs + 'px monospace';
  for (let i = 0; i < drops.length; i++) {
    ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*fs, drops[i]*fs);
    if (drops[i]*fs > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}
initM(); setInterval(drawM, 50); addEventListener('resize', initM);

// ===== Models =====
const MODELS = {
  gemini: [
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
  ],
  openai: [
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' },
    { id: 'gpt-6-luna', name: 'GPT-6 Luna' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
    { id: 'gpt-4o', name: 'GPT-4o' }
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'deepseek-flash', name: 'DeepSeek Flash (V4.1)' },
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' }
  ]
};

// ===== State =====
const state = {
  provider: localStorage.getItem('hackerai_provider') || 'gemini',
  geminiKey: localStorage.getItem('hackerai_key') || '',
  openaiKey: localStorage.getItem('hackerai_openai') || '',
  deepseekKey: localStorage.getItem('hackerai_deepseek') || '',
  model: localStorage.getItem('hackerai_model') || 'gemini-3.8-flash',
  systemPrompt: localStorage.getItem('hackerai_system') || 'تو یک دستیار هوشمند و مفید هستی. پاسخ‌ها را واضح و کوتاه بنویس.',
  tgToken: localStorage.getItem('hackerai_tg') || '',
  history: JSON.parse(localStorage.getItem('hackerai_history') || '[]'),
  isOnline: false,
  mode: 'chat',
  lastWasVoice: false
};

const $ = id => document.getElementById(id);
const messagesEl = $('messages');
const userInput = $('user-input');
const sendBtn = $('send-btn');
const statusDot = $('status-dot');
const statusText = $('status-text');
const providerSelect = $('provider-select');
const modelSelect = $('model-select');
const systemPromptEl = $('system-prompt');
const keyStatus = $('key-status');
const toastEl = $('toast');
const btnVoice = $('btn-voice');

// ===== Nav =====
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    $('section-' + btn.dataset.section).classList.add('active');
  };
});

// ===== Provider / Models UI =====
function fillModels() {
  const list = MODELS[state.provider] || MODELS.gemini;
  modelSelect.innerHTML = list.map(m =>
    `<option value="${m.id}" ${m.id === state.model ? 'selected' : ''}>${m.name}</option>`
  ).join('');
  if (!list.find(m => m.id === state.model)) {
    state.model = list[0].id;
    modelSelect.value = state.model;
  }
}

function showKeyGroup() {
  $('key-gemini-group').style.display = state.provider === 'gemini' ? 'block' : 'none';
  $('key-openai-group').style.display = state.provider === 'openai' ? 'block' : 'none';
  $('key-deepseek-group').style.display = state.provider === 'deepseek' ? 'block' : 'none';
}

providerSelect.value = state.provider;
$('api-key').value = state.geminiKey;
$('openai-key').value = state.openaiKey;
$('deepseek-key').value = state.deepseekKey;
$('tg-token').value = state.tgToken;
systemPromptEl.value = state.systemPrompt;
fillModels();
showKeyGroup();

providerSelect.onchange = () => {
  state.provider = providerSelect.value;
  const list = MODELS[state.provider];
  state.model = list[0].id;
  fillModels();
  showKeyGroup();
};

document.querySelectorAll('.toggle-vis').forEach(btn => {
  btn.onclick = () => {
    const inp = $(btn.dataset.target);
    inp.type = inp.type === 'password' ? 'text' : 'password';
  };
});

function currentKey() {
  if (state.provider === 'openai') return state.openaiKey;
  if (state.provider === 'deepseek') return state.deepseekKey;
  return state.geminiKey;
}

$('save-settings').onclick = () => {
  state.provider = providerSelect.value;
  state.geminiKey = $('api-key').value.trim();
  state.openaiKey = $('openai-key').value.trim();
  state.deepseekKey = $('deepseek-key').value.trim();
  state.model = modelSelect.value;
  state.systemPrompt = systemPromptEl.value.trim() || state.systemPrompt;
  state.tgToken = $('tg-token').value.trim();

  localStorage.setItem('hackerai_provider', state.provider);
  localStorage.setItem('hackerai_key', state.geminiKey);
  localStorage.setItem('hackerai_openai', state.openaiKey);
  localStorage.setItem('hackerai_deepseek', state.deepseekKey);
  localStorage.setItem('hackerai_model', state.model);
  localStorage.setItem('hackerai_system', state.systemPrompt);
  localStorage.setItem('hackerai_tg', state.tgToken);

  const key = currentKey();
  if (!key) {
    keyStatus.textContent = '✗ کلید این ارائه‌دهنده خالی است';
    keyStatus.className = 'key-status error';
    updateStatus(false);
    return;
  }
  updateStatus(true);
  keyStatus.textContent = '✓ متصل شد (' + state.provider + ')';
  keyStatus.className = 'key-status success';
  showToast('ذخیره شد');
  document.querySelector('[data-section="chat"]').click();
};

$('clear-settings').onclick = () => {
  state.geminiKey = state.openaiKey = state.deepseekKey = state.tgToken = '';
  ['hackerai_key','hackerai_openai','hackerai_deepseek','hackerai_tg'].forEach(k => localStorage.removeItem(k));
  $('api-key').value = $('openai-key').value = $('deepseek-key').value = $('tg-token').value = '';
  updateStatus(false);
  keyStatus.textContent = 'پاک شد'; keyStatus.className = 'key-status';
  showToast('کلیدها حذف شدند');
};

function updateStatus(on) {
  state.isOnline = on && !!currentKey();
  statusDot.classList.toggle('online', state.isOnline);
  statusText.textContent = state.isOnline ? ('متصل · ' + state.provider) : 'آفلاین';
  userInput.disabled = sendBtn.disabled = !state.isOnline;
  userInput.placeholder = state.isOnline ? 'دستور خود را بنویس...' : 'اول کلید را در تنظیمات وصل کن';
}
updateStatus(!!currentKey());

// ===== Modes =====
const modes = { image: $('btn-image'), music: $('btn-music'), code: $('btn-code') };
function setMode(m) {
  state.mode = m;
  Object.values(modes).forEach(b => b.classList.remove('active'));
  if (m !== 'chat' && modes[m]) modes[m].classList.add('active');
  const ph = {
    chat: 'دستور خود را بنویس...',
    image: 'توضیح عکس (کلید پولی Gemini)...',
    music: 'موضوع یا سبک آهنگ...',
    code: 'سوال یا کد برنامه‌نویسی...'
  };
  userInput.placeholder = ph[m] || ph.chat;
  showToast(m === 'image' ? 'حالت عکس' : m === 'music' ? 'حالت آهنگ' : m === 'code' ? 'حالت کد' : 'چت');
}
modes.image.onclick = () => setMode(state.mode === 'image' ? 'chat' : 'image');
modes.music.onclick = () => setMode(state.mode === 'music' ? 'chat' : 'music');
modes.code.onclick = () => setMode(state.mode === 'code' ? 'chat' : 'code');

// ===== Voice =====
let recognition = null, isListening = false;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'fa-IR'; recognition.continuous = false; recognition.interimResults = false;
  recognition.onresult = e => {
    state.lastWasVoice = true;
    userInput.value = e.results[0][0].transcript;
    stopListen(); sendMessage();
  };
  recognition.onerror = () => { stopListen(); showToast('خطای میکروفن'); };
  recognition.onend = () => stopListen();
}
function startListen() {
  if (!recognition) return showToast('مرورگر پشتیبانی نمی‌کند');
  if (!state.isOnline) return showToast('اول کلید را وصل کن');
  isListening = true; btnVoice.classList.add('listening');
  btnVoice.textContent = '🔴 گوش می‌دهد...'; recognition.start();
}
function stopListen() {
  isListening = false; btnVoice.classList.remove('listening');
  btnVoice.textContent = '🎤 صدا'; try { recognition?.stop(); } catch {}
}
btnVoice.onclick = () => isListening ? stopListen() : startListen();

// ===== Chat UI =====
function renderHistory() {
  messagesEl.innerHTML = `<div class="msg system"><div class="bubble">SYSTEM // Gemini · ChatGPT · DeepSeek — کلید را در تنظیمات وارد کن.</div></div>`;
  state.history.forEach(m => {
    if (m.type === 'image') appendImageMsg(m.content, false);
    else appendMsg(m.role, m.content, false);
  });
}
function appendMsg(role, content, save = true) {
  const div = document.createElement('div');
  div.className = 'msg ' + (role === 'user' ? 'user' : role === 'system' ? 'system' : 'bot');
  const label = role === 'user' ? 'شما' : role === 'bot' ? 'HACKERAI' : '';
  div.innerHTML = `${label ? `<div class="msg-role">${label}</div>` : ''}<div class="bubble">${esc(content)}</div>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (save && (role === 'user' || role === 'bot')) {
    state.history.push({ role, content });
    if (state.history.length > 20) state.history = state.history.slice(-20);
    localStorage.setItem('hackerai_history', JSON.stringify(state.history));
  }
}
function appendImageMsg(dataUrl, save = true) {
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = `<div class="msg-role">HACKERAI</div><div class="bubble"><img src="${dataUrl}" style="max-width:100%;border-radius:8px;display:block" alt="img"></div>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (save) {
    state.history.push({ role: 'bot', type: 'image', content: dataUrl });
    if (state.history.length > 20) state.history = state.history.slice(-20);
    localStorage.setItem('hackerai_history', JSON.stringify(state.history));
  }
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

$('clear-chat').onclick = () => {
  state.history = []; localStorage.removeItem('hackerai_history');
  renderHistory(); showToast('پاک شد');
};

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || !state.isOnline) return;
  userInput.value = '';
  appendMsg('user', text);
  sendBtn.disabled = true;

  const botDiv = document.createElement('div');
  botDiv.className = 'msg bot';
  botDiv.innerHTML = `<div class="msg-role">HACKERAI</div><div class="bubble" id="stream-bubble">در حال پردازش...▌</div>`;
  messagesEl.appendChild(botDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  const bubble = botDiv.querySelector('#stream-bubble');

  try {
    if (state.mode === 'image') {
      if (state.provider !== 'gemini') {
        bubble.textContent = '✗ ساخت عکس فعلاً فقط با کلید پولی Gemini';
      } else {
        bubble.textContent = 'در حال ساخت عکس...';
        const dataUrl = await generateImage(text);
        botDiv.remove();
        appendImageMsg(dataUrl);
        showToast('عکس ساخته شد');
      }
    } else {
      let prompt = text;
      if (state.mode === 'music') prompt = `شعر کامل فارسی با ورس و کورس + سبک.\nدرخواست: ${text}`;
      else if (state.mode === 'code') prompt = `کد تمیز و کوتاه با توضیح:\n${text}`;

      const fullText = await callAI(prompt, bubble);
      state.history.push({ role: 'bot', content: fullText });
      if (state.history.length > 20) state.history = state.history.slice(-20);
      localStorage.setItem('hackerai_history', JSON.stringify(state.history));

      if (window.speechSynthesis && state.lastWasVoice) {
        const u = new SpeechSynthesisUtterance(fullText.slice(0, 250));
        u.lang = 'fa-IR'; speechSynthesis.speak(u);
        state.lastWasVoice = false;
      }
    }
  } catch (err) {
    bubble.textContent = '✗ ' + (err.message || 'خطا');
    if (/API key|401|403|quota|billing|invalid/i.test(err.message || '')) {
      showToast('کلید نامعتبر یا محدودیت');
    }
  }
  sendBtn.disabled = !state.isOnline;
}

sendBtn.onclick = sendMessage;
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ===== Multi-provider AI =====
async function callAI(userText, bubbleEl) {
  if (state.provider === 'openai') return callOpenAI(userText, bubbleEl);
  if (state.provider === 'deepseek') return callDeepSeek(userText, bubbleEl);
  return callGeminiStream(userText, bubbleEl);
}

async function callOpenAI(userText, bubbleEl) {
  const messages = [{ role: 'system', content: state.systemPrompt }];
  state.history.filter(h => !h.type).slice(-6).forEach(h => {
    messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content });
  });
  messages.push({ role: 'user', content: userText });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + state.openaiKey
    },
    body: JSON.stringify({
      model: state.model,
      messages,
      max_tokens: 1024,
      stream: true
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'OpenAI HTTP ' + res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '', buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const chunk = parsed.choices?.[0]?.delta?.content || '';
        if (chunk) {
          full += chunk;
          bubbleEl.textContent = full + '▌';
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      } catch {}
    }
  }
  bubbleEl.textContent = full || 'پاسخی نیامد';
  return full;
}

async function callDeepSeek(userText, bubbleEl) {
  // DeepSeek uses OpenAI-compatible API
  const messages = [{ role: 'system', content: state.systemPrompt }];
  state.history.filter(h => !h.type).slice(-6).forEach(h => {
    messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content });
  });
  messages.push({ role: 'user', content: userText });

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + state.deepseekKey
    },
    body: JSON.stringify({
      model: state.model,
      messages,
      max_tokens: 1024,
      stream: true
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'DeepSeek HTTP ' + res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '', buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const chunk = parsed.choices?.[0]?.delta?.content || '';
        if (chunk) {
          full += chunk;
          bubbleEl.textContent = full + '▌';
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      } catch {}
    }
  }
  bubbleEl.textContent = full || 'پاسخی نیامد';
  return full;
}

async function callGeminiStream(userText, bubbleEl) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:streamGenerateContent?alt=sse&key=${state.geminiKey}`;
  const contents = [];
  state.history.filter(h => !h.type).slice(-4).forEach(h => {
    contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] });
  });
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: state.systemPrompt }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Gemini HTTP ' + res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '', buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (chunk) {
          full += chunk;
          bubbleEl.textContent = full + '▌';
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      } catch {}
    }
  }
  bubbleEl.textContent = full || 'پاسخی نیامد';
  return full;
}

async function generateImage(prompt) {
  const imageModels = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3-pro-image'];
  let lastError = null;
  for (const model of imageModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Generate an image: ' + prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        })
      });
      const data = await res.json();
      if (!res.ok) { lastError = data.error?.message || res.status; continue; }
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
        if (part.inline_data?.mime_type?.startsWith('image/')) {
          return `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
        }
      }
      lastError = 'تصویر در پاسخ نبود';
    } catch (e) { lastError = e.message; }
  }
  throw new Error(lastError || 'ساخت عکس ممکن نشد (کلید پولی لازم است)');
}

function showToast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2600);
}

renderHistory();
