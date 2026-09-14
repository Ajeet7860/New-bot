import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { SettingsStore } from '../src/settings-store.js';

test('settings default to autoplay enabled', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'new-bot-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = new SettingsStore(path.join(directory, 'guilds.json'));

  await store.load();

  assert.deepEqual(store.get('guild-1'), {
    autoplay: true,
    stayConnected: false,
    voiceChannelId: null,
    textChannelId: null,
  });
});

test('settings updates persist and reload', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'new-bot-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'nested', 'guilds.json');
  const store = new SettingsStore(file);
  await store.load();

  await store.update('guild-1', {
    stayConnected: true,
    voiceChannelId: 'voice-1',
    textChannelId: 'text-1',
  });

  const reloaded = new SettingsStore(file);
  await reloaded.load();
  assert.deepEqual(reloaded.get('guild-1'), {
    autoplay: true,
    stayConnected: true,
    voiceChannelId: 'voice-1',
    textChannelId: 'text-1',
  });
  assert.match(await readFile(file, 'utf8'), /"stayConnected": true/);
});
