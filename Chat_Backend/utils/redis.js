import { createClient } from "redis";

const client = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000, // 10s
  }
});

client.on("error", (err) => console.error("Redis Client Error", err));

async function initRedis() {
  if (!client.isOpen) {
    await client.connect();
  }
}

export { client, initRedis };
