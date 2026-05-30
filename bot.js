require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const mongoose = require("mongoose");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

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

const newsSchema = new mongoose.Schema({
  url: { type: String, unique: true },
  title: String,
  createdAt: { type: Date, default: Date.now }
});
const News = mongoose.model("News", newsSchema);

const userSchema = new mongoose.Schema({
  userId: { type: Number, unique: true }
});
const User = mongoose.model("User", userSchema);

const chatSchema = new mongoose.Schema({
  chatId: { type: Number, unique: true },
  type: String,
  mode: { type: Number, default: 1 }
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
// 🧹 Escape MarkdownV2 special chars
// =======================
function escMD(text) {
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

// =======================
// 🧹 Clean article content
// =======================
function cleanContent(raw) {
  if (!raw) return "More updates coming soon...";
  let cleaned = raw
    .split("[")[0]
    .replace(/Advertisement\s*\d*/gi, "")
    .replace(/This advertisement has not loaded yet[^\n]*/gi, "")
    .replace(/Article content/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length > 300) cleaned = cleaned.slice(0, 300).trim() + "...";
  return cleaned;
}

// =======================
// 🧠 Format (Mode 1) — plain Markdown
// =======================
function formatNews(article) {
  const footer = footers[Math.floor(Math.random() * footers.length)];
  const p1 = article.description || "No details available.";
  const p2 = cleanContent(article.content);
  return `📰 *${article.title}*\n\n${p1}\n\n${p2}\n\n${footer}`;
}

// =======================
// 🧠 Format (Mode 2) — MarkdownV2 with real blockquote
// Telegram blockquote: each line starts with ">"
// =======================
function formatEnhanced(article, adminText) {
  const p1 = article.description || "No details available.";
  const p2 = cleanContent(article.content);

  // Build blockquote: prefix every line with >
  const toBlockquote = (text) =>
    text.split("\n").map(line => `>${escMD(line)}`).join("\n");

  const quotedP1 = toBlockquote(p1);
  const quotedP2 = toBlockquote(p2);
  const safeAdmin = escMD(adminText);

  return `${quotedP1}\n\n${quotedP2}\n\n${safeAdmin}`;
}

// =======================
// 📡 Fetch random news article
// =======================
async function fetchRandomArticle(categoryKey = null) {
  let res;
  let success = false;

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = getApiKey();
    try {
      let url;
      if (categoryKey && categoryMap[categoryKey]) {
        url = `https://gnews.io/api/v4/search?q=${categoryMap[categoryKey]}&lang=en&max=100&apikey=${apiKey}`;
      } else {
        url = `https://gnews.io/api/v4/top-headlines?lang=en&country=in&max=100&apikey=${apiKey}`;
      }
      res = await axios.get(url);
      if (res.data && res.data.articles) { success = true; break; }
    } catch {
      currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
      usageCount = 0;
    }
  }

  if (!success) return null;

  const articles = shuffleArray(res.data.articles);

  for (const item of articles) {
    if (recentUrls.has(item.url)) continue;
    const exists = await News.findOne({ url: item.url });
    if (!exists) {
      await News.create({ url: item.url, title: item.title }).catch(() => {});
      recentUrls.add(item.url);
      setTimeout(() => recentUrls.delete(item.url), 300000);
      return item;
    }
  }

  return null;
}

// =======================
// 🚀 MODE 1 — /n command
// =======================
async function handleNews(msg, categoryKey = null) {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  if (activeChats.has(chatId)) return;
  activeChats.add(chatId);

  try {
    if (msg.chat.type === "private") {
      await User.updateOne({ userId: msg.from.id }, { userId: msg.from.id }, { upsert: true });
    }
    await Chat.updateOne({ chatId }, { chatId, type: msg.chat.type }, { upsert: true });

    await bot.deleteMessage(chatId, messageId).catch(() => {});

    const article = await fetchRandomArticle(categoryKey);
    if (!article) return;

    const caption = formatNews(article);

    if (article.image) {
      await bot.sendPhoto(chatId, article.image, { caption, parse_mode: "Markdown" });
    } else {
      await bot.sendMessage(chatId, caption, { parse_mode: "Markdown" });
    }

  } catch (err) {
    console.log("MODE1 ERROR:", err.message);
  } finally {
    setTimeout(() => activeChats.delete(chatId), 2000);
  }
}

// =======================
// ✨ MODE 2 — Auto-enhance admin post
// =======================
async function handleAutoEnhance(msg) {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const adminText = msg.text || msg.caption || "";

  if (!adminText.trim()) return;

  const lockKey = `e_${chatId}_${messageId}`;
  if (activeChats.has(lockKey)) return;
  activeChats.add(lockKey);

  try {
    console.log(`MODE2 START: chatId=${chatId} msgId=${messageId} text="${adminText}"`);

    const article = await fetchRandomArticle();
    if (!article) {
      console.log("MODE2: no article found, keeping original msg");
      return;
    }

    const caption = formatEnhanced(article, adminText);

    await bot.deleteMessage(chatId, messageId).catch((e) => {
      console.log("MODE2 DELETE FAILED:", e.message);
    });

    if (article.image) {
      await bot.sendPhoto(chatId, article.image, {
        caption,
        parse_mode: "MarkdownV2"
      });
    } else {
      await bot.sendMessage(chatId, caption, {
        parse_mode: "MarkdownV2"
      });
    }

    console.log("MODE2: done");

  } catch (err) {
    console.log("MODE2 ERROR:", err.message);
  } finally {
    activeChats.delete(lockKey);
  }
}

// =======================
// ✅ MESSAGE HANDLER (private/group)
// =======================
bot.on("message", (msg) => {
  if (!msg.text) return;
  const parts = msg.text.split(" ");
  if (parts[0] !== "/n") return;
  handleNews(msg, parts[1]);
});

// =======================
// ✅ CHANNEL HANDLER
// =======================
bot.on("channel_post", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  // /mode1 — switch to command mode
  if (text === "/mode1") {
    await Chat.updateOne({ chatId }, { chatId, type: "channel", mode: 1 }, { upsert: true });
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    const sent = await bot.sendMessage(chatId, "✅ *Mode 1 activated* — Use /n command to post news", { parse_mode: "Markdown" });
    setTimeout(() => bot.deleteMessage(chatId, sent.message_id).catch(() => {}), 2000);
    return;
  }

  // /mode2 — switch to auto-enhance mode
  if (text === "/mode2") {
    await Chat.updateOne({ chatId }, { chatId, type: "channel", mode: 2 }, { upsert: true });
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    const sent = await bot.sendMessage(chatId, "✅ *Mode 2 activated* — Every admin post will be auto\\-enhanced with news image \\+ snippet", { parse_mode: "MarkdownV2" });
    setTimeout(() => bot.deleteMessage(chatId, sent.message_id).catch(() => {}), 2000);
    return;
  }

  // /n command — always works regardless of mode
  if (text.startsWith("/n")) {
    const parts = text.split(" ");
    handleNews(msg, parts[1]);
    return;
  }

  // Auto-enhance — only if Mode 2 is active for this channel
  try {
    const chatDoc = await Chat.findOne({ chatId });
    const mode = chatDoc ? chatDoc.mode : 1;
    console.log(`CHANNEL POST: chatId=${chatId} mode=${mode} text="${text}"`);

    if (mode === 2) {
      handleAutoEnhance(msg);
    }
  } catch (err) {
    console.log("CHANNEL HANDLER ERROR:", err.message);
  }
});

// =======================
// 🔌 LOAD ADMIN MODULE
// =======================
const admin = require("./admin");
admin(bot, { User, Chat, News }, {
  apiKeys,
  getApiKeyInfo: () => ({ currentKeyIndex, usageCount, maxUsage: MAX_USAGE_PER_KEY })
});

// =======================
// 🔌 LOAD START MODULE
// =======================
const start = require("./start");
start(bot);
