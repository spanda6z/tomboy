import http from "node:http";
import { createBot } from "./bot.js";
import { config } from "./config.js";
import { initDb } from "./db.js";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "tomboy" }));
});

server.listen(config.port, () => console.log(`TOMBOY health server on :${config.port}`));

await initDb();
const bot = createBot();
await bot.start();