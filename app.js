// Matrix Background
const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');
let matrixInterval;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>[]{}#$%&';
const fontSize = 14;
let columns, drops;

function initMatrix() {
  columns = Math.floor(canvas.width / fontSize);
  drops = Array(columns).fill(1);
}

function drawMatrix() {
  ctx.fillStyle = 'rgba(10, 14, 20, 0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#00ff9f';
  ctx.font = fontSize + 'px monospace';
  for (let i = 0; i < drops.length; i++) {
    const text = chars[Math.floor(Math.random() * chars.length)];
    ctx.fillText(text, i * fontSize, drops[i] * fontSize);
    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}

initMatrix();
matrixInterval = setInterval(drawMatrix, 50);
window.addEventListener('resize', () => { initMatrix(); });

// State
const state = {
  apiKey: localStorage.getItem('hackerai_key') || '',
  model: localStorage.getItem('hackerai_model') || 'gemini-2.0-flash',
  systemPrompt: localStorage.getItem('hackerai_system') || 'تو یک دستیار هوشمند و مفید هستی. پاسخ‌ها را واضح و مرتب بنویس.',
  history: JSON.parse(localStorage.getItem('hackerai_history') || '[]'),
  isOnline: false
};

// DOM
const messagesEl = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model-select');
const systemPromptEl = document.getElementById('system-prompt');
const keyStatus = document.getElementById('key-status');
const toastEl = document.getElementById('toast');

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('section-' + btn.dataset.section).classList.add('active');
  });
});
document.getElementById('btn-chat').classList.add('active');

// Settings
apiKeyInput.value = state.apiKey;
modelSelect.value = state.model;
systemPromptEl.value = state.systemPrompt;

document.getElementById('toggle-key').addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});

document.getElementById('save-settings').addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('لطفاً کلید API را وارد کنید');
    keyStatus.textContent = '✗ کلید خالی است';
    keyStatus.className = 'key-status error';
    return;
  }
  state.apiKey = key;
  state.model = modelSelect.value;
  state.systemPrompt = systemPromptEl.value.trim() || state.systemPrompt;
  localStorage.setItem('hackerai_key', state.apiKey);
  localStorage.setItem('hackerai_model', state.model);
  localStorage.setItem('hackerai_system', state.systemPrompt);
  updateConnectionStatus(true);
  keyStatus.textContent = '✓ کلید ذخیره و متصل شد';
  keyStatus.className = 'key-status success';
  showToast('تنظیمات ذخیره شد');
  document.getElementById('btn-chat').click();
});

document.getElementById('clear-settings').addEventListener('click', () => {
  state.apiKey = '';
  localStorage.removeItem('hackerai_key');
  apiKeyInput.value = '';
  updateConnectionStatus(false);
  keyStatus.textContent = 'کلید پاک شد';
  keyStatus.className = 'key-status';
  showToast('کلید حذف شد');
});

function updateConnectionStatus(online) {
  state.isOnline = online && !!state.apiKey;
  statusDot.classList.toggle('online', state.isOnline);
  statusText.textContent = state.isOnline ? 'متصل' : 'آفلاین';
  userInput.disabled = !state.isOnline;
  sendBtn.disabled = !state.isOnline;
  if (state.isOnline) {
    userInput.placeholder = 'پیام خود را بنویسید...';
  } else {
    userInput.placeholder = 'ابتدا کلید API را در تنظیمات وارد کنید';
  }
}

updateConnectionStatus(!!state.apiKey);

// Chat
function renderHistory() {
  messagesEl.innerHTML = `
    <div class="message system">
      <div class="msg-content">
        <span class="prefix">></span>
        سیستم آماده است. کلید API را در تنظیمات وارد کنید و شروع به چت کنید.
      </div>
    </div>
  `;
  state.history.forEach(msg => appendMessage(msg.role, msg.content, false));
}

function appendMessage(role, content, save = true) {
  const div = document.createElement('div');
  div.className = 'message ' + (role === 'user' ? 'user' : role === 'system' ? 'system' : 'bot');
  const roleLabel = role === 'user' ? 'شما' : role === 'bot' ? 'HackerAI' : '';
  div.innerHTML = `
    ${roleLabel ? `<div class="msg-role">${roleLabel}</div>` : ''}
    <div class="msg-content">${escapeHtml(content)}</div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (save && (role === 'user' || role === 'bot')) {
    state.history.push({ role, content });
    if (state.history.length > 40) state.history = state.history.slice(-40);
    localStorage.setItem('hackerai_history', JSON.stringify(state.history));
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.getElementById('clear-chat').addEventListener('click', () => {
  state.history = [];
  localStorage.removeItem('hackerai_history');
  renderHistory();
  showToast('چت پاک شد');
});

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || !state.isOnline) return;
  userInput.value = '';
  appendMessage('user', text);

  const typing = document.createElement('div');
  typing.className = 'message bot';
  typing.id = 'typing';
  typing.innerHTML = `<div class="msg-role">HackerAI</div><div class="msg-content">در حال فکر کردن...</div>`;
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const reply = await callGemini(text);
    document.getElementById('typing')?.remove();
    appendMessage('bot', reply);
  } catch (err) {
    document.getElementById('typing')?.remove();
    const msg = err.message || 'خطای ناشناخته';
    appendMessage('bot', '✗ خطا: ' + msg);
    if (msg.includes('API key') || msg.includes('403') || msg.includes('401')) {
      updateConnectionStatus(false);
      showToast('کلید نامعتبر است. تنظیمات را بررسی کنید');
    }
  }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function callGemini(userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:generateContent?key=${state.apiKey}`;
  
  const contents = [];
  const recent = state.history.slice(-10);
  for (const h of recent) {
    contents.push({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    });
  }
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const body = {
    contents,
    systemInstruction: { parts: [{ text: state.systemPrompt }] },
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.error?.message || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('پاسخی دریافت نشد');
  return text;
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2800);
}

renderHistory();
