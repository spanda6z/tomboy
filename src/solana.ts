import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "./config.js";
export const connection = new Connection(config.rpcUrl, "confirmed");
export async function treasuryBalance() { return (await connection.getBalance(config.treasury))/LAMPORTS_PER_SOL; }
export function signer() { if (!config.treasuryPrivateKey) throw new Error("TREASURY_PRIVATE_KEY is not configured"); return Keypair.fromSecretKey(bs58.decode(config.treasuryPrivateKey)); }
export async function verifySignature(signature:string) { const tx=await connection.getParsedTransaction(signature,{maxSupportedTransactionVersion:0}); return !!tx; }