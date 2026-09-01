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

function briefingMinutesToTime(value) {
  const normalized = ((Number(value) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function briefingValidTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function briefingClampMinutes(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function briefingLegacySleepStart(rawPlan = {}) {
  return briefingMinutesToTime(
    briefingTimeToMinutes(rawPlan.shiftEnd || '08:00', 8 * 60)
      + briefingClampMinutes(rawPlan.commuteMinutes, 60, 0, 240)
      + briefingClampMinutes(rawPlan.windDownMinutes, 45, 0, 240)
  );
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
    recoveryMinutes: briefingClampMinutes(rawPlan.recoveryMinutes, 480, 240, 720),
    sleepStart: briefingValidTime(rawPlan.sleepStart)
      ? String(rawPlan.sleepStart)
      : briefingLegacySleepStart(rawPlan)
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
  const sleepStartMinutes = briefingTimeToMinutes(plan.sleepStart, 9 * 60 + 45);
  const shiftStartAt = new Date(dayStart.getTime() + startMinutes * 60_000);
  const shiftEndAt = new Date(dayStart.getTime() + (endMinutes + (endMinutes <= startMinutes ? 1440 : 0)) * 60_000);
  const commuteEndAt = new Date(shiftEndAt.getTime() + plan.commuteMinutes * 60_000);
  const sleepAfterShiftMinutes = ((sleepStartMinutes - endMinutes) + 1440) % 1440;
  const recoveryStartAt = new Date(shiftEndAt.getTime() + sleepAfterShiftMinutes * 60_000);
  const windDownStartAt = new Date(recoveryStartAt.getTime() - plan.windDownMinutes * 60_000);
  const wakeTargetAt = new Date(recoveryStartAt.getTime() + plan.recoveryMinutes * 60_000);
  return {
    key: `${briefingDateKey(dayStart)}:${plan.shiftStart}`,
    shiftStartAt,
    shiftEndAt,
    commuteEndAt,
    windDownStartAt,
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
  if (nowMs < cycle.windDownStartAt.getTime()) return 'personal';
  if (plan.windDownMinutes > 0 && nowMs < cycle.recoveryStartAt.getTime()) return 'winddown';
  if (nowMs < cycle.recoveryStartAt.getTime()) return 'personal';
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

function briefingNextAgenda(plan, cycle, phase) {
  if (phase === 'work') {
    if (plan.commuteMinutes > 0) return { label: 'Commute', at: cycle.shiftEndAt };
    if (cycle.windDownStartAt.getTime() > cycle.shiftEndAt.getTime()) return { label: 'Your Time', at: cycle.shiftEndAt };
    if (plan.windDownMinutes > 0) return { label: 'Wind-down', at: cycle.shiftEndAt };
    return { label: 'Sleep Routine', at: cycle.recoveryStartAt };
  }
  if (phase === 'commute') {
    if (cycle.windDownStartAt.getTime() > cycle.commuteEndAt.getTime()) return { label: 'Your Time', at: cycle.commuteEndAt };
    if (plan.windDownMinutes > 0) return { label: 'Wind-down', at: cycle.commuteEndAt };
    return { label: 'Sleep Routine', at: cycle.recoveryStartAt };
  }
  if (phase === 'personal') {
    if (plan.windDownMinutes > 0) return { label: 'Wind-down', at: cycle.windDownStartAt };
    return { label: 'Sleep Routine', at: cycle.recoveryStartAt };
  }
  if (phase === 'winddown') return { label: 'Sleep Routine', at: cycle.recoveryStartAt };
  return { label: 'Wake', at: cycle.wakeTargetAt };
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
    const next = briefingNextAgenda(plan, cycle, phase);
    const phaseEndAt = phase === 'work'
      ? cycle.shiftEndAt
      : phase === 'commute'
        ? cycle.commuteEndAt
        : phase === 'personal'
          ? (plan.windDownMinutes > 0 ? cycle.windDownStartAt : cycle.recoveryStartAt)
          : phase === 'winddown'
            ? cycle.recoveryStartAt
            : cycle.wakeTargetAt;

    return {
      phase,
      phaseKey: `${cycle.key}:${phase}`,
      agenda: phase === 'work'
        ? 'WORK'
        : phase === 'commute'
          ? 'COMMUTE'
          : phase === 'personal'
            ? 'YOUR TIME'
            : phase === 'winddown'
              ? 'WIND-DOWN'
              : 'SLEEP ROUTINE',
      value: briefingFormatRemaining(phaseEndAt.getTime() - nowMs),
      suffix: 'left',
      next: `Next · ${next.label} — ${briefingFormatClock(next.at)}`,
      targetAt: phaseEndAt.getTime()
    };
  }

  const nextCycle = cycles.find((cycle) => cycle.recoveryStartAt.getTime() > nowMs);
  if (!nextCycle) return null;
  return {
    phase: 'next',
    phaseKey: `${nextCycle.key}:next`,
    agenda: 'NEXT SLEEP ROUTINE',
    value: briefingFormatRemaining(nextCycle.recoveryStartAt.getTime() - nowMs),
    suffix: 'away',
    next: `Starts · ${briefingFormatFutureClock(nextCycle.recoveryStartAt, now)}`,
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
      background: linear-gradient(180deg, rgba(5, 4, 10, .995), rgba(2, 2, 6, .995));
      animation: recoveryBriefingIn .2s ease-out both;
    }

    .recovery-briefing-content {
      width: min(100%, 360px);
      display: grid;
      justify-items: center;
      text-align: center;
    }

    .recovery-briefing-agenda {
      margin: 0;
      color: #b99adc;
      font-size: .72rem;
      font-weight: 760;
      letter-spacing: .18em;
    }

    .recovery-briefing-time-row {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 8px;
      margin-top: 24px;
    }

    .recovery-briefing-value {
      color: #f5eff9;
      font-size: clamp(3rem, 15vw, 4.4rem);
      font-weight: 300;
      font-variant-numeric: tabular-nums;
      letter-spacing: -.05em;
      line-height: .98;
    }

    .recovery-briefing-suffix {
      color: #84798c;
      font-size: .74rem;
      font-weight: 560;
    }

    .recovery-briefing-next {
      margin: 24px 0 0;
      color: #91879b;
      font-size: .78rem;
      line-height: 1.45;
    }

    .recovery-briefing-continue {
      appearance: none;
      margin-top: 42px;
      padding: 10px 18px;
      border: 0;
      background: transparent;
      color: #a99bb5;
      font-size: .72rem;
      font-weight: 620;
      cursor: pointer;
    }

    .recovery-briefing-continue:is(:hover, :focus-visible) {
      color: #eee6f4;
      outline: none;
    }

    .recovery-briefing-overlay.is-leaving {
      animation: recoveryBriefingOut .16s ease-in both;
    }

    @keyframes recoveryBriefingIn {
      from { opacity: 0; }
      to { opacity: 1; }
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
  setTimeout(() => closing.remove(), 160);
}

function showRecoveryBriefing(status, accountId) {
  if (!status || recoveryBriefingOverlay) return;
  ensureRecoveryBriefingStyles();
  const overlay = document.createElement('div');
  overlay.className = 'recovery-briefing-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'PAUSE routine agenda');
  overlay.innerHTML = `
    <section class="recovery-briefing-content">
      <p class="recovery-briefing-agenda">${status.agenda}</p>
      <div class="recovery-briefing-time-row">
        <span class="recovery-briefing-value">${status.value}</span>
        <span class="recovery-briefing-suffix">${status.suffix}</span>
      </div>
      <p class="recovery-briefing-next">${status.next}</p>
      <button type="button" class="recovery-briefing-continue" data-recovery-briefing-close>Continue</button>
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
