(function () {
  const C = window.QB.C;
  const plans = new WeakMap();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function chooseImpactOffset(random) {
    const style = random();
    if (style < 0.18) return (random() - 0.5) * 0.36;
    const direction = random() < 0.5 ? -1 : 1;
    const strength = style < 0.72 ? 0.62 + random() * 0.3 : 0.28 + random() * 0.45;
    return direction * strength;
  }

  function makePlan(state, candidate, random) {
    const now = Number(state.elapsedMs) || 0;
    if (!candidate) {
      return {
        ballId: null,
        impactOffset: 0,
        patrolPosition: 0.2 + random() * 0.6,
        expiresAt: now + 1600 + random() * 2400
      };
    }

    return {
      ballId: candidate.ball.id,
      impactOffset: chooseImpactOffset(random),
      patrolPosition: 0.5,
      expiresAt: now + Math.max(900, candidate.time * (1000 / 60) + 700 + random() * 1600)
    };
  }

  function getMove(state, player, random) {
    if (!state.balls.length) return 0;
    const rand = random || Math.random;
    const side = window.QB.Physics.getSideGeometry(state.playerCount, player.index);
    const paddleLength = Math.min(C.PADDLE_LENGTH, side.length * 0.42);
    const travel = Math.max(1, side.length - paddleLength);
    const candidates = [];

    state.balls.forEach(ball => {
      const distance = (side.midpoint.x - ball.x) * side.outward.x + (side.midpoint.y - ball.y) * side.outward.y;
      const speedOutward = ball.vx * side.outward.x + ball.vy * side.outward.y;
      if (speedOutward <= 0 || distance < -ball.radius) return;
      const time = Math.max(0, distance / speedOutward);
      const targetX = ball.x + ball.vx * time;
      const targetY = ball.y + ball.vy * time;
      const alongSide = (targetX - side.midpoint.x) * side.tangent.x + (targetY - side.midpoint.y) * side.tangent.y;
      candidates.push({ ball, time, alongSide });
    });

    candidates.sort((a, b) => a.time - b.time);
    const best = candidates[0] || null;
    const now = Number(state.elapsedMs) || 0;
    let plan = plans.get(player);
    let focused = plan && plan.ballId !== null
      ? candidates.find(candidate => candidate.ball.id === plan.ballId)
      : null;

    if (plan && plan.ballId !== null && !focused) plan = null;
    const betterThreat = best && focused && best.ball.id !== focused.ball.id && best.time < focused.time * 0.55;
    if (!plan || now >= plan.expiresAt || (best && plan.ballId === null) || betterThreat) {
      plan = makePlan(state, best, rand);
      plans.set(player, plan);
      focused = best;
    }

    if (plan.ballId === null) {
      const delta = plan.patrolPosition - player.position;
      return Math.abs(delta) < 0.012 ? 0 : Math.sign(delta);
    }

    focused = focused || candidates.find(candidate => candidate.ball.id === plan.ballId);
    if (!focused) return 0;
    const contactOffset = plan.impactOffset * paddleLength / 2;
    const targetCenter = focused.alongSide - contactOffset;
    const targetPosition = clamp(0.5 + targetCenter / travel, 0, 1);
    const delta = targetPosition - player.position;
    return Math.abs(delta) < 0.012 ? 0 : Math.sign(delta);
  }

  window.QB.AI = Object.freeze({ getMove });
})();
