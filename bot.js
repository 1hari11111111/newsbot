require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const mongoose = require("mongoose");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 Bot is running...");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("DB Error:", err.message));

const newsSchema = new mongoose.Schema({
  url: { type: String, unique: true },
  title: String,
  createdAt: { type: Date, default: Date.now }
});
const News = mongoose.model("News", newsSchema);

const userSchema = new mongoose.Schema({ userId: { type: Number, unique: true } });
const User = mongoose.model("User", userSchema);

const chatSchema = new mongoose.Schema({
  chatId: { type: Number, unique: true },
  type: String,
  mode: { type: Number, default: 1 }
});
const Chat = mongoose.model("Chat", chatSchema);

const activeChats = new Set();
const recentUrls = new Set();

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

const categoryMap = {
  t: "technology", s: "sports", b: "business", h: "health", e: "entertainment"
};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const footers = [
  "IGNORE KAR DO 😂😂 AAPKA video aata rahega",
  "Stay tuned for more updates 🔥",
  "Forward karo bhai 😎"
];

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
// 🧠 Format Mode 1 — plain Markdown
// =======================
function formatNews(article) {
  const footer = footers[Math.floor(Math.random() * footers.length)];
  const p1 = article.description || "No details available.";
  const p2 = cleanContent(article.content);
  return `📰 *${article.title}*\n\n${p1}\n\n${p2}\n\n${footer}`;
}

