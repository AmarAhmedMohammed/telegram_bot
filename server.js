require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');

const token = process.env.BOT_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL;

if (!token || !webhookUrl) {
  console.error('BOT_TOKEN and WEBHOOK_URL must be in .env');
  process.exit(1);
}

const bot = new TelegramBot(token);
const app = express();
const PORT = process.env.PORT || 3000;   // Render sets process.env.PORT

app.use(bodyParser.json());
app.use(express.static('public'));

const POSTS_FILE = path.join(__dirname, 'posts.json');

// Ensure posts file exists
fs.ensureFileSync(POSTS_FILE);
if (!fs.pathExistsSync(POSTS_FILE)) fs.writeJsonSync(POSTS_FILE, []);

// ---------- Webhook ----------
app.post('/telegram-webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ---------- Message handler ----------
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || '[Media]';
  const timestamp = new Date().toISOString();

  let mediaUrl = null;
  if (msg.photo) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    mediaUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  } else if (msg.video) {
    const file = await bot.getFile(msg.video.file_id);
    mediaUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  }

  // Load current posts
  let posts = [];
  try { posts = fs.readJsonSync(POSTS_FILE); } catch (_) {}

  // Add new post
  posts.unshift({ text, mediaUrl, timestamp, chatId });

  // Keep last 50
  if (posts.length > 50) posts = posts.slice(0, 50);

  // Save
  fs.writeJsonSync(POSTS_FILE, posts);
  console.log('New post saved:', text);
});

// ---------- API ----------
app.get('/api/posts', (req, res) => {
  try {
    const posts = fs.readJsonSync(POSTS_FILE);
    res.json(posts);
  } catch (e) {
    res.json([]);
  }
});

// ---------- Set webhook ----------
bot.setWebHook(webhookUrl)
  .then(() => console.log('Webhook set →', webhookUrl))
  .catch(err => console.error('setWebHook error:', err.message));

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Open: https://telegram-bot-2-e4v9.onrender.com`);
});