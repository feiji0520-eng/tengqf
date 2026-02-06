const systemInfo = wx.getSystemInfoSync();
const screenWidth = systemInfo.screenWidth;
const screenHeight = systemInfo.screenHeight;
const pixelRatio = systemInfo.pixelRatio || 1;

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const openDataContext = wx.getOpenDataContext();
const sharedCanvas = openDataContext ? openDataContext.canvas : null;

canvas.width = screenWidth * pixelRatio;
canvas.height = screenHeight * pixelRatio;
ctx.scale(pixelRatio, pixelRatio);

const STATE = {
  READY: 'ready',
  RUNNING: 'running',
  GAME_OVER: 'game_over',
};

const game = {
  state: STATE.READY,
  score: 0,
  best: 0,
  lastTime: 0,
  gameOverHandled: false,
  showRanking: false,
  levelIndex: 0,
  levels: [
    {
      name: '简单',
      pipeGap: 190,
      pipeSpeed: 160,
      spawnInterval: 1600,
      gravity: 680,
      flapStrength: -250,
    },
    {
      name: '普通',
      pipeGap: 160,
      pipeSpeed: 190,
      spawnInterval: 1400,
      gravity: 720,
      flapStrength: -260,
    },
    {
      name: '困难',
      pipeGap: 130,
      pipeSpeed: 220,
      spawnInterval: 1200,
      gravity: 760,
      flapStrength: -270,
    },
  ],
  bird: {
    x: screenWidth * 0.25,
    y: screenHeight * 0.5,
    radius: 16,
    velocity: 0,
  },
  pipes: [],
  pipeWidth: 54,
  pipeGap: 160,
  pipeSpeed: 180,
  gravity: 720,
  flapStrength: -260,
  spawnInterval: 1400,
  spawnTimer: 0,
};

const applyLevelSettings = () => {
  const level = game.levels[game.levelIndex] || game.levels[0];
  game.pipeGap = level.pipeGap;
  game.pipeSpeed = level.pipeSpeed;
  game.spawnInterval = level.spawnInterval;
  game.gravity = level.gravity;
  game.flapStrength = level.flapStrength;
};

const resetGame = () => {
  game.state = STATE.READY;
  game.score = 0;
  game.spawnTimer = 0;
  game.pipes = [];
  game.bird.y = screenHeight * 0.5;
  game.bird.velocity = 0;
  game.gameOverHandled = false;
  game.showRanking = false;
  applyLevelSettings();
};

const syncOpenDataSize = () => {
  if (!openDataContext || !sharedCanvas) {
    return;
  }
  sharedCanvas.width = screenWidth * pixelRatio;
  sharedCanvas.height = screenHeight * pixelRatio;
  openDataContext.postMessage({
    type: 'init',
    width: screenWidth,
    height: screenHeight,
    pixelRatio,
  });
};

const startGame = () => {
  if (game.state === STATE.READY || game.state === STATE.GAME_OVER) {
    resetGame();
    game.state = STATE.RUNNING;
  }
};

const flap = () => {
  if (game.state === STATE.READY) {
    startGame();
  }
  if (game.state === STATE.RUNNING) {
    game.bird.velocity = game.flapStrength;
  }
  if (game.state === STATE.GAME_OVER) {
    startGame();
  }
};

const getRankingButtonRect = () => {
  const width = 160;
  const height = 44;
  const x = (screenWidth - width) / 2;
  const y = screenHeight / 2 + 70;
  return {
    x,
    y,
    width,
    height,
  };
};

const getLevelButtonRects = () => {
  const buttonWidth = 80;
  const buttonHeight = 40;
  const spacing = 16;
  const totalWidth = buttonWidth * game.levels.length + spacing * (game.levels.length - 1);
  const startX = (screenWidth - totalWidth) / 2;
  const y = screenHeight / 2 + 120;
  return game.levels.map((level, index) => ({
    level,
    index,
    x: startX + index * (buttonWidth + spacing),
    y,
    width: buttonWidth,
    height: buttonHeight,
  }));
};

const isPointInRect = (x, y, rect) => (
  x >= rect.x &&
  x <= rect.x + rect.width &&
  y >= rect.y &&
  y <= rect.y + rect.height
);

const toggleRanking = () => {
  if (!sharedCanvas) {
    return;
  }
  game.showRanking = !game.showRanking;
  if (game.showRanking && openDataContext) {
    openDataContext.postMessage({
      type: 'fetch',
      score: game.best,
    });
  }
};

wx.onTouchStart((event) => {
  const touch = event.touches[0];
  if (touch) {
    if (game.showRanking) {
      game.showRanking = false;
      return;
    }
    if (game.state === STATE.READY) {
      const buttonRect = getRankingButtonRect();
      if (isPointInRect(touch.clientX, touch.clientY, buttonRect)) {
        toggleRanking();
        return;
      }
      const levelRects = getLevelButtonRects();
      const selectedLevel = levelRects.find((rect) => isPointInRect(touch.clientX, touch.clientY, rect));
      if (selectedLevel) {
        game.levelIndex = selectedLevel.index;
        applyLevelSettings();
        return;
      }
    }
  }
  flap();
});

const handleGameOver = () => {
  if (game.gameOverHandled) {
    return;
  }
  game.gameOverHandled = true;
  if (wx.setUserCloudStorage) {
    wx.setUserCloudStorage({
      KVDataList: [{
        key: 'bestScore',
        value: String(game.best),
      }],
    });
  }
  if (openDataContext) {
    openDataContext.postMessage({
      type: 'fetch',
      score: game.best,
    });
  }
};

