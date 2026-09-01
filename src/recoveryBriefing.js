const RECOVERY_BRIEFING_POLL_MS = 500;
const RECOVERY_BRIEFING_LOOKAHEAD_DAYS = 8;
let recoveryBriefingOverlay = null;
let recoveryBriefingLastKey = null;
let recoveryBriefingResumePending = true;
let recoveryBriefingWasAway = false;

function briefingTimeToMinutes(value, fallback = 0) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return fallback;
  }
  return hour * 60 + minute;
}

function briefingClampMinutes(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function briefingPlan(rawPlan = {}) {
  const workDays = Array.isArray(rawPlan.workDays)
    ? [...new Set(rawPlan.workDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [];
  return {
    setupComplete: rawPlan.setupComplete === true,
    nudgeConsentComplete: rawPlan.nudgeConsentComplete === true,
    workDays,
    shiftStart: String(rawPlan.shiftStart || '22:00'),
    shiftEnd: String(rawPlan.shiftEnd || '08:00'),
    commuteMinutes: briefingClampMinutes(rawPlan.commuteMinutes, 60, 0, 240),
    windDownMinutes: briefingClampMinutes(rawPlan.windDownMinutes, 45, 0, 240),
    recoveryMinutes: briefingClampMinutes(rawPlan.recoveryMinutes, 480, 240, 720)
  };
}

function briefingDayStart(now, offsetDays = 0) {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
    0,
    0,
    0,
    0
  );
}

function briefingDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function briefingCycleForDay(plan, dayStart) {
  if (!plan.workDays.includes(dayStart.getDay())) return null;
  const startMinutes = briefingTimeToMinutes(plan.shiftStart, 22 * 60);
  const endMinutes = briefingTimeToMinutes(plan.shiftEnd, 8 * 60);
  const shiftStartAt = new Date(dayStart.getTime() + startMinutes * 60_000);
  const shiftEndAt = new Date(dayStart.getTime() + (endMinutes + (endMinutes <= startMinutes ? 1440 : 0)) * 60_000);
  const commuteEndAt = new Date(shiftEndAt.getTime() + plan.commuteMinutes * 60_000);
  const recoveryStartAt = new Date(commuteEndAt.getTime() + plan.windDownMinutes * 60_000);
  const wakeTargetAt = new Date(recoveryStartAt.getTime() + plan.recoveryMinutes * 60_000);
  return {
    key: `${briefingDateKey(dayStart)}:${plan.shiftStart}`,
    shiftStartAt,
    shiftEndAt,
    commuteEndAt,
    recoveryStartAt,
    wakeTargetAt
  };
}

function briefingCyclesAround(plan, now) {
  const cycles = [];
  for (let offset = -2; offset <= RECOVERY_BRIEFING_LOOKAHEAD_DAYS; offset += 1) {
    const cycle = briefingCycleForDay(plan, briefingDayStart(now, offset));
    if (cycle) cycles.push(cycle);
  }
  return cycles.sort((a, b) => a.shiftStartAt - b.shiftStartAt);
}

function briefingActivePhase(plan, cycle, nowMs) {
  if (nowMs < cycle.shiftStartAt.getTime() || nowMs >= cycle.wakeTargetAt.getTime()) return null;
  if (nowMs < cycle.shiftEndAt.getTime()) return 'work';
  if (plan.commuteMinutes > 0 && nowMs < cycle.commuteEndAt.getTime()) return 'commute';
  if (plan.windDownMinutes > 0 && nowMs < cycle.recoveryStartAt.getTime()) return 'winddown';
  if (nowMs < cycle.wakeTargetAt.getTime()) return 'recovery';
  return null;
}

function briefingFormatClock(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function briefingFormatFutureClock(date, now) {
  const targetDay = briefingDayStart(date).getTime();
  const today = briefingDayStart(now).getTime();
  const tomorrow = briefingDayStart(now, 1).getTime();
  if (targetDay === today) return briefingFormatClock(date);
  if (targetDay === tomorrow) return `Tomorrow · ${briefingFormatClock(date)}`;
  return `${new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)} · ${briefingFormatClock(date)}`;
}

function briefingFormatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.ceil(Number(ms || 0) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function deriveRecoveryBriefingStatus(rawPlan, nowValue = new Date()) {
  const plan = briefingPlan(rawPlan);
  const now = nowValue instanceof Date ? new Date(nowValue.getTime()) : new Date(nowValue);
  if (!plan.setupComplete || !plan.workDays.length || Number.isNaN(now.getTime())) return null;

  const nowMs = now.getTime();
  const cycles = briefingCyclesAround(plan, now);
  const activeCycles = cycles
    .map((cycle) => ({ cycle, phase: briefingActivePhase(plan, cycle, nowMs) }))
    .filter((entry) => entry.phase)
    .sort((a, b) => b.cycle.shiftStartAt - a.cycle.shiftStartAt);

  const active = activeCycles[0] || null;
  if (active) {
    const { cycle, phase } = active;
    if (phase === 'work') {
      return {
        phase,
        phaseKey: `${cycle.key}:work`,
        title: 'Your shift is in progress.',
        value: briefingFormatRemaining(cycle.recoveryStartAt.getTime() - nowMs),
        label: 'UNTIL PROTECTED RECOVERY',
        detail: `Shift ends at ${briefingFormatClock(cycle.shiftEndAt)}. Protected recovery is planned for ${briefingFormatClock(cycle.recoveryStartAt)}.`,
        targetAt: cycle.recoveryStartAt.getTime()
      };
    }

    if (phase === 'commute') {
      return {
        phase,
        phaseKey: `${cycle.key}:commute`,
        title: 'You’re in your commute window.',
        value: briefingFormatRemaining(cycle.commuteEndAt.getTime() - nowMs),
        label: 'LEFT IN COMMUTE WINDOW',
        detail: plan.windDownMinutes > 0
          ? `Wind-down starts around ${briefingFormatClock(cycle.commuteEndAt)}. Protected recovery at ${briefingFormatClock(cycle.recoveryStartAt)}.`
          : `Protected recovery is planned for ${briefingFormatClock(cycle.recoveryStartAt)}.`,
        targetAt: cycle.commuteEndAt.getTime()
      };
    }

    if (phase === 'winddown') {
      return {
        phase,
        phaseKey: `${cycle.key}:winddown`,
        title: 'You’re in wind-down now.',
        value: briefingFormatRemaining(cycle.recoveryStartAt.getTime() - nowMs),
        label: 'UNTIL PROTECTED RECOVERY',
        detail: `Protected recovery begins at ${briefingFormatClock(cycle.recoveryStartAt)}.`,
        targetAt: cycle.recoveryStartAt.getTime()
      };
    }

    return {
      phase: 'recovery',
      phaseKey: `${cycle.key}:recovery`,
      title: 'Protected recovery is active.',
      value: briefingFormatRemaining(cycle.wakeTargetAt.getTime() - nowMs),
      label: 'LEFT IN PROTECTED RECOVERY',
      detail: `Wake target: ${briefingFormatClock(cycle.wakeTargetAt)}.`,
      targetAt: cycle.wakeTargetAt.getTime()
    };
  }

  const nextCycle = cycles.find((cycle) => cycle.recoveryStartAt.getTime() > nowMs);
  if (!nextCycle) return null;
  return {
    phase: 'next',
    phaseKey: `${nextCycle.key}:next`,
    title: 'Your next recovery is planned.',
    value: briefingFormatFutureClock(nextCycle.recoveryStartAt, now),
    label: 'NEXT PROTECTED RECOVERY',
    detail: `Your next shift starts ${briefingFormatFutureClock(nextCycle.shiftStartAt, now)}.`,
    targetAt: nextCycle.recoveryStartAt.getTime()
  };
}

function ensureRecoveryBriefingStyles() {
  if (document.querySelector('#pause-recovery-briefing-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-recovery-briefing-style';
  style.textContent = `
    .recovery-briefing-overlay {
      position: fixed;
      inset: 0;
      z-index: 1280;
      display: grid;
      place-items: center;
      padding: max(28px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom));
      background:
        radial-gradient(circle at 50% 40%, rgba(105, 62, 172, .13), transparent 34%),
        linear-gradient(180deg, rgba(5, 4, 10, .995), rgba(2, 2, 6, .995));
      animation: recoveryBriefingIn .24s ease-out both;
    }

    .recovery-briefing-content {
      width: min(100%, 390px);
      display: grid;
      justify-items: center;
      text-align: center;
    }

    .recovery-briefing-mark {
      width: 54px;
      height: 54px;
      margin-bottom: 27px;
      border: 1px solid rgba(180, 137, 244, .24);
      border-radius: 50%;
      background: radial-gradient(circle, rgba(143, 92, 224, .25), rgba(73, 42, 121, .06) 62%, transparent 64%);
      box-shadow: 0 0 34px rgba(124, 73, 207, .12);
    }

    .recovery-briefing-eyebrow {
      margin: 0 0 12px;
      color: #8f819d;
      font-size: .58rem;
      font-weight: 760;
      letter-spacing: .18em;
    }

    .recovery-briefing-content h1 {
      max-width: 330px;
      margin: 0;
      color: #f1eaf6;
      font-size: clamp(1.55rem, 7vw, 2rem);
      font-weight: 430;
      line-height: 1.16;
      letter-spacing: -.025em;
    }

    .recovery-briefing-value {
      margin-top: 33px;
      color: #f5eff9;
      font-size: clamp(2.7rem, 14vw, 4rem);
      font-weight: 300;
      font-variant-numeric: tabular-nums;
      letter-spacing: -.045em;
      line-height: .98;
    }

    .recovery-briefing-label {
      margin-top: 9px;
      color: #b494d7;
      font-size: .58rem;
      font-weight: 760;
      letter-spacing: .16em;
    }

    .recovery-briefing-detail {
      max-width: 310px;
      margin: 23px 0 0;
      color: #8c8294;
      font-size: .72rem;
      line-height: 1.58;
    }

    .recovery-briefing-note {
      margin: 11px 0 0;
      color: #625b68;
      font-size: .58rem;
      line-height: 1.45;
    }

    .recovery-briefing-continue {
      appearance: none;
      width: min(100%, 290px);
      min-height: 49px;
      margin-top: 36px;
      border: 1px solid rgba(180, 138, 242, .25);
      border-radius: 14px;
      background: rgba(91, 54, 145, .13);
      color: #e8def1;
      font-size: .72rem;
      font-weight: 650;
      letter-spacing: .02em;
      cursor: pointer;
    }

    .recovery-briefing-continue:is(:hover, :focus-visible) {
      border-color: rgba(194, 153, 250, .46);
      background: rgba(111, 68, 177, .2);
      outline: none;
    }

    .recovery-briefing-overlay.is-leaving {
      animation: recoveryBriefingOut .18s ease-in both;
    }

    @keyframes recoveryBriefingIn {
      from { opacity: 0; transform: scale(1.01); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes recoveryBriefingOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .recovery-briefing-overlay,
      .recovery-briefing-overlay.is-leaving { animation: none; }
    }
  `;
  document.head.appendChild(style);
}

function closeRecoveryBriefing() {
  if (!recoveryBriefingOverlay) return;
  const closing = recoveryBriefingOverlay;
  recoveryBriefingOverlay = null;
  closing.classList.add('is-leaving');
  setTimeout(() => closing.remove(), 180);
}

function showRecoveryBriefing(status, accountId) {
  if (!status || recoveryBriefingOverlay) return;
  ensureRecoveryBriefingStyles();
  const overlay = document.createElement('div');
  overlay.className = 'recovery-briefing-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'PAUSE recovery briefing');
  overlay.innerHTML = `
    <section class="recovery-briefing-content">
      <div class="recovery-briefing-mark" aria-hidden="true"></div>
      <p class="recovery-briefing-eyebrow">RECOVERY BRIEFING</p>
      <h1>${status.title}</h1>
      <div class="recovery-briefing-value">${status.value}</div>
      <div class="recovery-briefing-label">${status.label}</div>
      <p class="recovery-briefing-detail">${status.detail}</p>
      <p class="recovery-briefing-note">Based on your Recovery Plan, not live location tracking.</p>
      <button type="button" class="recovery-briefing-continue" data-recovery-briefing-close>Continue to PAUSE</button>
    </section>
  `;
  recoveryBriefingLastKey = `${String(accountId)}:${status.phaseKey}`;
  recoveryBriefingResumePending = false;
  overlay.querySelector('[data-recovery-briefing-close]')?.addEventListener('click', closeRecoveryBriefing);
  recoveryBriefingOverlay = overlay;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-recovery-briefing-close]')?.focus({ preventScroll: true });
}

function reconcileRecoveryBriefing() {
  const pause = window.__PAUSE__?.getState?.();
  if (!pause || pause.authStatus !== 'authenticated' || pause.screen !== 'main' || !pause.user?.id) {
    closeRecoveryBriefing();
    return;
  }
  if (!recoveryBriefingResumePending || recoveryBriefingOverlay) return;

  const plan = window.__PAUSE_RECOVERY_PLAN__?.getPlan?.();
  if (!plan || plan.setupComplete !== true || plan.nudgeConsentComplete !== true) return;

  const status = deriveRecoveryBriefingStatus(plan, new Date());
  if (!status) {
    recoveryBriefingResumePending = false;
    return;
  }

  const key = `${String(pause.user.id)}:${status.phaseKey}`;
  if (key === recoveryBriefingLastKey) {
    recoveryBriefingResumePending = false;
    return;
  }
  showRecoveryBriefing(status, pause.user.id);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const recoveryBriefingInterval = setInterval(reconcileRecoveryBriefing, RECOVERY_BRIEFING_POLL_MS);
  recoveryBriefingInterval.unref?.();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      recoveryBriefingWasAway = true;
      return;
    }
    if (recoveryBriefingWasAway) recoveryBriefingResumePending = true;
    recoveryBriefingWasAway = false;
    reconcileRecoveryBriefing();
  });

  window.addEventListener('blur', () => {
    recoveryBriefingWasAway = true;
  });
  window.addEventListener('focus', () => {
    if (recoveryBriefingWasAway) recoveryBriefingResumePending = true;
    recoveryBriefingWasAway = false;
    reconcileRecoveryBriefing();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && recoveryBriefingOverlay) closeRecoveryBriefing();
  });

  reconcileRecoveryBriefing();
}