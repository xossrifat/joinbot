const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const googleTTS = require('google-tts-api'); // For Text-to-Speech
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ],
});

// Track if the bot is already in a voice channel to avoid reconnecting
let isBotInChannel = false;

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Handle voice state updates
client.on('voiceStateUpdate', async (oldState, newState) => {
  // Skip if the user is the bot itself
  if (oldState.member.user.id === client.user.id || newState.member.user.id === client.user.id) {
    return;
  }

  const newUserChannel = newState.channel;
  const oldUserChannel = oldState.channel;
  // Check if a user joined a voice channel
  if (!oldUserChannel && newUserChannel) {
    announceTTS(newState.member, newUserChannel, 'joined');
  }
  // Check if a user left a voice channel
  else if (oldUserChannel && !newUserChannel) {
    announceTTS(oldState.member, oldUserChannel, 'left');
  }
});

// Function to announce the TTS message
async function announceTTS(member, channel, action) {
  try {
    const username = member.user.username;
    const message = `${username} has ${action} the voice channel`;
    console.log(message);
    

    // Generate TTS audio URL
    const ttsUrl = googleTTS.getAudioUrl(message, {
      lang: 'en',
      slow: false,
      host: 'https://translate.google.com',
    });

    // Ensure the Music folder exists
    const musicFolderPath = path.join(__dirname, 'Music');
    if (!fs.existsSync(musicFolderPath)) {
      fs.mkdirSync(musicFolderPath);  // Create the folder if it doesn't exist
    }

    // Download the TTS audio file
    const response = await axios.get(ttsUrl, { responseType: 'stream' });
    const audioFilePath = path.join(musicFolderPath, 'tts-audio.mp3');
    const writer = fs.createWriteStream(audioFilePath);
    response.data.pipe(writer);

    writer.on('finish', () => {
      playAudioFromFile(channel, audioFilePath);
    });
  } catch (error) {
    console.error('Error announcing TTS:', error);
  }
}

// Function to play the downloaded audio from the 'Music' folder
async function playAudioFromFile(channel, filePath) {
  try {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      console.error('Audio file not found!');
      return;
    }

    // Only join the voice channel if not already connected
    if (!isBotInChannel) {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });

      isBotInChannel = true;  // Mark the bot as in the channel

      // Create an audio resource from the local file
      const resource = createAudioResource(filePath);
      const player = createAudioPlayer();

      player.play(resource);
      connection.subscribe(player);

      // Handle when the audio is finished
      player.on(AudioPlayerStatus.Idle, () => {
        console.log('Finished playing audio.');
        fs.unlinkSync(filePath); // Delete the temporary file after playing
        connection.destroy(); // Disconnect from the voice channel
        isBotInChannel = false;  // Mark the bot as not in the channel
      });
    }
  } catch (error) {
    console.error('Error playing audio from file:', error);
  }
}

// Login to Discord with your bot token
client.login(process.env.BOT_TOKEN);
