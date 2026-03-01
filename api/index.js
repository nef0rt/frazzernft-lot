// Хранилище в памяти (на Vercel сбрасывается при редеплое)
// Для постоянства — подключи MongoDB, но для демки сойдёт
let participants = [];
let winner = null;
let drawCompleted = false;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method, url } = req;

  // Участие в розыгрыше
  if (url.startsWith('/api/participate') && method === 'POST') {
    const { userId, userName } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Нет ID пользователя' });
    }

    // Проверка на дубли
    if (participants.some(p => p.id === userId)) {
      return res.json({ 
        success: true, 
        alreadyJoined: true,
        participants: participants
      });
    }

    // Добавляем нового
    participants.push({
      id: userId,
      name: userName || 'Аноним',
      joinedAt: new Date().toISOString()
    });

    return res.json({ 
      success: true, 
      participants: participants 
    });

  // Получение всех участников и победителя
  } else if (url.startsWith('/api/participants') && method === 'GET') {
    return res.json({ 
      participants: participants,
      winner: winner,
      drawCompleted: drawCompleted
    });

  // Проведение розыгрыша (вызывается автоматически по таймеру)
  } else if (url.startsWith('/api/draw') && method === 'POST') {
    const { force } = req.body;

    // Проверяем, можно ли проводить розыгрыш
    const now = new Date();
    const deadline = new Date('2025-03-02T18:00:00+03:00');
    
    if (!force && now < deadline) {
      return res.status(400).json({ 
        error: 'Розыгрыш еще не начался',
        timeLeft: deadline - now
      });
    }

    if (drawCompleted) {
      return res.json({ 
        drawCompleted: true,
        winner: winner 
      });
    }

    if (participants.length === 0) {
      return res.status(400).json({ error: 'Нет участников' });
    }

    // Выбираем победителя
    const randomIndex = Math.floor(Math.random() * participants.length);
    winner = participants[randomIndex];
    drawCompleted = true;

    return res.json({ 
      success: true, 
      winner: winner,
      participants: participants 
    });

  } else {
    res.status(404).json({ error: 'Not found' });
  }
  }
