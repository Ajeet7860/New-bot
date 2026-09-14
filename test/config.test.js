import assert from 'node:assert/strict';
import test from 'node:test';

import { loadConfig } from '../src/config.js';

test('loadConfig applies safe defaults', () => {
  const config = loadConfig({ DISCORD_TOKEN: 'test-token' }, '/tmp/music-bot');
  assert.equal(config.token, 'test-token');
  assert.equal(config.defaultVolume, 80);
  assert.equal(config.devGuildId, null);
  assert.equal(config.dataFile, '/tmp/music-bot/data/guilds.json');
});

test('loadConfig validates volume and development guild ID', () => {
  assert.throws(
    () => loadConfig({ DISCORD_TOKEN: 'token', DEFAULT_VOLUME: '101' }),
    /DEFAULT_VOLUME/,
  );
  assert.throws(
    () => loadConfig({ DISCORD_TOKEN: 'token', DEV_GUILD_ID: 'not-an-id' }),
    /DEV_GUILD_ID/,
  );
});

test('loadConfig requires a token', () => {
  assert.throws(() => loadConfig({}), /DISCORD_TOKEN/);
});
