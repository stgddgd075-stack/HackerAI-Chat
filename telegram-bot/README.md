# ربات تلگرام HACKERAI

سایت استاتیک نمی‌تواند ربات تلگرام را ۲۴ ساعته روشن نگه دارد.
این پوشه یک ربات جدا است که روی **Render** دیپلوی می‌کنی.

## نیازها

- توکن ربات از @BotFather
- یکی از کلیدها: Gemini یا OpenAI یا DeepSeek

## دیپلوی روی Render

1. New → Web Service
2. همین مخزن را وصل کن
3. Root Directory: `telegram-bot`
4. Build: `npm install`
5. Start: `npm start`
6. Environment Variables:

```
BOT_TOKEN=توکن_ربات
PROVIDER=gemini
API_KEY=کلید_هوش_مصنوعی
MODEL=gemini-3.8-flash
```

برای OpenAI:
```
PROVIDER=openai
API_KEY=sk-...
MODEL=gpt-4o-mini
```

برای DeepSeek:
```
PROVIDER=deepseek
API_KEY=sk-...
MODEL=deepseek-chat
```

## دستورات ربات

- `/start` — شروع
- هر پیام متنی — چت با هوش مصنوعی
- `/code سوال` — حالت کدنویسی
- `/music موضوع` — متن آهنگ

سازنده: امیرحسین پهلوان (@Amir13900001)
