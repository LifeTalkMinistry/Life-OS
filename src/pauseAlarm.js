let audioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

export function primePauseAlarm() {
  try {
    const context = getAudioContext();
    if (!context) return false;
    if (context.state === 'suspended') context.resume().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function scheduleTone(context, startAt, frequency, duration, gainValue = 0.085) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
}

export function playPauseAlarm() {
  try {
    const context = getAudioContext();
    if (!context) return false;

    const ring = () => {
      const now = context.currentTime + 0.03;
      [0, 0.62, 1.24].forEach((offset) => {
        scheduleTone(context, now + offset, 659.25, 0.24, 0.09);
        scheduleTone(context, now + offset + 0.2, 880, 0.3, 0.075);
      });
    };

    if (context.state === 'suspended') {
      context.resume().then(ring).catch(() => {});
    } else {
      ring();
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([180, 100, 180, 100, 260]);
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('PAUSE timer done', {
          body: 'Your timer is finished. Your rest is still running until you end it.'
        });
      } catch {}
    }

    return true;
  } catch {
    return false;
  }
}
