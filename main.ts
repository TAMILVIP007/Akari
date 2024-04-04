import { Bot } from "grammy/mod.ts";

import Config from "./src/config.ts";
import composer from "./src/bot.ts";
import PmManagerDB from "./src/db.ts";
// we set up a test instance for the bot, using the BOT_TOKEN provided in the .env file.


const bot = new Bot(new Config().token);
const db = new PmManagerDB();
await db.checkDatabaseConnection();
await bot.init();
console.info(`Database connection established`);
console.info(`Started as @${bot.botInfo.username}`);


bot.use(composer);
bot.catch((err) => console.log(err));
bot.start({
  drop_pending_updates: true,
  allowed_updates: ["message", "business_connection", "business_message"],
});

Deno.addSignalListener("SIGINT", () => bot.stop());
Deno.addSignalListener("SIGTERM", () => bot.stop());