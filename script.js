// =================== CONFIGURATION ===================
const ROWS = 6;
const COLS = 5;
const RANDOM_WORD_API = 'https://random-word-form.vercel.app/api/word?number=500&type=noun';
const DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// =================== STATE ===================
localStorage.removeItem('score');
localStorage.removeItem('wins');
localStorage.removeItem('streak');

let score = 0;
let wins = 0;
let streak = 0;

let target = '';
let EASY_POOL = [];
let MEDIUM_POOL = [];
let HARD_POOL = [];

let board = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
let currentRow = 0;
let currentCol = 0;
let gameOver = false;
let canStart = false;

const boardEl = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const messageEl = document.getElementById('message');
const scoreEl = document.getElementById('score');
const winsEl = document.getElementById('wins');
const streakEl = document.getElementById('streak');
const levelEl = document.getElementById('level');
const levelSelectEl = document.getElementById('levelSelect');

const KEY_LAYOUT = [
  'Q','W','E','R','T','Y','U','I','O','P',
  'A','S','D','F','G','H','J','K','L',
  'Enter','Z','X','C','V','B','N','M','Backspace'
];

// =================== UI CREATION ===================
function createBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    for (let c = 0; c < COLS; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.row = r;
      tile.dataset.col = c;
      row.appendChild(tile);
    }
    boardEl.appendChild(row);
  }
}

function createKeyboard() {
  keyboardEl.innerHTML = '';
  KEY_LAYOUT.forEach(k => {
    const key = document.createElement('div');
    key.className = 'key';
    if (k === 'Enter' || k === 'Backspace') key.classList.add('wide');
    key.textContent = k === 'Backspace' ? '⌫' : k;
    key.dataset.key = k;
    key.addEventListener('click', () => handleInput(k));
    keyboardEl.appendChild(key);
  });
}

// =================== FETCH & FILTER WORDS ===================
async function fetchWordsFromAPI() {
  try {
    const res = await fetch(RANDOM_WORD_API);
    const words = await res.json();
    const pool = words
      .map(w => w.toUpperCase())
      .filter(w => /^[A-Z]{5}$/.test(w));

    // Filter words by difficulty
    EASY_POOL = pool.filter(w => /^[A-M]+$/.test(w));  // mostly simple letters
    MEDIUM_POOL = pool.filter(w => /^[A-Z]+$/.test(w) && !EASY_POOL.includes(w));
    HARD_POOL = pool.filter(w => /[QXZ]/.test(w) || /^[A-Z]+$/.test(w) && !EASY_POOL.includes(w) && !MEDIUM_POOL.includes(w));

    // Fallbacks if pool empty
    if (EASY_POOL.length === 0) EASY_POOL = ['APPLE','HOUSE','TABLE','PLANT','CHAIR'];
    if (MEDIUM_POOL.length === 0) MEDIUM_POOL = ['BRAVE','STORM','RIVER','VOICE','POWER'];
    if (HARD_POOL.length === 0) HARD_POOL = ['CRYPT','PIXEL','GHOST','MYTHS','QUARK'];

    console.log(`Easy: ${EASY_POOL.length}, Medium: ${MEDIUM_POOL.length}, Hard: ${HARD_POOL.length}`);
  } catch {
    EASY_POOL = ['APPLE','HOUSE','TABLE','PLANT','CHAIR'];
    MEDIUM_POOL = ['BRAVE','STORM','RIVER','VOICE','POWER'];
    HARD_POOL = ['CRYPT','PIXEL','GHOST','MYTHS','QUARK'];
  }
}

// =================== WORD SELECTION ===================
function getDifficultyLevel() {
  return levelSelectEl.value;
}

function getWordByDifficulty() {
  const level = getDifficultyLevel();
  let pool = EASY_POOL;
  if (level === 'medium') pool = MEDIUM_POOL;
  if (level === 'hard') pool = HARD_POOL;

  target = pool[Math.floor(Math.random() * pool.length)];
  updateScoreDisplay();
}

