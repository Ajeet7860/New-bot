import 'dotenv/config';

import { createBot } from './bot.js';
import { loadConfig } from './config.js';
import { SettingsStore } from './settings-store.js';

async function main() {
  const config = loadConfig();
  const store = new SettingsStore(config.dataFile);
  await store.load();

  const { client, player } = await createBot(config, store);

  const shutdown = (signal) => {
    console.info(`Received ${signal}; shutting down.`);
    player.destroy();
    client.destroy();
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  await client.login(config.token);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
