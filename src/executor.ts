import { VersionedTransaction } from "@solana/web3.js";
import { config } from "./config.js";
import { signer } from "./solana.js";
import { logExecution } from "./db.js";
export async function swapSolForTom(solAmount:number) {
  if (!config.executionEnabled) throw new Error("Execution is disabled. Set EXECUTION_ENABLED=true only after review.");
  if (solAmount <= 0 || solAmount > config.maxSwapSol) throw new Error(`Amount exceeds configured limit of ${config.maxSwapSol} SOL`);
  const kp=signer();
  if (kp.publicKey.toBase58() !== config.treasury.toBase58()) throw new Error("Treasury private key does not match TREASURY_ADDRESS");
  const lamports=Math.floor(solAmount*1e9);
  const quoteUrl=new URL("https://quote-api.jup.ag/v6/quote");
  quoteUrl.searchParams.set("inputMint","So11111111111111111111111111111111111111112");
  quoteUrl.searchParams.set("outputMint",config.tomMint.toBase58());
  quoteUrl.searchParams.set("amount",String(lamports));
  quoteUrl.searchParams.set("slippageBps","200");
  const q=await (await fetch(quoteUrl)).json() as any;
  if (!q?.outAmount) throw new Error("No Jupiter route available");
  const sr=await fetch("https://quote-api.jup.ag/v6/swap",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({quoteResponse:q,userPublicKey:kp.publicKey.toBase58(),wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true})});
  if(!sr.ok) throw new Error(`Jupiter swap HTTP ${sr.status}: ${await sr.text()}`);
  const body=await sr.json() as any;
  const tx=VersionedTransaction.deserialize(Buffer.from(body.swapTransaction,"base64"));
  tx.sign([kp]);
  const sig=await (await import("./solana.js")).connection.sendRawTransaction(tx.serialize(),{maxRetries:3});
  await logExecution("BUY",solAmount,"submitted",sig);
  return sig;
}