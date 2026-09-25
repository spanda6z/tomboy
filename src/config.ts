import "dotenv/config";
import { PublicKey } from "@solana/web3.js";

const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

export const config = {
  botToken: required("BOT_TOKEN"),
  databaseUrl: required("DATABASE_URL"),
  rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  tomMint: new PublicKey(process.env.TOM_MINT || "8GPzPsLp4ZFveMKjVrPA7giEBEcAY5Yo2X3QysvJQgTE"),
  treasury: new PublicKey(process.env.TREASURY_ADDRESS || "DmqV7Utif7TEruBkd4AuLrzp2Zw2VpoaPP1tgjjoxcqf"),
  treasuryPrivateKey: process.env.TREASURY_PRIVATE_KEY || "",
  executionEnabled: process.env.EXECUTION_ENABLED === "true",
  maxSwapSol: Number(process.env.MAX_SWAP_SOL || "0.25"),
  port: Number(process.env.PORT || "8080"),
  adminChatId: process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : null,
};