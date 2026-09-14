import path from 'node:path';

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

function parseVolume(value) {
  const volume = Number(value ?? 80);
  if (!Number.isInteger(volume) || volume < 1 || volume > 100) {
    throw new Error('DEFAULT_VOLUME must be an integer from 1 to 100.');
  }
  return volume;
}

export function loadConfig(env = process.env, cwd = process.cwd()) {
  const token = env.DISCORD_TOKEN?.trim();
  if (!token) {
    throw new Error('DISCORD_TOKEN is required. Copy .env.example to .env and add your bot token.');
  }

  const devGuildId = env.DEV_GUILD_ID?.trim() || null;
  if (devGuildId && !SNOWFLAKE_PATTERN.test(devGuildId)) {
    throw new Error('DEV_GUILD_ID must be a valid Discord server ID.');
  }

  return {
    token,
    devGuildId,
    defaultVolume: parseVolume(env.DEFAULT_VOLUME),
    dataFile: path.resolve(cwd, env.DATA_FILE?.trim() || 'data/guilds.json'),
  };
}