const setGameOver = () => {
  if (game.state !== STATE.GAME_OVER) {
    game.state = STATE.GAME_OVER;
    handleGameOver();
  }
};

const spawnPipe = () => {
  const padding = 40;
  const gap = game.pipeGap;
  const minTop = padding + 40;
  const maxTop = screenHeight - gap - padding;
  const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
  game.pipes.push({
    x: screenWidth + game.pipeWidth,
    topHeight,
    passed: false,
  });
};

const update = (delta) => {
  if (game.state !== STATE.RUNNING) {
    return;
  }

  game.bird.velocity += game.gravity * delta;
  game.bird.y += game.bird.velocity * delta;

  game.spawnTimer += delta * 1000;
  if (game.spawnTimer >= game.spawnInterval) {
    game.spawnTimer = 0;
    spawnPipe();
  }

  game.pipes.forEach((pipe) => {
    pipe.x -= game.pipeSpeed * delta;
    if (!pipe.passed && pipe.x + game.pipeWidth < game.bird.x) {
      pipe.passed = true;
      game.score += 1;
      game.best = Math.max(game.best, game.score);
    }
  });

  game.pipes = game.pipes.filter((pipe) => pipe.x + game.pipeWidth > -10);

  const birdTop = game.bird.y - game.bird.radius;
  const birdBottom = game.bird.y + game.bird.radius;

  if (birdTop <= 0 || birdBottom >= screenHeight) {
    setGameOver();
  }

  for (const pipe of game.pipes) {
    const withinX = game.bird.x + game.bird.radius > pipe.x &&
      game.bird.x - game.bird.radius < pipe.x + game.pipeWidth;
    const gapTop = pipe.topHeight;
    const gapBottom = pipe.topHeight + game.pipeGap;
    if (withinX && (birdTop < gapTop || birdBottom > gapBottom)) {
      setGameOver();
      break;
    }
  }
};

const drawBackground = () => {
  ctx.fillStyle = '#88d8ff';
  ctx.fillRect(0, 0, screenWidth, screenHeight);
  ctx.fillStyle = '#6ac36a';
  ctx.fillRect(0, screenHeight - 80, screenWidth, 80);
};

const drawBird = () => {
  ctx.fillStyle = '#ffd200';
  ctx.beginPath();
  ctx.arc(game.bird.x, game.bird.y, game.bird.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.arc(game.bird.x + 6, game.bird.y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
};

const drawPipes = () => {
  ctx.fillStyle = '#4caf50';
  game.pipes.forEach((pipe) => {
    ctx.fillRect(pipe.x, 0, game.pipeWidth, pipe.topHeight);
    ctx.fillRect(
      pipe.x,
      pipe.topHeight + game.pipeGap,
      game.pipeWidth,
      screenHeight - pipe.topHeight - game.pipeGap - 80,
    );
  });
};

const drawScore = () => {
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px sans-serif';
  ctx.fillText(`得分: ${game.score}`, 16, 36);
  ctx.font = '16px sans-serif';
  ctx.fillText(`最高: ${game.best}`, 16, 60);
};

const drawHint = () => {
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  if (game.state === STATE.READY) {
    ctx.fillText('点按开始，帮助小鸟飞行！', screenWidth / 2, screenHeight / 2);
  }
  if (game.state === STATE.GAME_OVER) {
    ctx.fillText('游戏结束，点按重试', screenWidth / 2, screenHeight / 2);
  }
  ctx.textAlign = 'left';
};

const drawRankingButton = () => {
  if (game.state !== STATE.READY) {
    return;
  }
  const buttonRect = getRankingButtonRect();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(buttonRect.x, buttonRect.y, buttonRect.width, buttonRect.height);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(buttonRect.x, buttonRect.y, buttonRect.width, buttonRect.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('查看排行', buttonRect.x + buttonRect.width / 2, buttonRect.y + 28);
  ctx.textAlign = 'left';
};

const drawLevelSelector = () => {
  if (game.state !== STATE.READY) {
    return;
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('选择难度', screenWidth / 2, screenHeight / 2 + 110);

  const levelRects = getLevelButtonRects();
  levelRects.forEach((rect) => {
    const isActive = rect.index === game.levelIndex;
    ctx.fillStyle = isActive ? '#ffd200' : 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = isActive ? '#2a2a2a' : '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText(rect.level.name, rect.x + rect.width / 2, rect.y + 26);
  });
  ctx.textAlign = 'left';
};

const drawRanking = () => {
  if (!game.showRanking || !sharedCanvas) {
    return;
  }
  const panelWidth = Math.min(300, screenWidth - 40);
  const panelHeight = Math.min(320, screenHeight - 200);
  const panelX = (screenWidth - panelWidth) / 2;
  const panelY = screenHeight / 2 + 40;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('好友排行榜', screenWidth / 2, panelY + 28);
  ctx.textAlign = 'left';

  const rankPadding = 12;
  const rankX = panelX + rankPadding;
  const rankY = panelY + 40;
  const rankWidth = panelWidth - rankPadding * 2;
  const rankHeight = panelHeight - 50;
  ctx.drawImage(sharedCanvas, rankX, rankY, rankWidth, rankHeight);
};

const render = () => {
  drawBackground();
  drawPipes();
  drawBird();
  drawScore();
  drawHint();
  drawRankingButton();
  drawLevelSelector();
  drawRanking();
};

const loop = (timestamp) => {
  if (!game.lastTime) {
    game.lastTime = timestamp;
  }
  const delta = (timestamp - game.lastTime) / 1000;
  game.lastTime = timestamp;

  update(delta);
  render();

  requestAnimationFrame(loop);
};

resetGame();
syncOpenDataSize();
requestAnimationFrame(loop);
