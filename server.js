require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');

const token = process.env.BOT_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL;

if (!token || !webhookUrl) {
  console.error('Error: BOT_TOKEN and WEBHOOK_URL must be set in .env');
  process.exit(1);
}

const bot = new TelegramBot(token);
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// File to store posts
const POSTS_FILE = path.join(__dirname, 'posts.json');

// Initialize posts file
fs.ensureFileSync(POSTS_FILE);
if (!fs.existsSync(POSTS_FILE)) fs.writeJsonSync(POSTS_FILE, []);

// Webhook endpoint
app.post('/telegram-webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Handle incoming messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || '[Media]';
  const timestamp = new Date().toISOString();

  // Optional: Only allow your personal chat
  // const ALLOWED_CHAT_ID = 123456789; // Replace with your Telegram user ID
  // if (chatId !== ALLOWED_CHAT_ID) return;

  let mediaUrl = null;
  if (msg.photo) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    mediaUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  } else if (msg.video) {
    const file = await bot.getFile(msg.video.file_id);
    mediaUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  }

  // Load existing posts
  let posts = [];
  try {
    posts = fs.readJsonSync(POSTS_FILE);
  } catch (e) {
    posts = [];
  }

  // Add new post
  posts.unshift({
    text,
    mediaUrl,
    timestamp,
    chatId
  });

  // Keep only last 50
  if (posts.length > 50) posts = posts.slice(0, 50);

  // Save
  fs.writeJsonSync(POSTS_FILE, posts);
  console.log('New post saved:', text);
});

// API: Get all posts
app.get('/api/posts', (req, res) => {
  try {
    const posts = fs.readJsonSync(POSTS_FILE);
    res.json(posts);
  } catch (e) {
    res.json([]);
  }
});

// Set webhook on startup
bot.setWebHook(`${webhookUrl}`).then(() => {
  console.log(`Webhook set to: ${webhookUrl}`);
}).catch(err => {
  console.error('Failed to set webhook:', err.message);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
  console.log(`Webhook: ${webhookUrl}`);
});