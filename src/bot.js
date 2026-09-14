import {
  ActivityType,
  Client,
  Events,
  escapeMarkdown,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import {
  AppleMusicExtractor,
  ReverbnationExtractor,
  SoundCloudExtractor,
  SpotifyExtractor,
  VimeoExtractor,
} from '@discord-player/extractor';
import { Player, QueueRepeatMode } from 'discord-player';

import { commands } from './commands.js';

const QUEUE_OPTIONS = {
  bufferingTimeout: 30_000,
  connectionTimeout: 30_000,
  pauseOnEmpty: false,
  selfDeaf: true,
};

function trackLabel(track) {
  const title = escapeMarkdown(track.cleanTitle || track.title || 'Unknown track');
  return track.url ? `[${title}](${track.url})` : title;
}

function getQueue(player, guildId) {
  return player.nodes.get(guildId);
}

function requireVoiceChannel(interaction) {
  const channel = interaction.member?.voice?.channel;
  if (!channel) {
    throw new Error('Join a voice channel first.');
  }
  return channel;
}

function requireSameVoiceChannel(interaction) {
  const channel = requireVoiceChannel(interaction);
  const botChannelId = interaction.guild.members.me?.voice.channelId;
  if (botChannelId && channel.id !== botChannelId) {
    throw new Error('Join my voice channel to control playback.');
  }
  return channel;
}

function requireQueue(player, interaction, { playing = false } = {}) {
  requireSameVoiceChannel(interaction);
  const queue = getQueue(player, interaction.guildId);
  if (!queue || (playing && !queue.currentTrack)) {
    throw new Error(playing ? 'Nothing is playing right now.' : 'There is no active queue.');
  }
  return queue;
}

function canJoin(channel, botMember) {
  if (!botMember) return false;
  const permissions = channel.permissionsFor(botMember);
  return permissions?.has(PermissionFlagsBits.Connect) && permissions.has(PermissionFlagsBits.Speak);
}

function queueOptions(settings, textChannelId, defaultVolume) {
  return {
    ...QUEUE_OPTIONS,
    leaveOnEmpty: !settings.stayConnected,
    leaveOnEnd: !settings.stayConnected,
    leaveOnStop: !settings.stayConnected,
    metadata: { textChannelId },
    repeatMode: settings.autoplay ? QueueRepeatMode.AUTOPLAY : QueueRepeatMode.OFF,
    volume: defaultVolume,
  };
}

function createOrUpdateQueue(player, guild, settings, textChannelId, defaultVolume) {
  const existing = getQueue(player, guild.id);
  if (existing) {
    existing.metadata = { textChannelId };
    existing.options.leaveOnEmpty = !settings.stayConnected;
    existing.options.leaveOnEnd = !settings.stayConnected;
    existing.options.leaveOnStop = !settings.stayConnected;
    existing.setRepeatMode(settings.autoplay ? QueueRepeatMode.AUTOPLAY : QueueRepeatMode.OFF);
    return existing;
  }

  return player.nodes.create(guild, queueOptions(settings, textChannelId, defaultVolume));
}

async function sendToQueueChannel(client, queue, message) {
  const channelId = queue.metadata?.textChannelId;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel?.isSendable()) {
    await channel.send(message).catch(() => null);
  }
}

async function restorePersistentConnections(client, player, store, defaultVolume) {
  for (const [guildId, settings] of store.entries()) {
    if (!settings.stayConnected || !settings.voiceChannelId) continue;

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    const channel = guild
      ? await guild.channels.fetch(settings.voiceChannelId).catch(() => null)
      : null;

    if (!guild || !channel?.isVoiceBased() || !canJoin(channel, guild.members.me)) {
      console.warn(`[24/7] Could not restore voice connection for guild ${guildId}.`);
      continue;
    }

    try {
      const queue = createOrUpdateQueue(
        player,
        guild,
        settings,
        settings.textChannelId,
        defaultVolume,
      );
      await queue.connect(channel);
      queue.node.setBitrate('auto');
      console.info(`[24/7] Restored ${guild.name} in ${channel.name}.`);
    } catch (error) {
      console.error(`[24/7] Failed to restore guild ${guildId}:`, error);
    }
  }
}

