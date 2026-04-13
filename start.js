module.exports = function (bot) {

  // =======================
  // 🚀 START
  // =======================
  bot.onText(/^\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || "User";

    const text = `👋 *Welcome ${name}*

📰 Get latest news instantly

Any doubdts ? check below options 👇`;

    bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📖 Help", callback_data: "help" },
            { text: "📢 Channel", url: "https://t.me/km_botzs" }
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

    // 📖 HELP SCREEN (EDIT MESSAGE)
    if (query.data === "help") {

      const helpText = `📖 *How to use*

JUST ADD BOT AS ADMIN IN CHANNEL WITH FULL PERMISSIONS

THEN GIVE ONE COMMAND👇

/n → General  
/n t → Tech  
/n s → Sports  
/n b → Business  
/n h → Health  
/n e → Entertainment  

⚡ Send command → get news instantly`;

      bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back", callback_data: "back" }
            ]
          ]
        }
      });

      bot.answerCallbackQuery(query.id);
    }

    // ⬅️ BACK TO MAIN
    if (query.data === "back") {

      const name = query.from.first_name || "User";

      const mainText = `👋 *Welcome ${name}*

📰 Get latest news instantly

Any doubdts ? check below options 👇`;

      bot.editMessageText(mainText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📖 Help", callback_data: "help" },
              { text: "📢 Channel", url: "https://t.me/km_botzs" }
            ]
          ]
        }
      });

      bot.answerCallbackQuery(query.id);
    }
  });

};
