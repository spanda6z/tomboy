import { config } from "./config.js";
export type Market = { priceUsd: number; marketCap?: number; liquidityUsd?: number; volume24h?: number; priceChange24h?: number; dex?: string; pair?: string; url?: string };
export async function getMarket(): Promise<Market | null> {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${config.tomMint.toBase58()}`);
  if (!r.ok) throw new Error(`Dexscreener HTTP ${r.status}`);
  const data = await r.json() as any;
  const pairs = Array.isArray(data.pairs) ? data.pairs : [];
  if (!pairs.length) return null;
  pairs.sort((a:any,b:any)=>(Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0)));
  const p=pairs[0];
  return { priceUsd:Number(p.priceUsd||0), marketCap:Number(p.marketCap||p.fdv||0)||undefined, liquidityUsd:Number(p.liquidity?.usd||0)||undefined, volume24h:Number(p.volume?.h24||0)||undefined, priceChange24h:Number(p.priceChange?.h24||0)||undefined, dex:p.dexId, pair:p.pairAddress, url:p.url };
}