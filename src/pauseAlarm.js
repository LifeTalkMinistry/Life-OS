let audioContext = null;
let alarmAudio = null;
let alarmDataUrl = null;
let mediaPrimed = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function encodeBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function buildAlarmDataUrl() {
  if (alarmDataUrl) return alarmDataUrl;
  if (typeof btoa !== 'function') return null;

  const sampleRate = 12_000;
  const durationSeconds = 3.2;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const pcm = new Int16Array(sampleCount);
  const starts = [0.16, 0.72, 1.28, 1.84, 2.4];

  const envelope = (position, length) => {
    if (position < 0 || position > length) return 0;
    const attack = Math.min(1, position / 0.018);
    const release = Math.min(1, (length - position) / 0.07);
    return Math.max(0, Math.min(attack, release));
  };

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    let sample = 0;

    starts.forEach((start) => {
      const first = time - start;
      const second = time - (start + 0.23);
      if (first >= 0 && first <= 0.2) {
        sample += Math.sin(2 * Math.PI * 880 * first) * envelope(first, 0.2) * 0.46;
      }
      if (second >= 0 && second <= 0.24) {
        sample += Math.sin(2 * Math.PI * 659.25 * second) * envelope(second, 0.24) * 0.4;
      }
    });

    pcm[index] = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
  }

  const dataSize = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let byteOffset = 44;
  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(byteOffset, pcm[index], true);
    byteOffset += 2;
  }

  alarmDataUrl = `data:audio/wav;base64,${encodeBase64(new Uint8Array(buffer))}`;
  return alarmDataUrl;
}

function getAlarmAudio() {
  if (typeof Audio === 'undefined') return null;
  if (alarmAudio) return alarmAudio;
  const source = buildAlarmDataUrl();
  if (!source) return null;

  alarmAudio = new Audio(source);
  alarmAudio.preload = 'auto';
  alarmAudio.playsInline = true;
  alarmAudio.volume = 1;
  return alarmAudio;
}

function primeWebAudio() {
  try {
    const context = getAudioContext();
    if (!context) return false;

    const buffer = context.createBuffer(1, 1, context.sampleRate || 44_100);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.000001;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(0);

    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export function primePauseAlarm() {
  const webAudioReady = primeWebAudio();
  let mediaReady = false;

  try {
    const audio = getAlarmAudio();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.001;
      const playAttempt = audio.play();
      mediaReady = true;

      if (playAttempt && typeof playAttempt.then === 'function') {
        playAttempt
          .then(() => {
            mediaPrimed = true;
            setTimeout(() => {
              try {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 1;
              } catch {}
            }, 55);
          })
          .catch(() => {
            mediaPrimed = false;
            try { audio.volume = 1; } catch {}
          });
      } else {
        mediaPrimed = true;
        setTimeout(() => {
          try {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1;
          } catch {}
        }, 55);
      }
    }
  } catch {
    mediaReady = false;
  }

  return webAudioReady || mediaReady;
}

function scheduleTone(context, startAt, frequency, duration, gainValue = 0.16) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
}

function playWebAudioAlarm() {
  try {
    const context = getAudioContext();
    if (!context) return false;

    const ring = () => {
      const now = context.currentTime + 0.03;
      [0, 0.56, 1.12, 1.68, 2.24].forEach((offset) => {
        scheduleTone(context, now + offset, 880, 0.2, 0.17);
        scheduleTone(context, now + offset + 0.23, 659.25, 0.24, 0.15);
      });
    };

    if (context.state === 'suspended') {
      context.resume().then(ring).catch(() => {});
    } else {
      ring();
    }
    return true;
  } catch {
    return false;
  }
}

function playMediaAlarm() {
  try {
    const audio = getAlarmAudio();
    if (!audio) return false;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    const playAttempt = audio.play();

    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => playWebAudioAlarm());
    }
    return true;
  } catch {
    return false;
  }
}

export function playPauseAlarm() {
  const mediaStarted = playMediaAlarm();
  if (!mediaStarted) playWebAudioAlarm();

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([220, 90, 220, 90, 220, 90, 340]);
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification('PAUSE timer done', {
        body: 'Your timer is finished. Your rest is still running until you end it.'
      });
    } catch {}
  }

  return mediaStarted || mediaPrimed || Boolean(audioContext);
}
