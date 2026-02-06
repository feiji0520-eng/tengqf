const systemInfo = wx.getSystemInfoSync();
const screenWidth = systemInfo.screenWidth;
const screenHeight = systemInfo.screenHeight;
const pixelRatio = systemInfo.pixelRatio || 1;

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

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
  bird: {
    x: screenWidth * 0.25,
    y: screenHeight * 0.5,
    radius: 16,
    velocity: 0,
  },
  pipes: [],
  pipeGap: 160,
  pipeWidth: 54,
  pipeSpeed: 180,
  gravity: 720,
  flapStrength: -260,
  spawnInterval: 1400,
  spawnTimer: 0,
};

const resetGame = () => {
  game.state = STATE.READY;
  game.score = 0;
  game.spawnTimer = 0;
  game.pipes = [];
  game.bird.y = screenHeight * 0.5;
  game.bird.velocity = 0;
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

wx.onTouchStart(() => {
  flap();
});

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
    game.state = STATE.GAME_OVER;
  }

  for (const pipe of game.pipes) {
    const withinX = game.bird.x + game.bird.radius > pipe.x &&
      game.bird.x - game.bird.radius < pipe.x + game.pipeWidth;
    const gapTop = pipe.topHeight;
    const gapBottom = pipe.topHeight + game.pipeGap;
    if (withinX && (birdTop < gapTop || birdBottom > gapBottom)) {
      game.state = STATE.GAME_OVER;
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

const render = () => {
  drawBackground();
  drawPipes();
  drawBird();
  drawScore();
  drawHint();
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
requestAnimationFrame(loop);
