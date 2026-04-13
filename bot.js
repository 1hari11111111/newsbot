require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const mongoose = require("mongoose");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

console.log("🤖 Bot is running...");

// =======================
// ✅ MongoDB
// =======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("DB Error:", err.message));

// =======================
// ✅ Schemas
// =======================

// 📰 News
const newsSchema = new mongoose.Schema({
  url: { type: String, unique: true },
  title: String,
  createdAt: { type: Date, default: Date.now }
});
const News = mongoose.model("News", newsSchema);

// 👤 Users
const userSchema = new mongoose.Schema({
  userId: { type: Number, unique: true }
});
const User = mongoose.model("User", userSchema);

// 💬 Chats
const chatSchema = new mongoose.Schema({
  chatId: { type: Number, unique: true },
  type: String
});
const Chat = mongoose.model("Chat", chatSchema);

// =======================
// 🔒 Locks
// =======================
const activeChats = new Set();
const recentUrls = new Set();

// =======================
// 🔑 API KEYS
// =======================
const apiKeys = process.env.GNEWS_API_KEYS.split(",");
let currentKeyIndex = 0;
let usageCount = 0;
const MAX_USAGE_PER_KEY = 5;

function getApiKey() {
  const key = apiKeys[currentKeyIndex];
  usageCount++;

  if (usageCount >= MAX_USAGE_PER_KEY) {
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    usageCount = 0;
    console.log("🔁 Switched API key");
  }

  return key;
}

// =======================
// 🎯 CATEGORY MAP
// =======================
const categoryMap = {
  t: "technology",
  s: "sports",
  b: "business",
  h: "health",
  e: "entertainment"
};

// =======================
// 🎲 Shuffle
// =======================
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// =======================
// 🔀 Footer
// =======================
const footers = [
  "IGNORE KAR DO 😂😂 AAPKA video aata rahega",
  "Stay tuned for more updates 🔥",
  "Forward karo bhai 😎"
];

// =======================
// 🧠 Format
// =======================
function formatNews(article) {
  const footer = footers[Math.floor(Math.random() * footers.length)];

  const p1 = article.description || "No details available.";
  const p2 = article.content
    ? article.content.split("[")[0]
    : "More updates coming soon...";

  return `📰 *${article.title}*

${p1}

${p2}

${footer}`;
}

// =======================
// 🚀 MAIN FUNCTION
// =======================
async function handleNews(msg, categoryKey = null) {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  if (activeChats.has(chatId)) return;
  activeChats.add(chatId);

  try {
    // 👤 Save user
    if (msg.chat.type === "private") {
      await User.updateOne(
        { userId: msg.from.id },
        { userId: msg.from.id },
        { upsert: true }
      );
    }

    // 💬 Save chat
    await Chat.updateOne(
      { chatId: chatId },
      { chatId: chatId, type: msg.chat.type },
      { upsert: true }
    );

    // 🔴 Delete /n
    await bot.deleteMessage(chatId, messageId).catch(() => {});

    let res;
    let success = false;

    // 🔁 API failover
    for (let i = 0; i < apiKeys.length; i++) {
      const apiKey = getApiKey();

      try {
        let url;

        if (categoryKey && categoryMap[categoryKey]) {
          const q = categoryMap[categoryKey];
          url = `https://gnews.io/api/v4/search?q=${q}&lang=en&max=100&apikey=${apiKey}`;
        } else {
          url = `https://gnews.io/api/v4/top-headlines?lang=en&country=in&max=100&apikey=${apiKey}`;
        }

        res = await axios.get(url);

        if (res.data && res.data.articles) {
          success = true;
          break;
        }
      } catch {
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        usageCount = 0;
      }
    }

    if (!success) return;

    let articles = shuffleArray(res.data.articles);

    let article = null;

    for (const item of articles) {
      if (recentUrls.has(item.url)) continue;

      const exists = await News.findOne({ url: item.url });

      if (!exists) {
        article = item;
        break;
      }
    }

    if (!article) return;

    await News.create({
      url: article.url,
      title: article.title
    }).catch(() => {});

    recentUrls.add(article.url);
    setTimeout(() => recentUrls.delete(article.url), 300000);

    const caption = formatNews(article);

    if (article.image) {
      await bot.sendPhoto(chatId, article.image, {
        caption,
        parse_mode: "Markdown"
      });
    } else {
      await bot.sendMessage(chatId, caption, {
        parse_mode: "Markdown"
      });
    }

  } catch (err) {
    console.log("ERROR:", err.message);
  } finally {
    setTimeout(() => activeChats.delete(chatId), 2000);
  }
}

// =======================
// ✅ MESSAGE HANDLER
// =======================
bot.on("message", (msg) => {
  if (!msg.text) return;

  const parts = msg.text.split(" ");
  if (parts[0] !== "/n") return;

  const categoryKey = parts[1];
  handleNews(msg, categoryKey);
});

// =======================
// ✅ CHANNEL HANDLER
// =======================
bot.on("channel_post", (msg) => {
  if (!msg.text) return;

  const parts = msg.text.split(" ");
  if (parts[0] !== "/n") return;

  const categoryKey = parts[1];
  handleNews(msg, categoryKey);
});

// =======================
// 🔌 LOAD ADMIN MODULE
// =======================
const admin = require("./admin");

admin(bot, { User, Chat, News }, {
  apiKeys,
  getApiKeyInfo: () => ({
    currentKeyIndex,
    usageCount,
    maxUsage: MAX_USAGE_PER_KEY
  })
});

// =======================
// 🔌 LOAD START MODULE
// =======================
const start = require("./start");
start(bot);