// =================== HINT FEATURE ===================
async function fetchWordDefinition(word) {
  try {
    const res = await fetch(`${DICTIONARY_API}${word.toLowerCase()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data[0]?.meanings?.[0]?.definitions?.[0]?.definition || null;
  } catch {
    return null;
  }
}

async function showDefinitionHint() {
  const definition = await fetchWordDefinition(target);
  if (!definition) {
    canStart = true;
    return;
  }

  const hintOverlay = document.createElement('div');
  hintOverlay.className = 'overlay';
  const hintModal = document.createElement('div');
  hintModal.className = 'modal';

  hintModal.innerHTML = `
    <div style="font-size:18px;margin-bottom:12px">Word Definition Hint (${getDifficultyLevel().toUpperCase()})</div>
    <div style="padding:12px;background:rgba(255,255,255,0.1);border-radius:6px;font-size:14px;margin-bottom:12px">
      ${definition}
    </div>
    <div class="countdown" style="color:#9aa0a6;font-size:13px">Game starts in 20s...</div>
  `;

  hintOverlay.appendChild(hintModal);
  document.body.appendChild(hintOverlay);

  let timeLeft = 20;
  const countdownEl = hintModal.querySelector('.countdown');

  return new Promise(resolve => {
    const timer = setInterval(() => {
      timeLeft--;
      countdownEl.textContent = `Game starts in ${timeLeft}s...`;
      if (timeLeft <= 0) {
        clearInterval(timer);
        document.body.removeChild(hintOverlay);
        canStart = true;
        resolve();
      }
    }, 1000);
  });
}

// =================== GAME LOGIC ===================
function updateTile(row, col, letter) {
  const tile = boardEl.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
  if (!tile) return;
  tile.textContent = letter;
  tile.classList.toggle('filled', !!letter);
}

function setKeyState(letter, state) {
  const key = Array.from(keyboardEl.querySelectorAll('.key'))
    .find(k => k.dataset.key === letter || k.dataset.key === letter.toUpperCase());
  if (!key) return;
  key.classList.remove('green','yellow','gray');
  key.classList.add(state);
}

function revealRow(rowIndex) {
  const rowTiles = Array.from(boardEl.querySelectorAll(`.tile[data-row="${rowIndex}"]`));
  const guess = board[rowIndex].join('');
  const targetArr = target.split('');
  const result = Array(COLS).fill('gray');

  for (let i = 0; i < COLS; i++) {
    if (guess[i] === targetArr[i]) {
      result[i] = 'green';
      targetArr[i] = null;
    }
  }

  for (let i = 0; i < COLS; i++) {
    if (result[i] === 'gray' && guess[i]) {
      const idx = targetArr.indexOf(guess[i]);
      if (idx !== -1) {
        result[i] = 'yellow';
        targetArr[idx] = null;
      }
    }
  }

  rowTiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add('reveal', result[i]);
      setKeyState(guess[i], result[i]);
      setTimeout(() => tile.classList.remove('reveal'), 350);
    }, i * 180);
  });

  return result;
}

function isValidGuess(word) {
  return /^[A-Z]{5}$/.test(word);
}

function handleInput(key) {
  if (gameOver || !canStart) return;

  if (key === 'Backspace') {
    if (currentCol > 0) {
      currentCol--;
      board[currentRow][currentCol] = '';
      updateTile(currentRow, currentCol, '');
    }
    return;
  }

  if (key === 'Enter') {
    if (currentCol !== COLS) {
      showMessage('Not enough letters', 1200);
      return;
    }

    const guess = board[currentRow].join('');
    if (!isValidGuess(guess)) {
      showMessage('Invalid guess', 1200);
      return;
    }

    const colors = revealRow(currentRow);

    if (colors.every(c => c === 'green')) {
      score++;
      wins++;
      streak++;
      updateScoreDisplay();
      gameOver = true;
      showMessage('🎉 You Win!', 0);
      showOverlay(true);
      return;
    }

    currentRow++;
    currentCol = 0;

    if (currentRow >= ROWS) {
      streak = 0; // reset streak on loss
      updateScoreDisplay();
      gameOver = true;
      showMessage(`❌ Word was ${target}`, 0);
      showOverlay(false);
      return;
    }

    showMessage(`Attempt ${currentRow + 1} of ${ROWS}`, 1000);
    return;
  }

  if (/^[A-Za-z]$/.test(key)) {
    if (currentCol >= COLS) return;
    const letter = key.toUpperCase();
    board[currentRow][currentCol] = letter;
    updateTile(currentRow, currentCol, letter);
    currentCol++;
  }
}

// =================== UI UPDATES ===================
function updateScoreDisplay() {
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  if (winsEl) winsEl.textContent = `Wins: ${wins}`;
  if (streakEl) streakEl.textContent = `Streak: ${streak}`;
  if (levelEl) levelEl.textContent = `Level: ${getDifficultyLevel().toUpperCase()}`;
}

function showMessage(text, ms = 1800) {
  messageEl.textContent = text;
  if (ms > 0) setTimeout(() => { if (messageEl.textContent === text) messageEl.textContent = ''; }, ms);
}

function showOverlay(won) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div style="font-size:18px;margin-bottom:8px">${won ? '🎉 Congratulations!' : '😔 Out of attempts'}</div>
    <div style="margin-bottom:14px">The word was <b>${target}</b></div>
    <button id="restartBtn" style="padding:8px 12px;border-radius:6px;border:none;cursor:pointer;background:#6c6cff;color:white;font-weight:700">Next Round</button>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('restartBtn').addEventListener('click', async () => {
    document.body.removeChild(overlay);
    await restartGame();
  });
}

// =================== GAME CONTROL ===================
async function restartGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
  currentRow = 0;
  currentCol = 0;
  gameOver = false;
  canStart = false;
  Array.from(keyboardEl.children).forEach(k => k.classList.remove('green','yellow','gray'));
  createBoard();
  createKeyboard();
  getWordByDifficulty();
  updateScoreDisplay();
  showMessage('Fetching hint...', 0);
  await showDefinitionHint();
  showMessage(`Start guessing! You have ${ROWS} attempts.`, 0);
}

document.addEventListener('keydown', (e) => {
  if (gameOver || !canStart) return;
  if (e.key === 'Enter') { handleInput('Enter'); e.preventDefault(); return; }
  if (e.key === 'Backspace') { handleInput('Backspace'); e.preventDefault(); return; }
  const k = e.key.toUpperCase();
  if (/^[A-Z]$/.test(k)) handleInput(k);
});

// =================== INIT ===================
(async function init() {
  createBoard();
  createKeyboard();
  await fetchWordsFromAPI();
  getWordByDifficulty();
  showMessage('Loading hint...', 0);
  await showDefinitionHint();
  showMessage(`Guess the ${COLS}-letter word! You have ${ROWS} attempts.`, 0);
})();
