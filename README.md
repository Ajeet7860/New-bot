# New Bot

A Discord music bot focused on clean audio, continuous voice presence, and automatic related tracks.

## Features

- Automatic bitrate selection up to the voice channel's Discord limit
- Opus support through `mediaplex` and FFmpeg transcoding when a source requires it
- Autoplay enabled by default, with a per-server `/autoplay` switch
- Persistent `/stay` mode that reconnects to the saved voice channel after a restart
- Process recovery through Docker Compose's `restart: unless-stopped`
- Slash commands only, so the privileged Message Content intent is not needed
- Official Discord Player extractors for SoundCloud, Spotify/Apple Music metadata, Vimeo, and ReverbNation

> Spotify and Apple Music do not expose audio streams through their official extractors. Discord Player tries to bridge those tracks to a playable source. Availability depends on the source and its terms.

## Setup

1. Install Node.js 22+ and FFmpeg.
2. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
3. Invite it with the `bot` and `applications.commands` scopes. Give it View Channel, Connect, Speak, Send Messages, and Embed Links permissions.
4. Copy `.env.example` to `.env` and set `DISCORD_TOKEN`.
5. Install and start:

   ```bash
   npm ci
   npm start
   ```

For instant command registration while developing, set `DEV_GUILD_ID` to your test server ID. Without it, the bot registers commands globally.

## 24/7 deployment

Docker Compose keeps the process running and preserves per-server settings:

```bash
docker compose up -d --build
docker compose logs -f music-bot
```

Run `/stay enabled:true` while you are in the desired voice channel. The bot stays connected after the queue ends and reconnects there after a process restart. Use `/disconnect` to leave and disable this behavior.

True 24/7 uptime requires an always-on host. Free hosting that sleeps inactive services cannot keep a voice connection alive.

## Commands

| Command | Purpose |
| --- | --- |
| `/play query:<name or URL>` | Play or enqueue a track |
| `/skip`, `/pause`, `/resume` | Control playback |
| `/nowplaying`, `/queue` | Inspect playback |
| `/volume level:<1-100>` | Set the queue volume |
| `/autoplay enabled:<true/false>` | Toggle related-track autoplay |
| `/stay enabled:<true/false>` | Toggle persistent 24/7 voice presence |
| `/stop` | Stop and clear tracks without leaving 24/7 mode |
| `/disconnect` | Stop, leave voice, and disable 24/7 mode |

## Quality notes

The bot requests Discord Player's `auto` bitrate, which selects the voice channel's available bitrate. It avoids sound-altering filters by default. The source recording, provider stream, Discord server boost level, network quality, and channel bitrate still determine the final quality.

## Checks

```bash
npm run check
npm test
```
