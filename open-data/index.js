let canvas;
let ctx;
let viewWidth = 0;
let viewHeight = 0;
let devicePixelRatio = 1;
let ranking = [];
const avatarCache = new Map();

const ensureCanvas = () => {
  if (!canvas) {
    canvas = wx.getSharedCanvas();
    ctx = canvas.getContext('2d');
  }
};

const resize = (width, height, pixelRatio) => {
  ensureCanvas();
  devicePixelRatio = pixelRatio || 1;
  viewWidth = width;
  viewHeight = height;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(devicePixelRatio, devicePixelRatio);
};

const parseScore = (item) => {
  if (!item || !item.KVDataList) {
    return 0;
  }
  const kv = item.KVDataList.find((entry) => entry.key === 'bestScore');
  if (!kv) {
    return 0;
  }
  const value = Number(kv.value);
  return Number.isNaN(value) ? 0 : value;
};

const buildRanking = (data) => {
  ranking = data.map((item) => ({
    avatarUrl: item.avatarUrl,
    nickname: item.nickname,
    score: parseScore(item),
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
};

const loadAvatar = (url) => {
  if (!url || avatarCache.has(url)) {
    return;
  }
  const image = wx.createImage();
  image.onload = () => {
    avatarCache.set(url, image);
    drawRanking();
  };
  image.onerror = () => {
    avatarCache.set(url, null);
  };
  image.src = url;
};

const drawAvatar = (url, x, y, size) => {
  if (!url) {
    return;
  }
  const image = avatarCache.get(url);
  if (image) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, x, y, size, size);
    ctx.restore();
  } else if (!avatarCache.has(url)) {
    loadAvatar(url);
  }
};

const drawRanking = () => {
  ensureCanvas();
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText('好友排行', 12, 24);

  const startY = 40;
  const rowHeight = 32;
  const avatarSize = 22;
  const nameX = 12 + avatarSize + 10;

  ranking.forEach((item, index) => {
    const y = startY + index * rowHeight;
    drawAvatar(item.avatarUrl, 12, y + 4, avatarSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${index + 1}. ${item.nickname}`, nameX, y + 18);
    ctx.fillStyle = '#ffd200';
    ctx.fillText(`${item.score}`, viewWidth - 60, y + 18);
  });
};

const fetchRanking = () => {
  wx.getFriendCloudStorage({
    keyList: ['bestScore'],
    success: (res) => {
      buildRanking(res.data || []);
      ranking.forEach((item) => loadAvatar(item.avatarUrl));
      drawRanking();
    },
    fail: () => {
      ranking = [];
      drawRanking();
    },
  });
};

wx.onMessage((message) => {
  if (message.type === 'init') {
    resize(message.width, message.height, message.pixelRatio);
    drawRanking();
  }
  if (message.type === 'fetch') {
    fetchRanking();
  }
});
