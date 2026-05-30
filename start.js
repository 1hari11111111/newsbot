module.exports = function (bot, models) {
  const { Chat } = models;

  // =======================
  // 🚀 START
  // =======================
  bot.onText(/^\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || "User";

    const text = `👋 *Welcome ${name}*\n\n📰 Get latest news instantly\n\nAny doubdts ? check below options 👇`;

    bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📖 Help", callback_data: "help" },
            { text: "📢 Channel", url: "https://t.me/km_botzs" }
          ],
          [
            { text: "🔄 Switch Channel Mode", callback_data: "mode_info" }
          ]
        ]
      }
    });
  });

  // =======================
  // 🔘 BUTTON HANDLER
  // =======================
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    // 📖 HELP SCREEN
    if (data === "help") {
      const helpText = `📖 *How to use*\n\nJUST ADD BOT AS ADMIN IN CHANNEL WITH FULL PERMISSIONS\n\nTHEN GIVE ONE COMMAND👇\n\n/n → General  \n/n t → Tech  \n/n s → Sports  \n/n b → Business  \n/n h → Health  \n/n e → Entertainment  \n\n⚡ Send command → get news instantly`;

      bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "⬅️ Back", callback_data: "back" }]]
        }
      });
      bot.answerCallbackQuery(query.id);
    }

    // 🔄 MODE INFO SCREEN
    if (data === "mode_info") {
      const modeText = `🔄 *Channel Mode Switcher*\n\n*Mode 1 — Command Mode* (default)\nAdmin types /n in channel → bot posts a fresh news article\n\n*Mode 2 — Auto Enhance Mode*\nAdmin posts any message in channel → bot automatically adds a random news image + short snippet on top of that message\n\n👇 Use the command below *inside your channel* to switch mode:\n\n/mode1 → Switch to Command Mode\n/mode2 → Switch to Auto Enhance Mode`;

      bot.editMessageText(modeText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "⬅️ Back", callback_data: "back" }]]
        }
      });
      bot.answerCallbackQuery(query.id);
    }

    // ⬅️ BACK TO MAIN
    if (data === "back") {
      const name = query.from.first_name || "User";
      const mainText = `👋 *Welcome ${name}*\n\n📰 Get latest news instantly\n\nAny doubdts ? check below options 👇`;

      bot.editMessageText(mainText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📖 Help", callback_data: "help" },
              { text: "📢 Channel", url: "https://t.me/km_botzs" }
            ],
            [
              { text: "🔄 Switch Channel Mode", callback_data: "mode_info" }
            ]
          ]
        }
      });
      bot.answerCallbackQuery(query.id);
    }
  });
};
