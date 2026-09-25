import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { getMarket } from "./market.js";
import { treasuryBalance, verifySignature } from "./solana.js";
import { swapSolForTom } from "./executor.js";
import { createJob, getJob, listJobs, logEvent } from "./db.js";

const menu = () => new InlineKeyboard()
  .text("📊 Market", "market").text("💰 Treasury", "treasury").row()
  .text("📦 Packages", "packages").text("📋 Jobs", "jobs").row()
  .text("⚡ Buy TOM", "buy").text("📜 Verify TX", "verify").row()
  .text("ℹ️ Status", "status");

const admin = (ctx: any) => !config.adminChatId || Number(ctx.chat?.id) === config.adminChatId;

const packages = [
  { id: "starter", name: "STARTER", budget: 1, duration: "1H", wallets: 5, icon: "🟢" },
  { id: "growth", name: "GROWTH", budget: 2, duration: "3H", wallets: 15, icon: "🔵" },
  { id: "pro", name: "PRO", budget: 5, duration: "6H", wallets: 30, icon: "🟣" },
];

export function createBot() {
  const bot = new Bot(config.botToken);

  bot.command("start", async c => {
    if (!admin(c)) return;
    await c.reply(
      "🐈‍⬛ TOMBOY\n\n$TOM operations terminal.\n\nMarket · Treasury · Packages · Jobs",
      { reply_markup: menu() }
    );
  });

  bot.callbackQuery("menu", async c => {
    await c.answerCallbackQuery();
    await c.editMessageText(
      "🐈‍⬛ TOMBOY\n\n$TOM operations terminal.\n\nMarket · Treasury · Packages · Jobs",
      { reply_markup: menu() }
    );
  });

  bot.callbackQuery("market", async c => {
    await c.answerCallbackQuery();
    try {
      const m = await getMarket();
      if (!m) return c.editMessageText("No TOM market pair found.", { reply_markup: menu() });
      await c.editMessageText(
        `📊 TOM MARKET

Price: $${m.priceUsd}
MC: $${(m.marketCap || 0).toLocaleString()}
Liquidity: $${(m.liquidityUsd || 0).toLocaleString()}
24h Volume: $${(m.volume24h || 0).toLocaleString()}
24h: ${m.priceChange24h?.toFixed(2)}%
DEX: ${m.dex || "-"}`,
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
      await c.editMessageText(
        `💰 TREASURY

${config.treasury.toBase58()}

SOL: ${b.toFixed(4)}
Execution: ${config.executionEnabled ? "ON" : "OFF"}
Max swap: ${config.maxSwapSol} SOL`,
        { reply_markup: menu() }
      );
    } catch (e) {
      await c.editMessageText("Treasury lookup failed: " + (e as Error).message, { reply_markup: menu() });
    }
  });

  bot.callbackQuery("packages", async c => {
    await c.answerCallbackQuery();

    const text = packages.map(p =>
      `${p.icon} ${p.name} — ${p.budget} SOL
👛 ${p.wallets} operating wallets · ⏱ ${p.duration}`
    ).join("\n\n");

    await c.editMessageText(
      "📦 TOMBOY PACKAGES\n\n" +
      text +
      "\n\nChoose your package.\n" +
      "Deposits fund disclosed treasury/liquidity operations. No package guarantees volume, holders, price, or market-cap outcomes.",
      {
        reply_markup: new InlineKeyboard()
          .text("🟢 STARTER · 1 SOL", "pkg:starter")
          .row()
          .text("🔵 GROWTH · 2 SOL", "pkg:growth")
          .row()
          .text("🟣 PRO · 5 SOL", "pkg:pro")
          .row()
          .text("⚙️ GO CUSTOM", "custom")
          .row()
          .text("↩ Menu", "menu")
      }
    );
  });

  for (const p of packages) {
    bot.callbackQuery(`pkg:${p.id}`, async c => {
      await c.answerCallbackQuery();

      const job = await createJob({
        chatId: Number(c.chat?.id || 0),
        packageId: p.id,
        budgetSol: p.budget
      });

      await c.editMessageText(
        `📦 ${p.name} SELECTED

Job: #${job.id}
Budget: ${p.budget} SOL
Wallets: ${p.wallets}
Window: ${p.duration}

Deposit ${p.budget} SOL to:
${config.treasury.toBase58()}

Then send:
/verify <transaction-signature>

Job remains PENDING until the deposit is verified.`,
        { reply_markup: menu() }
      );
    });
  }

  bot.callbackQuery("custom", async c => {
    await c.answerCallbackQuery();
    await c.editMessageText(
      "⚙️ GO CUSTOM\n\nChoose your operating budget:\n\n" +
      "💰 1 SOL\n💰 2 SOL\n💰 3 SOL\n💰 5 SOL\n\n" +
      "Or use /custom <SOL> for another amount.",
      {
        reply_markup: new InlineKeyboard()
          .text("1 SOL", "custom:1").text("2 SOL", "custom:2").row()
          .text("3 SOL", "custom:3").text("5 SOL", "custom:5").row()
          .text("↩ Packages", "packages")
      }
    );
  });

  for (const amount of [1, 2, 3, 5]) {
    bot.callbackQuery(`custom:${amount}`, async c => {
      await c.answerCallbackQuery();
      const job = await createJob({
        chatId: Number(c.chat?.id || 0),
        packageId: `custom-${amount}`,
        budgetSol: amount
      });

      await c.editMessageText(
        `⚙️ CUSTOM OPERATION

Job: #${job.id}
Budget: ${amount} SOL

Deposit ${amount} SOL to:
${config.treasury.toBase58()}

Then send:
/verify <transaction-signature>

Job remains PENDING until the deposit is verified.`,
        { reply_markup: menu() }
      );
    });
  }

  bot.command("custom", async c => {
    if (!admin(c)) return;
    const amount = Number(c.match?.trim());

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100) {
      return c.reply("Usage: /custom <SOL>\nExample: /custom 3");
    }

    const job = await createJob({
      chatId: Number(c.chat?.id || 0),
      packageId: `custom-${amount}`,
      budgetSol: amount
    });

    await c.reply(
      `⚙️ CUSTOM OPERATION

Job: #${job.id}
Budget: ${amount} SOL

Deposit ${amount} SOL to:
${config.treasury.toBase58()}

Then send:
/verify <transaction-signature>`,
      { reply_markup: menu() }
    );
  });

  bot.callbackQuery("jobs", async c => {
    await c.answerCallbackQuery();
    const jobs = await listJobs(Number(c.chat?.id || 0));

    if (!jobs.length) {
      return c.editMessageText("No jobs yet.", { reply_markup: menu() });
    }

    await c.editMessageText(
      jobs.slice(0, 10).map(j =>
        `#${j.id} · ${j.package_id.toUpperCase()} · ${j.status}
Budget: ${j.budget_sol} SOL`
      ).join("\n\n"),
      { reply_markup: menu() }
    );
  });

  bot.callbackQuery("status", async c => {
    await c.answerCallbackQuery();
    await c.editMessageText(
      `🟠 TOMBOY STATUS

Mint: ${config.tomMint.toBase58()}
Network: Solana mainnet-beta
Execution: ${config.executionEnabled ? "ENABLED" : "DISABLED"}
Treasury: ${config.treasury.toBase58()}`,
      { reply_markup: menu() }
    );
  });

  bot.callbackQuery("buy", async c => {
    await c.answerCallbackQuery();
    await c.editMessageText(
      `⚡ BUY TOM

Treasury execution only.
Maximum: ${config.maxSwapSol} SOL
Execution: ${config.executionEnabled ? "ENABLED" : "DISABLED"}

Send /buy <SOL> to execute.`,
      { reply_markup: menu() }
    );
  });

  bot.command("buy", async c => {
    if (!admin(c)) return;
    const amount = Number(c.match?.trim());

    if (!amount) return c.reply("Usage: /buy 0.05");

    try {
      const sig = await swapSolForTom(amount);
      await logEvent("buy_submitted", { amount, sig });
      await c.reply(`✅ TOM buy submitted\nAmount: ${amount} SOL\nTX: ${sig}`);
    } catch (e) {
      await c.reply("❌ " + (e as Error).message);
    }
  });

  bot.callbackQuery("verify", async c => {
    await c.answerCallbackQuery();
    await c.editMessageText(
      "Use /verify <signature> to verify a Solana deposit or transaction on-chain.",
      { reply_markup: menu() }
    );
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
