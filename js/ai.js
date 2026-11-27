(function () {
  const C = window.QB.C;

  function getMove(state, player) {
    if (!state.balls.length) return 0;
    const side = window.QB.Physics.getSideGeometry(state.playerCount, player.index);
    const paddleLength = Math.min(C.PADDLE_LENGTH, side.length * 0.42);
    const travel = Math.max(1, side.length - paddleLength);
    let best = null;

    state.balls.forEach(ball => {
      const distance = (side.midpoint.x - ball.x) * side.outward.x + (side.midpoint.y - ball.y) * side.outward.y;
      const speedOutward = ball.vx * side.outward.x + ball.vy * side.outward.y;
      let targetX = ball.x;
      let targetY = ball.y;
      let priority = 1000 + Math.abs(distance);
      if (speedOutward > 0) {
        const time = Math.max(0, distance / speedOutward);
        targetX += ball.vx * time;
        targetY += ball.vy * time;
        priority = time;
      }
      const alongSide = (targetX - side.midpoint.x) * side.tangent.x + (targetY - side.midpoint.y) * side.tangent.y;
      const targetPosition = Math.max(0, Math.min(1, 0.5 + alongSide / travel));
      if (!best || priority < best.priority) best = { priority, targetPosition };
    });

    const delta = best.targetPosition - player.position;
    return Math.abs(delta) < 0.012 ? 0 : Math.sign(delta);
  }

  window.QB.AI = Object.freeze({ getMove });
})();
