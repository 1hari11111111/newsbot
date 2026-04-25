# 📰 NewsBot

A Telegram news bot built with Node.js that automatically fetches and delivers news to users.

## 🚀 Features

- Fetches and delivers latest news to Telegram users
- Admin panel for bot management (`admin.js`)
- Easy start script for deployment
- Runs on a VPS for 24/7 uptime

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Platform:** Telegram Bot API
- **Hosting:** VPS (Ubuntu)

```

## ⚙️ Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/1hari11111111/newsbot.git
cd newsbot

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```env
BOT_TOKEN=your_telegram_bot_token
NEWS_API_KEY=your_news_api_key
ADMIN_ID=your_telegram_user_id
```

### 4. Run the bot

```bash
node start.js
```

## 🔧 Running with PM2 (Recommended for VPS)

Keep the bot alive even after terminal closes:

```bash
npm install -g pm2
pm2 start start.js --name newsbot
pm2 save
pm2 startup
```

## 📌 Environment Variables

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Your Telegram bot token from [@BotFather](https://t.me/BotFather) |
| `NEWS_API_KEY` | API key from your news provider |
| `ADMIN_ID` | Your Telegram user ID for admin access |

## ⚠️ Security Notice

- Never commit your `.env` file to GitHub
- Add `.env` to your `.gitignore`
- Rotate your API keys if accidentally exposed

## 📄 License

MIT License — feel free to use and modify.

## 👤 Author

**1hari11111111**  
GitHub: [@1hari11111111](https://github.com/1hari11111111)