async function registerCommands(client, devGuildId) {
  if (devGuildId) {
    const guild = await client.guilds.fetch(devGuildId);
    await guild.commands.set(commands);
    console.info(`Registered ${commands.length} commands in ${guild.name}.`);
    return;
  }

  await client.application.commands.set(commands);
  console.info(`Registered ${commands.length} global commands.`);
}

async function handlePlay(interaction, player, store, defaultVolume) {
  const voiceChannel = requireSameVoiceChannel(interaction);
  const botMember = interaction.guild.members.me;
  if (!canJoin(voiceChannel, botMember)) {
    throw new Error('I need the Connect and Speak permissions in that voice channel.');
  }

  const query = interaction.options.getString('query', true).trim();
  if (!query) throw new Error('Enter a song name or URL.');

  await interaction.deferReply();
  const settings = store.get(interaction.guildId);
  const queue = createOrUpdateQueue(
    player,
    interaction.guild,
    settings,
    interaction.channelId,
    defaultVolume,
  );
  queue.node.setBitrate('auto');

  const result = await player.play(voiceChannel, query, {
    nodeOptions: queueOptions(settings, interaction.channelId, defaultVolume),
    requestedBy: interaction.user,
  });

  await interaction.editReply(`Queued ${trackLabel(result.track)}.`);
}

async function handleControl(interaction, player) {
  const queue = requireQueue(player, interaction, { playing: true });

  switch (interaction.commandName) {
    case 'skip':
      queue.node.skip();
      return interaction.reply('Skipped the current track.');
    case 'pause':
      if (!queue.node.pause()) throw new Error('Playback is already paused.');
      return interaction.reply('Playback paused.');
    case 'resume':
      if (!queue.node.resume()) throw new Error('Playback is not paused.');
      return interaction.reply('Playback resumed.');
    default:
      throw new Error('Unknown playback command.');
  }
}

async function handleQueue(interaction, player) {
  const queue = requireQueue(player, interaction, { playing: true });
  const current = `Now: ${trackLabel(queue.currentTrack)}`;
  const upcoming = queue.tracks.toArray().slice(0, 10);
  const list = upcoming.map((track, index) => `${index + 1}. ${trackLabel(track)}`).join('\n');
  const extra = queue.tracks.size > upcoming.length ? `\n…and ${queue.tracks.size - upcoming.length} more.` : '';
  await interaction.reply(`${current}\n\n${list || 'No tracks are waiting. Autoplay will choose the next song.'}${extra}`);
}

async function handleAutoplay(interaction, player, store) {
  requireSameVoiceChannel(interaction);
  const enabled = interaction.options.getBoolean('enabled', true);
  const settings = await store.update(interaction.guildId, { autoplay: enabled });
  const queue = getQueue(player, interaction.guildId);
  queue?.setRepeatMode(enabled ? QueueRepeatMode.AUTOPLAY : QueueRepeatMode.OFF);
  await interaction.reply(`Autoplay is now **${settings.autoplay ? 'on' : 'off'}**.`);
}

async function handleStay(interaction, player, store, defaultVolume) {
  const enabled = interaction.options.getBoolean('enabled', true);

  if (!enabled) {
    requireSameVoiceChannel(interaction);
    const settings = await store.update(interaction.guildId, {
      stayConnected: false,
      voiceChannelId: null,
    });
    const queue = getQueue(player, interaction.guildId);
    if (queue) {
      createOrUpdateQueue(
        player,
        interaction.guild,
        settings,
        interaction.channelId,
        defaultVolume,
      );
      if (!queue.currentTrack && queue.tracks.size === 0) queue.delete();
    }
    await interaction.reply('24/7 mode is off. I will leave after the queue ends.');
    return;
  }

  const channel = requireSameVoiceChannel(interaction);
  if (!canJoin(channel, interaction.guild.members.me)) {
    throw new Error('I need the Connect and Speak permissions in that voice channel.');
  }

  const settings = await store.update(interaction.guildId, {
    stayConnected: true,
    voiceChannelId: channel.id,
    textChannelId: interaction.channelId,
  });
  const queue = createOrUpdateQueue(
    player,
    interaction.guild,
    settings,
    interaction.channelId,
    defaultVolume,
  );
  await queue.connect(channel);
  queue.node.setBitrate('auto');
  await interaction.reply(`24/7 mode is on in **${channel.name}**. I will reconnect after restarts.`);
}

