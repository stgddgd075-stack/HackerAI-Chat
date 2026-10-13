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
  systemPrompt: localStorage.getItem('hackerai_system') || 'تو یک دستیار هوشمند و مفید هستی. پاسخ‌ها را واضح، کوتاه و مرتب بنویس.',
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
    image: 'توضیح عکس را بنویس (مثال: گربه فضانورد روی ماه)...',
    music: 'موضوع یا سبک آهنگ...',
    code: 'سوال یا کد برنامه‌نویسی...'
  };
  userInput.placeholder = ph[m] || ph.chat;
  showToast(m === 'chat' ? 'چت عادی' : m === 'image' ? 'حالت ساخت عکس واقعی' : m === 'music' ? 'حالت آهنگ' : 'حالت کد');
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
  messagesEl.innerHTML = `<div class="msg system"><div class="bubble">SYSTEM // از دکمه‌های بالا برای عکس واقعی، آهنگ، کد و صدا استفاده کن.</div></div>`;
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
  return div;
}
function appendImageMsg(dataUrl, save = true) {
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = `<div class="msg-role">HACKERAI</div><div class="bubble"><img src="${dataUrl}" style="max-width:100%;border-radius:8px;display:block" alt="generated"></div>`;
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
      // ===== Real Image Generation =====
      bubble.textContent = 'در حال ساخت عکس واقعی...';
      const dataUrl = await generateImage(text);
      botDiv.remove();
      appendImageMsg(dataUrl);
      showToast('عکس ساخته شد');
    } else {
      // Text modes (chat / music / code)
      let prompt = text;
      if (state.mode === 'music')
        prompt = `شعر کامل فارسی با ورس و کورس + سبک پیشنهادی.\nدرخواست: ${text}`;
      else if (state.mode === 'code')
        prompt = `کد تمیز و کوتاه با توضیح:\n${text}`;

      const fullText = await callGeminiStream(prompt, bubble);
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
    if (/API key|403|401|quota|billing|permission|not available|image/i.test(err.message || '')) {
      showToast('کلید باید پولی باشد یا مدل عکس پشتیبانی نمی‌شود');
    }
  }
  sendBtn.disabled = !state.isOnline;
}

sendBtn.onclick = sendMessage;
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ===== Real Image Generation (Paid keys) =====
async function generateImage(prompt) {
  // Models that support native image generation (need billing)
  const imageModels = [
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-lite-image',
    'gemini-3-pro-image',
    'gemini-2.5-flash-image'
  ];

  let lastError = null;

  for (const model of imageModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;

      const body = {
        contents: [{
          role: 'user',
          parts: [{ text: `Generate an image: ${prompt}` }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          // some models use imageConfig
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        lastError = data.error?.message || `HTTP ${res.status}`;
        continue;
      }

      // Look for inline image data
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
          const b64 = part.inlineData.data;
          const mime = part.inlineData.mimeType || 'image/png';
          return `data:${mime};base64,${b64}`;
        }
        // some responses put image in different structure
        if (part.inline_data && part.inline_data.mime_type?.startsWith('image/')) {
          return `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
        }
      }

      lastError = 'تصویری در پاسخ نبود';
    } catch (e) {
      lastError = e.message;
    }
  }

  throw new Error(lastError || 'ساخت عکس ممکن نشد. کلید پولی با دسترسی تصویر لازم است.');
}

// ===== Streaming text =====
async function callGeminiStream(userText, bubbleEl) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:streamGenerateContent?alt=sse&key=${state.apiKey}`;

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
    throw new Error(errData.error?.message || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

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

function showToast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2600);
}

renderHistory();
