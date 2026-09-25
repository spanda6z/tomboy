import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { getMarket } from "./market.js";
import { treasuryBalance, verifySignature } from "./solana.js";
import { swapSolForTom } from "./executor.js";
import { createJob, getJob, listJobs, logEvent } from "./db.js";

const menu = () => new InlineKeyboard()
  .text("📊 Market","market").text("💰 Treasury","treasury").row()
  .text("📦 Packages","packages").text("📋 Jobs","jobs").row()
  .text("⚡ Buy TOM","buy").text("📜 Verify TX","verify").row()
  .text("ℹ️ Status","status");

const admin = (ctx: any) => !config.adminChatId || Number(ctx.chat?.id) === config.adminChatId;
const packages = [
  { id:"starter", name:"STARTER", budget:1, duration:"1h", wallets:5, label:"🟢" },
  { id:"growth", name:"GROWTH", budget:2, duration:"3h", wallets:15, label:"🔵" },
  { id:"pro", name:"PRO", budget:5, duration:"6h", wallets:30, label:"🟣" },
];

export function createBot() {
  const bot = new Bot(config.botToken);

  bot.command("start", async c => {
    if (!admin(c)) return;
    await c.reply("🐈‍⬛ TOMBOY\n\n$TOM operations terminal.\n\nMarket · Treasury · Packages · Jobs", { reply_markup: menu() });
  });

  bot.callbackQuery("market", async c => {
    await c.answerCallbackQuery();
    try {
      const m = await getMarket();
      if (!m) return c.editMessageText("No TOM market pair found.", { reply_markup: menu() });
      await c.editMessageText(
        \`📊 TOM MARKET\n\nPrice: $\${m.priceUsd}\nMC: $\${(m.marketCap||0).toLocaleString()}\nLiquidity: $\${(m.liquidityUsd||0).toLocaleString()}\n24h Volume: $\${(m.volume24h||0).toLocaleString()}\n24h: \${m.priceChange24h?.toFixed(2)}%\nDEX: \${m.dex||"-"}\`,
        { reply_markup: menu() }
      );
    } catch (e) {
      await c.editMessageText("Market lookup failed: " + (e as Error).message, { reply_markup: menu() });
    }
  });

  bot.callbackQuery("treasury", async c => {
    await c.answerCallbackQuery();
    try {
      const b = await treasuryBalance();
      await c.editMessageText(\`💰 TREASURY\n\n\${config.treasury.toBase58()}\n\nSOL: \${b.toFixed(4)}\nExecution: \${config.executionEnabled?"ON":"OFF"}\nMax swap: \${config.maxSwapSol} SOL\`, { reply_markup: menu() });
    } catch (e) {
      await c.editMessageText("Treasury lookup failed: " + (e as Error).message, { reply_markup: menu() });
    }
  });

  bot.callbackQuery("packages", async c => {
    await c.answerCallbackQuery();
    const text = packages.map(p => \`📦 \${p.name}\nBudget: \${p.budget} SOL\nWindow: \${p.duration}\`).join("\n\n");
    await c.editMessageText("CHOOSE OPERATION\n\n" + text + "\n\nDeposits fund disclosed treasury operations. No package guarantees volume, holders, price, or market-cap outcomes.", {
      reply_markup: new InlineKeyboard().text("STARTER","pkg:starter").text("GROWTH","pkg:growth").row().text("PRO","pkg:pro").text("↩ Menu","menu")
    });
  });

  for (const p of packages) {
    bot.callbackQuery(\`pkg:\${p.id}\`, async c => {
      await c.answerCallbackQuery();
      const job = await createJob({ chatId:Number(c.chat?.id||0), packageId:p.id, budgetSol:p.budget });
      await c.editMessageText(\`📦 \${p.name} SELECTED\n\nJob: #\${job.id}\nBudget: \${p.budget} SOL\nWindow: \${p.duration}\n\nDeposit \${p.budget} SOL to:\n\${config.treasury.toBase58()}\n\nThen send:\n/verify <transaction-signature>\n\nJob remains PENDING until the deposit is verified.\`, { reply_markup: menu() });
    });
  }

  bot.callbackQuery("jobs", async c => {
    await c.answerCallbackQuery();
    const jobs = await listJobs(Number(c.chat?.id||0));
    if (!jobs.length) return c.editMessageText("No jobs yet.", { reply_markup: menu() });
    await c.editMessageText(jobs.slice(0,10).map(j => \`#\${j.id} · \${j.package_id.toUpperCase()} · \${j.status}\nBudget: \${j.budget_sol} SOL\`).join("\n\n"), { reply_markup: menu() });
  });

  bot.callbackQuery("status", async c => {
    await c.answerCallbackQuery();
    await c.editMessageText(\`🟠 TOMBOY STATUS\n\nMint: \${config.tomMint.toBase58()}\nNetwork: Solana mainnet-beta\nExecution: \${config.executionEnabled?"ENABLED":"DISABLED"}\nTreasury: \${config.treasury.toBase58()}\`, { reply_markup: menu() });
  });

  bot.callbackQuery("buy", async c => {
    await c.answerCallbackQuery();
    await c.editMessageText(\`⚡ BUY TOM\n\nTreasury execution only.\nMaximum: \${config.maxSwapSol} SOL\nExecution: \${config.executionEnabled?"ENABLED":"DISABLED"}\n\nSend /buy <SOL> to execute.\`, { reply_markup: menu() });
  });

  bot.command("buy", async c => {
    if (!admin(c)) return;
    const amount = Number(c.match?.trim());
    if (!amount) return c.reply("Usage: /buy 0.05");
    try {
      const sig = await swapSolForTom(amount);
      await logEvent("buy_submitted", { amount, sig });
      await c.reply(\`✅ TOM buy submitted\nAmount: \${amount} SOL\nTX: \${sig}\`);
    } catch (e) {
      await c.reply("❌ " + (e as Error).message);
    }
  });

  bot.callbackQuery("verify", async c => {
    await c.answerCallbackQuery();
    await c.editMessageText("Use /verify <signature> to verify a Solana deposit or transaction on-chain.", { reply_markup: menu() });
  });

  bot.command("verify", async c => {
    if (!admin(c)) return;
    const sig = c.match?.trim();
    if (!sig) return c.reply("Usage: /verify <signature>");
    try {
      const ok = await verifySignature(sig);
      await c.reply(ok ? "✅ Transaction found on-chain." : "⚠️ Transaction not found.");
    } catch (e) {
      await c.reply("❌ Verification failed: " + (e as Error).message);
    }
  });

  bot.command("job", async c => {
    if (!admin(c)) return;
    const id = Number(c.match?.trim());
    if (!id) return c.reply("Usage: /job <id>");
    const job = await getJob(id);
    await c.reply(job ? JSON.stringify(job, null, 2) : "Job not found.");
  });

  bot.catch(err => console.error("Telegram error", err.error));
  return bot;
}