async function handleStop(interaction, player) {
  const queue = requireQueue(player, interaction);
  const stopped = queue.node.stop();
  await interaction.reply(stopped ? 'Playback stopped and the queue was cleared.' : 'The queue was cleared.');
}

async function handleDisconnect(interaction, player, store) {
  requireSameVoiceChannel(interaction);
  await store.update(interaction.guildId, {
    stayConnected: false,
    voiceChannelId: null,
  });
  getQueue(player, interaction.guildId)?.delete();
  await interaction.reply('Disconnected and disabled 24/7 mode.');
}

async function handleInteraction(interaction, player, store, defaultVolume) {
  if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;

  try {
    switch (interaction.commandName) {
      case 'play':
        await handlePlay(interaction, player, store, defaultVolume);
        break;
      case 'skip':
      case 'pause':
      case 'resume':
        await handleControl(interaction, player);
        break;
      case 'nowplaying': {
        const queue = requireQueue(player, interaction, { playing: true });
        await interaction.reply(`Now playing ${trackLabel(queue.currentTrack)}.`);
        break;
      }
      case 'queue':
        await handleQueue(interaction, player);
        break;
      case 'volume': {
        const queue = requireQueue(player, interaction, { playing: true });
        const volume = interaction.options.getInteger('level', true);
        queue.node.setVolume(volume);
        await interaction.reply(`Volume set to **${volume}%**.`);
        break;
      }
      case 'autoplay':
        await handleAutoplay(interaction, player, store);
        break;
      case 'stay':
        await handleStay(interaction, player, store, defaultVolume);
        break;
      case 'stop':
        await handleStop(interaction, player);
        break;
      case 'disconnect':
        await handleDisconnect(interaction, player, store);
        break;
      default:
        await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error(`Command /${interaction.commandName} failed:`, error);
    const response = {
      content: error.message || 'Something went wrong while running that command.',
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: response.content }).catch(() => null);
    } else {
      await interaction.reply(response).catch(() => null);
    }
  }
}

export async function createBot(config, store) {
  const client = new Client({
    allowedMentions: { parse: [], repliedUser: false },
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  const player = new Player(client);

  // The attachment extractor accepts server-local paths and depends on a legacy
  // file sniffer, so expose only remote music providers to user queries.
  await player.extractors.loadMulti([
    SoundCloudExtractor,
    VimeoExtractor,
    ReverbnationExtractor,
    AppleMusicExtractor,
    SpotifyExtractor,
  ]);

  player.events.on('playerStart', (queue, track) => {
    queue.node.setBitrate('auto');
    void sendToQueueChannel(client, queue, `Now playing ${trackLabel(track)}.`);
  });
  player.events.on('playerError', (queue, error) => {
    console.error('Player error:', error);
    void sendToQueueChannel(client, queue, `Could not play that track: ${error.message}`);
  });
  player.events.on('error', (queue, error) => {
    console.error('Queue error:', error);
    void sendToQueueChannel(client, queue, `Playback error: ${error.message}`);
  });
  player.events.on('emptyQueue', async (queue) => {
    const settings = store.get(queue.guild.id);
    if (settings.autoplay) {
      await sendToQueueChannel(client, queue, 'Autoplay could not find another related track.');
    }
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.info(`Ready as ${readyClient.user.tag}.`);
    readyClient.user.setActivity('/play • autoplay', { type: ActivityType.Listening });

    try {
      await registerCommands(client, config.devGuildId);
      await restorePersistentConnections(client, player, store, config.defaultVolume);
    } catch (error) {
      console.error('Startup task failed:', error);
    }
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction, player, store, config.defaultVolume);
  });

  return { client, player };
}
