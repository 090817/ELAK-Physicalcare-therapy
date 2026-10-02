function mountShapeGrid(container, options = {}) {
  const direction = options.direction || 'diagonal';
  const speed = options.speed ?? 0.5;
  const borderColor = options.borderColor || '#fff';
  const squareSize = options.squareSize || 40;
  const hoverFillColor = options.hoverFillColor || '#222';
  const hoverTrailAmount = options.hoverTrailAmount || 0;

  const canvas = document.createElement('canvas');
  canvas.className = 'shapegrid-canvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const gridOffset = { x: 0, y: 0 };
  let hovered = null;
  const trail = [];
  const cellOpacities = new Map();
  let width = 1;
  let height = 1;
  let raf = 0;
  let alive = true;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const drawGrid = () => {
    ctx.clearRect(0, 0, width, height);
    const offsetX = ((gridOffset.x % squareSize) + squareSize) % squareSize;
    const offsetY = ((gridOffset.y % squareSize) + squareSize) % squareSize;
    const cols = Math.ceil(width / squareSize) + 3;
    const rows = Math.ceil(height / squareSize) + 3;

    for (let col = -2; col < cols; col++) {
      for (let row = -2; row < rows; row++) {
        const sx = col * squareSize + offsetX;
        const sy = row * squareSize + offsetY;
        const alpha = cellOpacities.get(`${col},${row}`);
        if (alpha) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = hoverFillColor;
          ctx.fillRect(sx, sy, squareSize, squareSize);
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, squareSize, squareSize);
      }
    }
  };

  const updateCellOpacities = () => {
    const targets = new Map();
    if (hovered) targets.set(`${hovered.x},${hovered.y}`, 1);
    if (hoverTrailAmount > 0) {
      for (let i = 0; i < trail.length; i++) {
        const cell = trail[i];
        const key = `${cell.x},${cell.y}`;
        if (!targets.has(key)) targets.set(key, (trail.length - i) / (trail.length + 1));
      }
    }
    for (const key of targets.keys()) {
      if (!cellOpacities.has(key)) cellOpacities.set(key, 0);
    }
    for (const [key, opacity] of cellOpacities) {
      const next = opacity + ((targets.get(key) || 0) - opacity) * 0.15;
      if (next < 0.005) cellOpacities.delete(key);
      else cellOpacities.set(key, next);
    }
  };

  const step = () => {
    raf = 0;
    if (!alive) return;
    const pace = Math.max(speed, 0);
    if (pace > 0 && (direction === 'right' || direction === 'diagonal')) {
      gridOffset.x = (gridOffset.x - pace + squareSize) % squareSize;
    } else if (pace > 0 && direction === 'left') {
      gridOffset.x = (gridOffset.x + pace + squareSize) % squareSize;
    }
    if (pace > 0 && (direction === 'down' || direction === 'diagonal')) {
      gridOffset.y = (gridOffset.y - pace + squareSize) % squareSize;
    } else if (pace > 0 && direction === 'up') {
      gridOffset.y = (gridOffset.y + pace + squareSize) % squareSize;
    }
    updateCellOpacities();
    drawGrid();
    raf = requestAnimationFrame(step);
  };

  const remember = cell => {
    if (!cell || hoverTrailAmount <= 0) return;
    trail.unshift({ x: cell.x, y: cell.y });
    if (trail.length > hoverTrailAmount) trail.length = hoverTrailAmount;
  };

  const onPointerMove = event => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    if (mouseX < 0 || mouseY < 0 || mouseX > rect.width || mouseY > rect.height) {
      if (hovered) {
        remember(hovered);
        hovered = null;
      }
      return;
    }
    const offsetX = ((gridOffset.x % squareSize) + squareSize) % squareSize;
    const offsetY = ((gridOffset.y % squareSize) + squareSize) % squareSize;
    const col = Math.floor((mouseX - offsetX) / squareSize);
    const row = Math.floor((mouseY - offsetY) / squareSize);
    if (!hovered || hovered.x !== col || hovered.y !== row) {
      remember(hovered);
      hovered = { x: col, y: row };
    }
  };

  const onPointerLeave = () => {
    if (hovered) {
      remember(hovered);
      hovered = null;
    }
  };

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerout', event => {
    if (!event.relatedTarget) onPointerLeave();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !raf) raf = requestAnimationFrame(step);
  });
  raf = requestAnimationFrame(step);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  };
}

const root = document.getElementById('shape-grid');
if (root) {
  mountShapeGrid(root, {
    speed: 0,
    squareSize: 40,
    direction: 'diagonal',
    borderColor: 'rgba(111, 88, 64, 0.28)',
    hoverFillColor: '#e7d7b8',
    shape: 'square',
    hoverTrailAmount: 5
  });
}
