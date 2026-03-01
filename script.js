let tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const API_URL = '/api'; // для Vercel
const deadline = new Date('2025-03-02T18:00:00+03:00');

// Элементы
const participantsList = document.getElementById('participantsList');
const winnerDisplay = document.getElementById('winnerDisplay');
const participantsCount = document.getElementById('participantsCount');

// Загрузка данных
async function loadData() {
  try {
    const res = await fetch(`${API_URL}/participants`);
    const data = await res.json();
    
    // Обновляем список
    updateParticipantsList(data.participants);
    participantsCount.textContent = data.participants.length;
    
    // Победитель
    if (data.winner) {
      winnerDisplay.innerHTML = `
        <div class="winner-announce">
          🏆 ПОБЕДИТЕЛЬ: ${data.winner.name} 🏆
        </div>
      `;
    }
    
    // Автоматический розыгрыш после дедлайна
    if (new Date() > deadline && !data.drawCompleted) {
      setTimeout(drawWinner, 1000);
    }
  } catch (e) {
    console.error('Ошибка загрузки:', e);
  }
}

function updateParticipantsList(list) {
  participantsList.innerHTML = list.map(p => 
    `<div class="participant-item">👤 ${p.name}</div>`
  ).join('');
}

// Участие
async function participate() {
  const user = tg.initDataUnsafe?.user;
  if (!user) {
    alert('Ошибка: нет данных пользователя');
    return;
  }

  const res = await fetch(`${API_URL}/participate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id.toString(),
      userName: user.first_name + (user.last_name ? ' ' + user.last_name : '')
    })
  });

  const data = await res.json();
  
  if (data.success) {
    updateParticipantsList(data.participants);
    participantsCount.textContent = data.participants.length;
    showMessage('✅ Вы участвуете!');
    tg.HapticFeedback.notificationOccurred('success');
  }
}

// Розыгрыш
async function drawWinner() {
  const res = await fetch(`${API_URL}/draw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force: true })
  });

  const data = await res.json();
  if (data.winner) {
    winnerDisplay.innerHTML = `
      <div class="winner-announce">
        🏆 ПОБЕДИТЕЛЬ: ${data.winner.name} 🏆
      </div>
    `;
  }
}

// Таймер
function updateTimer() {
  const diff = deadline - new Date();
  if (diff <= 0) {
    document.getElementById('timer').innerHTML = '⏰ Розыгрыш завершен';
    return;
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  document.getElementById('timer').innerHTML = 
    `${days}д ${hours}ч ${mins}м ${secs}с`;
}

setInterval(updateTimer, 1000);
updateTimer();
loadData();
