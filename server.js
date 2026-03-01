const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// Инициализация базы данных
let db;

(async () => {
  db = await open({
    filename: './raffle.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      photo_url TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ База данных подключена');
})();

// Валидация данных от Telegram (WebApp)
function validateTelegramData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return computedHash === hash ? Object.fromEntries(params) : null;
  } catch (error) {
    console.error('Ошибка валидации:', error);
    return null;
  }
}

// API: регистрация участника
app.post('/api/participate', async (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ error: 'Нет данных авторизации' });
    }

    const userData = validateTelegramData(initData);
    if (!userData || !userData.user) {
      return res.status(401).json({ error: 'Недействительные данные Telegram' });
    }

    const user = JSON.parse(userData.user);
    
    // Проверяем, не участвовал ли уже
    const existing = await db.get('SELECT * FROM participants WHERE telegram_id = ?', [user.id]);
    
    if (existing) {
      return res.json({ 
        success: true, 
        message: 'Вы уже участвуете в розыгрыше',
        alreadyJoined: true 
      });
    }

    // Добавляем нового участника
    await db.run(
      'INSERT INTO participants (telegram_id, username, first_name, last_name, photo_url) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.username || null, user.first_name || null, user.last_name || null, user.photo_url || null]
    );

    // Получаем общее количество участников
    const count = await db.get('SELECT COUNT(*) as total FROM participants');

    res.json({ 
      success: true, 
      message: 'Вы приняли участие в розыгрыше',
      participants: count.total,
      user: {
        id: user.id,
        name: user.first_name + (user.last_name ? ' ' + user.last_name : ''),
        username: user.username
      }
    });

  } catch (error) {
    console.error('Ошибка участия:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// API: выбор победителя (только для админа по секретному ключу)
app.post('/api/draw', async (req, res) => {
  try {
    const { secretKey } = req.body;
    
    if (secretKey !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Проверяем, не прошел ли таймер (2 марта 18:00 МСК)
    const deadline = new Date('2025-03-02T18:00:00+03:00');
    const now = new Date();
    
    if (now < deadline) {
      return res.status(400).json({ 
        error: 'Розыгрыш еще не завершен',
        timeLeft: deadline - now 
      });
    }

    // Получаем всех участников
    const participants = await db.all('SELECT * FROM participants');
    
    if (participants.length === 0) {
      return res.status(400).json({ error: 'Нет участников' });
    }

    // Выбираем случайного
    const winner = participants[Math.floor(Math.random() * participants.length)];

    res.json({
      success: true,
      winner: {
        id: winner.telegram_id,
        name: winner.first_name + (winner.last_name ? ' ' + winner.last_name : ''),
        username: winner.username
      },
      total: participants.length
    });

  } catch (error) {
    console.error('Ошибка выбора победителя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// API: статистика (количество участников)
app.get('/api/stats', async (req, res) => {
  try {
    const count = await db.get('SELECT COUNT(*) as total FROM participants');
    res.json({ participants: count.total });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
