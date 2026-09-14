import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SETTINGS = Object.freeze({
  autoplay: true,
  stayConnected: false,
  voiceChannelId: null,
  textChannelId: null,
});

function normalizeSettings(value = {}) {
  return {
    autoplay: value.autoplay !== false,
    stayConnected: value.stayConnected === true,
    voiceChannelId: typeof value.voiceChannelId === 'string' ? value.voiceChannelId : null,
    textChannelId: typeof value.textChannelId === 'string' ? value.textChannelId : null,
  };
}

export class SettingsStore {
  #filePath;
  #settings = new Map();
  #writeChain = Promise.resolve();

  constructor(filePath) {
    this.#filePath = filePath;
  }

  async load() {
    try {
      const raw = await readFile(this.#filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('settings root must be an object');
      }

      this.#settings = new Map(
        Object.entries(parsed).map(([guildId, settings]) => [guildId, normalizeSettings(settings)]),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Could not load settings from ${this.#filePath}: ${error.message}`, {
          cause: error,
        });
      }
    }
  }

  get(guildId) {
    return { ...DEFAULT_SETTINGS, ...this.#settings.get(guildId) };
  }

  entries() {
    return [...this.#settings.entries()].map(([guildId, settings]) => [guildId, { ...settings }]);
  }

  async update(guildId, patch) {
    const next = normalizeSettings({ ...this.get(guildId), ...patch });
    this.#settings.set(guildId, next);
    await this.#save();
    return { ...next };
  }

  #save() {
    const contents = `${JSON.stringify(Object.fromEntries(this.#settings), null, 2)}\n`;
    const directory = path.dirname(this.#filePath);
    const temporary = `${this.#filePath}.${process.pid}.tmp`;

    this.#writeChain = this.#writeChain.then(async () => {
      await mkdir(directory, { recursive: true });
      await writeFile(temporary, contents, { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, this.#filePath);
    });

    return this.#writeChain;
  }
}

export { DEFAULT_SETTINGS };