// =======================
// 🧠 Format Mode 2 — single collapsible blockquote (MarkdownV2)
// Telegram expandable blockquote = **>** lines ending with ||
// =======================
function escMD(text) {
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

// =======================
// 🔧 Rebuild admin text preserving Telegram entities (blockquotes, bold, etc.)
// msg.entities contains blockquote, bold, italic, code, text_link etc.
// We rebuild MarkdownV2 from the raw text + entities
// =======================
function rebuildWithEntities(text, entities) {
  if (!entities || entities.length === 0) {
    return escMD(text);
  }

  // Sort entities by offset
  const sorted = [...entities].sort((a, b) => a.offset - b.offset);

  // Build output char by char using UTF-16 code units (Telegram uses UTF-16 offsets)
  // Convert to array of chars for correct offset handling
  const chars = [...text]; // Unicode-safe split
  let result = "";
  let i = 0;

  // We'll process segments between/inside entities
  // Stack-based approach: collect open/close markers per offset
  const opens = {};
  const closes = {};

  for (const entity of sorted) {
    const start = entity.offset;
    const end = entity.offset + entity.length;

    if (!opens[start]) opens[start] = [];
    if (!closes[end]) closes[end] = [];

    switch (entity.type) {
      case "blockquote":
        // Expandable blockquote: each line prefixed with >
        opens[start].push({ type: "blockquote_open", end });
        closes[end].push("blockquote_close");
        break;
      case "bold":
        opens[start].push({ type: "wrap", open: "*", close: "*" });
        closes[end].push("wrap_*");
        break;
      case "italic":
        opens[start].push({ type: "wrap", open: "_", close: "_" });
        closes[end].push("wrap__");
        break;
      case "code":
        opens[start].push({ type: "wrap", open: "`", close: "`" });
        closes[end].push("wrap_`");
        break;
      case "text_link":
        opens[start].push({ type: "link", url: entity.url });
        closes[end].push("link_close");
        break;
    }
  }

  // Simpler flat approach: just reconstruct segment by segment
  result = "";
  let pos = 0;
  const textArr = Array.from(text); // proper unicode chars

  function escapeSegment(seg) {
    return seg.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
  }

  // Collect all boundary positions
  const boundaries = new Set([0, textArr.length]);
  for (const e of sorted) {
    boundaries.add(e.offset);
    boundaries.add(e.offset + e.length);
  }
  const boundaryList = [...boundaries].sort((a, b) => a - b);

  for (let b = 0; b < boundaryList.length - 1; b++) {
    const segStart = boundaryList[b];
    const segEnd = boundaryList[b + 1];
    const segment = textArr.slice(segStart, segEnd).join("");

    // Find which entities cover this segment
    const covering = sorted.filter(e => e.offset <= segStart && e.offset + e.length >= segEnd);

    const blockquoteEntity = covering.find(e => e.type === "blockquote");
    const boldEntity = covering.find(e => e.type === "bold");
    const italicEntity = covering.find(e => e.type === "italic");
    const linkEntity = covering.find(e => e.type === "text_link");

    let seg = escapeSegment(segment);

    if (boldEntity) seg = `*${seg}*`;
    if (italicEntity) seg = `_${seg}_`;
    if (linkEntity) seg = `[${seg}](${escapeSegment(linkEntity.url)})`;

    if (blockquoteEntity) {
      // Wrap each line in the segment with >
      const isLast = (blockquoteEntity.offset + blockquoteEntity.length) === segEnd &&
                     b === boundaryList.length - 2;
      const lines = seg.split("\n");
      seg = lines.map((line, idx) => {
        const isLastLine = idx === lines.length - 1;
        // Add || on the very last line of the blockquote to make it expandable
        if (isLastLine && (blockquoteEntity.offset + blockquoteEntity.length) === segEnd) {
          return `>${line}||`;
        }
        return `>${line}`;
      }).join("\n");
    }

    result += seg;
  }

  return result;
}

function formatEnhanced(article, adminText, adminEntities) {
  const p1 = article.description || "No details available.";
  const p2 = cleanContent(article.content);

  // News blockquote (p1 only, collapsed)
  const newsLines = p1.split("\n");
  const newsQuote = newsLines.map((line, i) => {
    const escaped = escMD(line);
    if (i === newsLines.length - 1) return `>${escaped}||`;
    return `>${escaped}`;
  }).join("\n");

  // Admin text rebuilt with original entities preserved
  const rebuiltAdmin = rebuildWithEntities(adminText, adminEntities);

  return `${newsQuote}\n\n${rebuiltAdmin}`;
}
// =======================
// 📡 Fetch random article
// =======================
async function fetchRandomArticle(categoryKey = null) {
  let res, success = false;

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = getApiKey();
    try {
      const q = categoryKey && categoryMap[categoryKey] ? categoryMap[categoryKey] : null;
      const url = q
        ? `https://gnews.io/api/v4/search?q=${q}&lang=en&max=100&apikey=${apiKey}`
        : `https://gnews.io/api/v4/top-headlines?lang=en&country=in&max=100&apikey=${apiKey}`;
      res = await axios.get(url);
      if (res.data && res.data.articles) { success = true; break; }
    } catch {
      currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
      usageCount = 0;
    }
  }

  if (!success) return null;

  for (const item of shuffleArray(res.data.articles)) {
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
  const adminEntities = msg.entities || msg.caption_entities || [];

  if (!adminText.trim()) return;

  const lockKey = `e_${chatId}_${messageId}`;
  if (activeChats.has(lockKey)) return;
  activeChats.add(lockKey);

  try {
    console.log(`MODE2 START: chatId=${chatId} msgId=${messageId} text="${adminText}"`);

    const article = await fetchRandomArticle();
    if (!article) {
      console.log("MODE2: no article found");
      return;
    }

    const caption = formatEnhanced(article, adminText, adminEntities);

    // Preserve quoted/replied message if admin replied to something
    const replyToId = msg.reply_to_message ? msg.reply_to_message.message_id : null;

    await bot.deleteMessage(chatId, messageId).catch((e) => {
      console.log("MODE2 DELETE FAILED:", e.message);
    });

    const sendOpts = { parse_mode: "MarkdownV2" };
    if (replyToId) sendOpts.reply_to_message_id = replyToId;

    if (article.image) {
      await bot.sendPhoto(chatId, article.image, { caption, ...sendOpts });
    } else {
      await bot.sendMessage(chatId, caption, sendOpts);
    }

    console.log("MODE2: done");
  } catch (err) {
    console.log("MODE2 ERROR:", err.message);
  } finally {
    activeChats.delete(lockKey);
  }
}

// =======================
// ✅ MESSAGE HANDLER
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

  // /mode1
  if (text === "/mode1") {
    await Chat.updateOne({ chatId }, { chatId, type: "channel", mode: 1 }, { upsert: true });
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    const sent = await bot.sendMessage(chatId, "✅ Mode 1 activated — Use /n command to post news").catch(e => console.log("SEND ERR:", e.message));
    if (sent) setTimeout(() => bot.deleteMessage(chatId, sent.message_id).catch(() => {}), 3000);
    return;
  }

  // /mode2
  if (text === "/mode2") {
    await Chat.updateOne({ chatId }, { chatId, type: "channel", mode: 2 }, { upsert: true });
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    const sent = await bot.sendMessage(chatId, "✅ Mode 2 activated — Every admin post will be auto-enhanced with news image + snippet").catch(e => console.log("SEND ERR:", e.message));
    if (sent) setTimeout(() => bot.deleteMessage(chatId, sent.message_id).catch(() => {}), 3000);
    return;
  }

  // /n command
  if (text.startsWith("/n")) {
    const parts = text.split(" ");
    handleNews(msg, parts[1]);
    return;
  }

  // Auto-enhance if mode 2
  try {
    const chatDoc = await Chat.findOne({ chatId });
    const mode = chatDoc ? chatDoc.mode : 1;
    console.log(`CHANNEL POST: chatId=${chatId} mode=${mode} text="${text}"`);
    if (mode === 2) handleAutoEnhance(msg);
  } catch (err) {
    console.log("CHANNEL HANDLER ERROR:", err.message);
  }
});

// =======================
// 🔌 MODULES
// =======================
const admin = require("./admin");
admin(bot, { User, Chat, News }, {
  apiKeys,
  getApiKeyInfo: () => ({ currentKeyIndex, usageCount, maxUsage: MAX_USAGE_PER_KEY })
});

const start = require("./start");
start(bot);
