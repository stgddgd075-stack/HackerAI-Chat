// ===== Matrix =====
const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);
const chars = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>[]{}#$%&';
const fs = 14; let cols, drops;
function init() { cols = Math.floor(canvas.width / fs); drops = Array(cols).fill(1); }
function draw() {
  ctx.fillStyle = 'rgba(5,8,15,0.05)'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#00ff9f'; ctx.font = fs + 'px monospace';
  for (let i = 0; i < drops.length; i++) {
    ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*fs, drops[i]*fs);
    if (drops[i]*fs > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}
init(); setInterval(draw, 50); addEventListener('resize', init);

// ===== State =====
const state = {
  apiKey: localStorage.getItem('hackerai_key') || '',
  model: localStorage.getItem('hackerai_model') || 'gemini-3.8-flash',
  systemPrompt: localStorage.getItem('hackerai_system') || 'تو یک دستیار هوشمند و مفید هستی. پاسخ‌ها را واضح و مرتب بنویس.',
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
const apiKeyInput = $('api-key');
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

// ===== Settings =====
apiKeyInput.value = state.apiKey;
modelSelect.value = state.model;
systemPromptEl.value = state.systemPrompt;

$('toggle-key').onclick = () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
};

$('save-settings').onclick = () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('کلید را وارد کن');
    keyStatus.textContent = '✗ خالی است'; keyStatus.className = 'key-status error';
    return;
  }
  state.apiKey = key;
  state.model = modelSelect.value;
  state.systemPrompt = systemPromptEl.value.trim() || state.systemPrompt;
  localStorage.setItem('hackerai_key', state.apiKey);
  localStorage.setItem('hackerai_model', state.model);
  localStorage.setItem('hackerai_system', state.systemPrompt);
  updateStatus(true);
  keyStatus.textContent = '✓ متصل شد'; keyStatus.className = 'key-status success';
  showToast('ذخیره شد');
  document.querySelector('[data-section="chat"]').click();
};

$('clear-settings').onclick = () => {
  state.apiKey = ''; localStorage.removeItem('hackerai_key');
  apiKeyInput.value = ''; updateStatus(false);
  keyStatus.textContent = 'پاک شد'; keyStatus.className = 'key-status';
  showToast('کلید حذف شد');
};

function updateStatus(on) {
  state.isOnline = on && !!state.apiKey;
  statusDot.classList.toggle('online', state.isOnline);
  statusText.textContent = state.isOnline ? 'متصل' : 'آفلاین';
  userInput.disabled = sendBtn.disabled = !state.isOnline;
  userInput.placeholder = state.isOnline ? 'دستور خود را بنویس...' : 'اول کلید را وصل کن';
}
updateStatus(!!state.apiKey);

// ===== Modes =====
const modes = { image: $('btn-image'), music: $('btn-music'), code: $('btn-code') };
function setMode(m) {
  state.mode = m;
  Object.values(modes).forEach(b => b.classList.remove('active'));
  if (m !== 'chat' && modes[m]) modes[m].classList.add('active');
  const ph = {
    chat: 'دستور خود را بنویس...',
    image: 'توضیح عکس (مثال: گربه فضانورد)...',
    music: 'موضوع یا سبک آهنگ...',
    code: 'سوال یا کد برنامه‌نویسی...'
  };
  userInput.placeholder = ph[m] || ph.chat;
  showToast(m === 'chat' ? 'چت عادی' : m === 'image' ? 'حالت عکس' : m === 'music' ? 'حالت آهنگ' : 'حالت کد');
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
  btnVoice.textContent = '🔴 گوش می‌دهد...'; recognition.start(); showToast('صحبت کن');
}
function stopListen() {
  isListening = false; btnVoice.classList.remove('listening');
  btnVoice.textContent = '🎤 صدا'; try { recognition?.stop(); } catch {}
}
btnVoice.onclick = () => isListening ? stopListen() : startListen();

// ===== Chat =====
function renderHistory() {
  messagesEl.innerHTML = `<div class="msg system"><div class="bubble">SYSTEM // از دکمه‌های بالا برای عکس، آهنگ، کد و صدا استفاده کن.</div></div>`;
  state.history.forEach(m => appendMsg(m.role, m.content, false));
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
    if (state.history.length > 40) state.history = state.history.slice(-40);
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
  userInput.value = ''; appendMsg('user', text);

  const typing = document.createElement('div');
  typing.className = 'msg bot'; typing.id = 'typing';
  typing.innerHTML = `<div class="msg-role">HACKERAI</div><div class="bubble">در حال پردازش...</div>`;
  messagesEl.appendChild(typing); messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    let prompt = text;
    if (state.mode === 'image')
      prompt = `کاربر می‌خواهد عکس بسازد. چون کلید رایگان Gemini تولید واقعی عکس ندارد، یک پرامپت خیلی حرفه‌ای انگلیسی برای Midjourney/Flux بنویس و بعد ترجمه کوتاه فارسی.

موضوع: ${text}`;
    else if (state.mode === 'music')
      prompt = `یک شعر کامل و زیبا (ترجیحاً فارسی) با ورس و کورس بنویس و سبک پیشنهادی بگو.

درخواست: ${text}`;
    else if (state.mode === 'code')
      prompt = `تو برنامه‌نویس حرفه‌ای هستی. کد تمیز و توضیح‌دار بنویس:

${text}`;

    const reply = await callGemini(prompt);
    $('typing')?.remove(); appendMsg('bot', reply);

    if (window.speechSynthesis && state.lastWasVoice) {
      const u = new SpeechSynthesisUtterance(reply.slice(0, 280));
      u.lang = 'fa-IR'; speechSynthesis.speak(u);
      state.lastWasVoice = false;
    }
  } catch (err) {
    $('typing')?.remove();
    appendMsg('bot', '✗ ' + (err.message || 'خطا'));
    if (/API key|403|401/i.test(err.message || '')) {
      updateStatus(false); showToast('کلید نامعتبر');
    }
  }
}

sendBtn.onclick = sendMessage;
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function callGemini(userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:generateContent?key=${state.apiKey}`;
  const contents = [];
  state.history.slice(-8).forEach(h => {
    contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] });
  });
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: state.systemPrompt }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('پاسخی نیامد');
  return text;
}

function showToast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2600);
}

renderHistory();
