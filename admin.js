module.exports = function (bot, models, config) {
  const { User, Chat, News } = models;
  const { apiKeys, getApiKeyInfo } = config;

  // =======================
  // 📊 ADMIN DASHBOARD
  // =======================
  bot.onText(/^\/admin$/, async (msg) => {
    const chatId = msg.chat.id;

    if (msg.from.id !== Number(process.env.ADMIN_ID)) {
      return bot.sendMessage(chatId, "❌ Not authorized");
    }

    try {
      const totalUsers = await User.countDocuments();
      const totalChats = await Chat.countDocuments();

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayNews = await News.countDocuments({
        createdAt: { $gte: startOfDay }
      });

      const text = `📊 *Admin Dashboard*

👤 Users: ${totalUsers}
💬 Chats: ${totalChats}
📰 Today News: ${todayNews}`;

      bot.sendMessage(chatId, text, { parse_mode: "Markdown" });

    } catch (err) {
      console.log("ADMIN ERROR:", err.message);
    }
  });

  // =======================
  // 📡 BROADCAST
  // =======================
  bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (msg.from.id !== Number(process.env.ADMIN_ID)) {
      return bot.sendMessage(chatId, "❌ Not authorized");
    }

    const message = match[1];

    try {
      const users = await User.find({});
      const chats = await Chat.find({});

      let success = 0;
      let failed = 0;

      // 👤 Users
      for (const user of users) {
        try {
          await bot.sendMessage(user.userId, message);
          success++;
        } catch {
          failed++;
        }
      }

      // 💬 Chats
      for (const chat of chats) {
        try {
          await bot.sendMessage(chat.chatId, message);
          success++;
        } catch {
          failed++;
        }
      }

      bot.sendMessage(chatId, `📡 *Broadcast Done*

✔ Sent: ${success}
❌ Failed: ${failed}`, { parse_mode: "Markdown" });

    } catch (err) {
      console.log("BROADCAST ERROR:", err.message);
      bot.sendMessage(chatId, "❌ Broadcast failed");
    }
  });

  // =======================
  // 🔑 API KEYS STATUS
  // =======================
  bot.onText(/^\/apikeys$/, async (msg) => {
    const chatId = msg.chat.id;

    if (msg.from.id !== Number(process.env.ADMIN_ID)) {
      return bot.sendMessage(chatId, "❌ Not authorized");
    }

    try {
      const { currentKeyIndex, usageCount, maxUsage } = getApiKeyInfo();

      let text = `🔑 *API Keys Status*

Total Keys: ${apiKeys.length}

`;

      apiKeys.forEach((key, index) => {
        const masked = key.slice(0, 6) + "****";
        const isActive = index === currentKeyIndex;

        text += `Key ${index + 1}: ${masked} ${isActive ? "🟢 ACTIVE" : ""}\n`;
      });

      text += `\n📊 Current Usage: ${usageCount}/${maxUsage}`;

      bot.sendMessage(chatId, text, { parse_mode: "Markdown" });

    } catch (err) {
      console.log("APIKEY ERROR:", err.message);
      bot.sendMessage(chatId, "❌ Failed to fetch API key info");
    }
  });

};
