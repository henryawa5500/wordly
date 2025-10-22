// =================== CONFIGURATION ===================
const ROWS = 6;
const COLS = 5;
const DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// =================== WORD POOLS (All 5-letter words) ===================
const EASY_WORDS = [
  'APPLE', 'WATER', 'LIGHT', 'HOUSE', 'BREAD',
  'PHONE', 'GRASS', 'SMILE', 'TRAIN', 'PLANT',
  'HEART', 'MUSIC', 'CHAIR', 'TABLE', 'HAPPY'
];

const MEDIUM_WORDS = [
  'BRAVE', 'QUIET', 'STORM', 'CLOUD', 'NIGHT',
  'RIVER', 'BRAIN', 'VOICE', 'POWER', 'GREEN',
  'DREAM', 'CRANE', 'STONE', 'WORLD', 'FLASH'
];

const HARD_WORDS = [
  'CRYPT', 'RHYME', 'ZEPHY', 'PIXEL', 'GHOST',
  'MYTHS', 'QUARK', 'VEXED', 'NERVE', 'BLAZE',
  'PLAZA', 'FJORD', 'KHAKI', 'OXIDE', 'WALTZ'
];

// =================== STATE ===================
let score = parseInt(localStorage.getItem('score')) || 0;
let currentLevel = 'easy';
let target = '';
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
let currentRow = 0;
let currentCol = 0;
let gameOver = false;
let canStart = false;

const boardEl = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const messageEl = document.getElementById('message');
const scoreEl = document.getElementById('score');

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

// =================== DIFFICULTY & WORD SELECTION ===================
function getDifficultyLevel() {
  if (score < 5) return 'easy';
  if (score < 10) return 'medium';
  return 'hard';
}

function getWordByDifficulty() {
  currentLevel = getDifficultyLevel();
  let pool =
    currentLevel === 'easy'
      ? EASY_WORDS
      : currentLevel === 'medium'
      ? MEDIUM_WORDS
      : HARD_WORDS;
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
    <div style="font-size:18px;margin-bottom:12px">Word Definition Hint (${currentLevel.toUpperCase()} LEVEL)</div>
    <div style="padding:12px;background:rgba(255,255,255,0.1);border-radius:6px;font-size:14px;margin-bottom:12px">
      ${definition}
    </div>
    <div class="countdown" style="color:#9aa0a6;font-size:13px">Game starts in 10s...</div>
  `;

  hintOverlay.appendChild(hintModal);
  document.body.appendChild(hintOverlay);

  let timeLeft = 10;
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
  key.classList.remove('green', 'yellow', 'gray');
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
  return new RegExp('^[A-Z]{' + COLS + '}$').test(word);
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
      localStorage.setItem('score', score);
      gameOver = true;
      showMessage('🎉 You Win!', 0);
      showOverlay(true);
      return;
    }

    currentRow++;
    currentCol = 0;

    if (currentRow >= ROWS) {
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

// =================== SCORE & UI FEEDBACK ===================
function updateScoreDisplay() {
  if (scoreEl) {
    scoreEl.innerHTML = `Score: ${score} | Level: ${currentLevel.toUpperCase()}`;
  }
}

function showMessage(text, ms = 1800) {
  messageEl.textContent = text;
  if (ms > 0) {
    setTimeout(() => {
      if (messageEl.textContent === text) messageEl.textContent = '';
    }, ms);
  }
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
  getWordByDifficulty();
  showMessage('Loading hint...', 0);
  await showDefinitionHint();
  showMessage(`Guess the ${COLS}-letter word! You have ${ROWS} attempts.`, 0);
})();

