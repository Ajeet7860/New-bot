import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or add it to the queue')
    .addStringOption((option) =>
      option.setName('query').setDescription('Song name or supported URL').setRequired(true),
    ),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current track'),
  new SlashCommandBuilder().setName('pause').setDescription('Pause playback'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume playback'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current track'),
  new SlashCommandBuilder().setName('queue').setDescription('Show the upcoming tracks'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Change playback volume')
    .addIntegerOption((option) =>
      option
        .setName('level')
        .setDescription('Volume from 1 to 100')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Automatically play related songs when the queue ends')
    .addBooleanOption((option) =>
      option.setName('enabled').setDescription('Turn autoplay on or off').setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName('stay')
    .setDescription('Keep the bot in voice 24/7 and reconnect after restarts')
    .addBooleanOption((option) =>
      option.setName('enabled').setDescription('Turn 24/7 mode on or off').setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Clear the queue and stop playback (24/7 mode stays connected)'),
  new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Stop playback, disable 24/7 mode, and leave voice'),
].map((command) => command.toJSON());
