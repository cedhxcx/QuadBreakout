(function () {
  const C = window.QB.C;
  let backgroundCache = null;
  let backgroundPlayerCount = null;

  function drawBackground(ctx, arena) {
    const gradient = ctx.createRadialGradient(C.WIDTH / 2, C.HEIGHT / 2, 60, C.WIDTH / 2, C.HEIGHT / 2, 560);
    gradient.addColorStop(0, '#111d31');
    gradient.addColorStop(1, '#080d17');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);

    ctx.save();
    ctx.strokeStyle = 'rgba(125, 157, 202, 0.045)';
    ctx.lineWidth = 1;
    for (let x = 20; x < C.WIDTH; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, C.HEIGHT); ctx.stroke();
    }
    for (let y = 20; y < C.HEIGHT; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(C.WIDTH, y); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(arena.vertices[0].x, arena.vertices[0].y);
    arena.vertices.slice(1).forEach(vertex => ctx.lineTo(vertex.x, vertex.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(17, 29, 49, .42)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(97, 245, 202, .52)';
    ctx.shadowColor = 'rgba(97, 245, 202, .35)';
    ctx.shadowBlur = 17;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(186, 208, 244, .14)';
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.arc(C.WIDTH / 2, C.HEIGHT / 2, 224, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    arena.walls.forEach(wall => {
      ctx.strokeStyle = 'rgba(186, 208, 244, .38)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wall.start.x, wall.start.y);
      ctx.lineTo(wall.end.x, wall.end.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawCachedBackground(ctx, playerCount, arena) {
    if (!backgroundCache || backgroundPlayerCount !== playerCount) {
      backgroundCache = document.createElement('canvas');
      backgroundCache.width = C.WIDTH;
      backgroundCache.height = C.HEIGHT;
      drawBackground(backgroundCache.getContext('2d'), arena);
      backgroundPlayerCount = playerCount;
    }
    ctx.drawImage(backgroundCache, 0, 0);
  }

  function drawGoals(ctx, players, arena) {
    players.forEach(player => {
      const side = arena.sides[player.index];
      ctx.save();
      ctx.globalAlpha = 0.23;
      ctx.strokeStyle = player.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(side.start.x, side.start.y);
      ctx.lineTo(side.end.x, side.end.y);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawBricks(ctx, bricks) {
    bricks.forEach(brick => {
      ctx.save();
      ctx.fillStyle = brick.special ? '#76549b' : '#52617d';
      ctx.strokeStyle = brick.special ? '#efd5ff' : '#b9c9e6';
      ctx.lineWidth = brick.special ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 5);
      ctx.fill();
      ctx.stroke();
      if (brick.special) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`×5 · ${brick.hitsRemaining}`, brick.x + brick.width / 2, brick.y + brick.height / 2 + 0.5);
      }
      ctx.restore();
    });
  }

  function drawPowerup(ctx, powerup, elapsedMs) {
    if (!powerup) return;
    const color = powerup.type === 'ice' ? C.POWERUP_ICE_COLOR : C.POWERUP_FIRE_COLOR;
    const radius = powerup.radius * (1 + Math.sin(elapsedMs / 140) * 0.08);
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(powerup.x, powerup.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;

    if (powerup.type === 'ice') {
      for (let spoke = 0; spoke < 3; spoke++) {
        const angle = spoke * Math.PI / 3;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(powerup.x - dx * 6, powerup.y - dy * 6);
        ctx.lineTo(powerup.x + dx * 6, powerup.y + dy * 6);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(powerup.x, powerup.y + 7);
      ctx.bezierCurveTo(powerup.x - 8, powerup.y + 1, powerup.x + 1, powerup.y - 2, powerup.x - 1, powerup.y - 8);
      ctx.bezierCurveTo(powerup.x + 8, powerup.y - 3, powerup.x + 8, powerup.y + 4, powerup.x, powerup.y + 7);
      ctx.fillStyle = '#fff3b0';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPaddles(ctx, players, playerCount, arena) {
    players.forEach(player => {
      const paddle = window.QB.Physics.paddleRect(player, playerCount);
      const effectColor = player.powerEffect === 'ice'
        ? C.POWERUP_ICE_COLOR
        : player.powerEffect === 'fire' ? C.POWERUP_FIRE_COLOR : null;
      ctx.save();
      ctx.translate(paddle.center.x, paddle.center.y);
      ctx.rotate(Math.atan2(paddle.tangent.y, paddle.tangent.x));
      ctx.shadowColor = effectColor || player.color;
      ctx.shadowBlur = effectColor ? 15 : 0;
      const gradient = ctx.createLinearGradient(-paddle.length / 2, 0, paddle.length / 2, 0);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.22, effectColor || player.color);
      gradient.addColorStop(1, player.powerEffect === 'ice' ? '#d9fbff' : player.powerEffect === 'fire' ? '#e72b18' : player.color);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(-paddle.length / 2, -paddle.thickness / 2, paddle.length, paddle.thickness, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      const side = arena.sides[player.index];
      ctx.save();
      ctx.fillStyle = player.color;
      ctx.globalAlpha = 0.9;
      ctx.font = '600 10px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(player.name.slice(0, 12), side.midpoint.x + side.outward.x * 17, side.midpoint.y + side.outward.y * 17);
      ctx.restore();
    });
  }

  function drawBalls(ctx, balls) {
    balls.forEach(ball => {
      const ballColor = ball.powerType === 'ice'
        ? C.POWERUP_ICE_COLOR
        : ball.powerType === 'fire' ? C.POWERUP_FIRE_COLOR : ball.ownerColor;
      ball.trail.forEach((point, index) => {
        const alpha = (1 - index / ball.trail.length) * 0.28;
        const radius = ball.radius * (1 - index / (ball.trail.length + 2)) * 0.78;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = ballColor;
        ctx.globalAlpha = alpha;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.shadowColor = ballColor;
      ctx.shadowBlur = ball.powerType ? 12 : 0;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = ballColor;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawParticles(ctx, particles) {
    particles.forEach(particle => {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function draw(ctx, state) {
    if (!state) return;
    const arena = window.QB.Physics.getArenaGeometry(state.playerCount);
    drawCachedBackground(ctx, state.playerCount, arena);
    drawGoals(ctx, state.players, arena);
    drawBricks(ctx, state.bricks || []);
    drawPowerup(ctx, state.powerup, state.elapsedMs || 0);
    drawPaddles(ctx, state.players, state.playerCount, arena);
    drawBalls(ctx, state.balls || []);
    drawParticles(ctx, state.particles || []);
  }

  function renderScoreboard(element, players) {
    if (!element) return;
    element.innerHTML = players.map(player => `
      <div class="score-card" style="border-color:${player.color}66">
        <span class="score-name" style="color:${player.color}">${escapeHtml(player.name)}</span>
        <span class="score-value">${Number(player.score) || 0}</span>
      </div>`).join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  window.QB.Renderer = Object.freeze({ draw, renderScoreboard });
})();
