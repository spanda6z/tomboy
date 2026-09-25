import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { getMarket } from "./market.js";
import { treasuryBalance, verifySignature } from "./solana.js";
import { swapSolForTom } from "./executor.js";
import { logEvent } from "./db.js";

const menu=()=>new InlineKeyboard().text("📊 Market","market").text("💰 Treasury","treasury").row().text("⚡ Buy TOM","buy").text("📜 Verify TX","verify").row().text("ℹ️ Status","status");
const admin=(ctx:any)=>!config.adminChatId || Number(ctx.chat?.id)===config.adminChatId;
export function createBot(){
 const bot=new Bot(config.botToken);
 bot.command("start",async c=>{ if(!admin(c)) return; await c.reply("🟠 TOMBOY\n\nTOM treasury & market operations.\n\nUse the controls below to monitor TOM, inspect the treasury and execute a capped, transparent treasury swap.",{reply_markup:menu()}); });
 bot.callbackQuery("market",async c=>{await c.answerCallbackQuery(); try{const m=await getMarket(); if(!m) return c.editMessageText("No TOM market pair found."); await c.editMessageText(`📊 TOM MARKET\\nPrice: $${m.priceUsd}\\nMC: $${(m.marketCap||0).toLocaleString()}\\nLiquidity: $${(m.liquidityUsd||0).toLocaleString()}\\n24h Volume: $${(m.volume24h||0).toLocaleString()}\\n24h: ${m.priceChange24h?.toFixed(2)}%\\nDEX: ${m.dex||"-"}`,{reply_markup:menu()});}catch(e){await c.editMessageText("Market lookup failed: "+(e as Error).message,{reply_markup:menu()});}});
 bot.callbackQuery("treasury",async c=>{await c.answerCallbackQuery(); try{const b=await treasuryBalance(); await c.editMessageText(`💰 TREASURY\\n${config.treasury.toBase58()}\\n\\nSOL: ${b.toFixed(4)}\\nExecution: ${config.executionEnabled?"ON":"OFF"}\\nMax swap: ${config.maxSwapSol} SOL`,{reply_markup:menu()});}catch(e){await c.editMessageText("Treasury lookup failed: "+(e as Error).message,{reply_markup:menu()});}});
 bot.callbackQuery("status",async c=>{await c.answerCallbackQuery(); await c.editMessageText(`🟠 TOMBOY STATUS\\nMint: ${config.tomMint.toBase58()}\\nNetwork: Solana mainnet-beta\\nExecution: ${config.executionEnabled?"ENABLED":"DISABLED"}\\nTreasury: ${config.treasury.toBase58()}`,{reply_markup:menu()});});
 bot.callbackQuery("buy",async c=>{await c.answerCallbackQuery(); await c.editMessageText(`⚡ BUY TOM\\n\\nThis executes from the configured treasury only.\\nMaximum: ${config.maxSwapSol} SOL\\nExecution: ${config.executionEnabled?"ENABLED":"DISABLED"}\\n\\nSend /buy <SOL> to execute.`,{reply_markup:menu()});});
 bot.command("buy",async c=>{if(!admin(c))return; const amount=Number(c.match?.trim()); if(!amount) return c.reply("Usage: /buy 0.05"); try{const sig=await swapSolForTom(amount); await logEvent("buy_submitted",{amount,sig}); await c.reply(`✅ TOM buy submitted\\nAmount: ${amount} SOL\\nTX: ${sig}`);}catch(e){await c.reply("❌ "+(e as Error).message);}});
 bot.callbackQuery("verify",async c=>{await c.answerCallbackQuery(); await c.editMessageText("Use /verify <signature> to verify a Solana transaction on-chain.",{reply_markup:menu()});});
 bot.command("verify",async c=>{if(!admin(c))return; const sig=c.match?.trim(); if(!sig)return c.reply("Usage: /verify <signature>"); try{const ok=await verifySignature(sig); await c.reply(ok?"✅ Transaction found on-chain.":"⚠️ Transaction not found.");}catch(e){await c.reply("❌ Verification failed: "+(e as Error).message);}});
 bot.catch(err=>console.error("Telegram error",err.error));
 return bot;
}