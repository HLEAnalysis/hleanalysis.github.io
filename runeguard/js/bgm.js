/* RUNEGUARD — BGM (Web Audio 실시간 생성)
   Duelyst OST 의 분위기(몽환적 패드 + 성긴 벨 멜로디 + 전투 타악)를 참고한
   오리지널 프로시저럴 곡. 음원 파일 없음 — 오실레이터로 그 자리에서 연주한다.

   구성
     · 코드 진행: Dm - Bb - F - C (에올리안 i-VI-III-VII), 마디당 1코드, 72bpm
     · 패드: 코드톤마다 디튠된 삼각파 2겹, 느린 어택 → 몽환적 바닥
     · 베이스: 근음 서브 사인
     · 벨: D 마이너 펜타토닉 랜덤워크, 확률적으로 성기게 — 멜로디 층
     · 전투 모드: 저음 북(피치 드랍) + 비트 틱 추가, 벨 밀도 상승
   모드는 크로스페이드 없이 다음 마디부터 자연 전환된다. */
(function (global) {
  'use strict';

  var RG = global.RG = global.RG || {};

  var ctx = null, master = null, padBus = null, noiseBuf = null;
  var enabled = false;   /* 기본 꺼짐 — ♫ 버튼으로 켠다 */
  var mood = 'menu';               /* 'menu' | 'battle' */
  var timer = null;

  var STORE_KEY = 'runeguard.bgm.v2';   /* 키 교체: 예전 저장값(켜짐) 무시 */
  var VOLUME = 0.16;

  var BPM = 72;
  var BEAT = 60 / BPM;             /* 0.833s */
  var BAR = BEAT * 4;
  var LOOKAHEAD = 0.65;            /* 초 단위 스케줄 선행 */
  var TICK_MS = 180;

  /* 코드 진행 (midi) — Dm, Bb, F, C */
  var PROG = [
    [50, 57, 62, 65],
    [46, 53, 58, 62],
    [45, 53, 57, 60],
    [48, 55, 60, 64]
  ];
  /* 멜로디 음계 — D 마이너 펜타토닉 */
  var SCALE = [62, 65, 67, 69, 72, 74, 77, 79];

  var MOODS = {
    menu:   { bellProb: 0.20, bellGain: 0.09, drums: false, padGain: 0.055 },
    battle: { bellProb: 0.30, bellGain: 0.10, drums: true,  padGain: 0.065 }
  };

  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  /* ═════════ 초기화 ═════════ */
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = VOLUME;

    /* 패드 전용 로우패스 — 뭉근하게 */
    padBus = ctx.createGain();
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.4;
    padBus.connect(lp); lp.connect(master);
    master.connect(ctx.destination);

    var len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  /* ═════════ 악기 ═════════ */
  function pad(midi, t, dur, gain) {
    [0, 1].forEach(function (k) {
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(midi);
      o.detune.value = k ? 7 : -7;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.35);
      g.gain.setValueAtTime(gain, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
      o.connect(g); g.connect(padBus);
      o.start(t); o.stop(t + dur + 0.45);
    });
  }

  function bass(midi, t, dur) {
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz(midi - 12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.1);
  }

  /* 벨 — 기음 + 옥타브 위 배음, 지수 감쇠 */
  function bell(midi, t, gain) {
    [[1, 1], [2, 0.35], [2.99, 0.12]].forEach(function (h) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz(midi) * h[0];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * h[1], t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 1.6);
    });
  }

  function drum(t) {              /* 저음 북 — 피치 드랍 */
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.22);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.35);
  }

  function tick(t) {              /* 비트 틱 — 짧은 노이즈 */
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 5200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + 0.08);
  }

  /* ═════════ 스케줄러 ═════════ */
  var nextStep = 0;          /* 8분음표 단위 전역 스텝 */
  var nextTime = 0;
  var melodyIdx = 3;

  function scheduleStep(step, t) {
    var cfg = MOODS[mood];
    var stepInBar = step % 8;

    if (stepInBar === 0) {
      var chord = PROG[(step / 8) % PROG.length | 0];
      chord.forEach(function (m) { pad(m, t, BAR, cfg.padGain); });
      bass(chord[0], t, BAR);
      if (cfg.drums) drum(t);
    }
    if (cfg.drums && stepInBar % 2 === 0) tick(t);

    /* 벨 멜로디 — 랜덤워크, 마디 첫 박은 쉼 (패드가 말할 시간) */
    if (stepInBar !== 0 && Math.random() < cfg.bellProb) {
      melodyIdx += [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
      melodyIdx = Math.max(0, Math.min(SCALE.length - 1, melodyIdx));
      bell(SCALE[melodyIdx], t, cfg.bellGain);
    }
  }

  function pump() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(nextStep, Math.max(nextTime, ctx.currentTime + 0.02));
      nextStep += 1;
      nextTime += BEAT / 2;
    }
  }

  /* ═════════ 공개 API ═════════ */
  function start() {
    if (!enabled || timer) return;
    if (!ensure()) return;
    nextStep = 0;
    nextTime = ctx.currentTime + 0.05;
    pump();
    timer = setInterval(pump, TICK_MS);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    /* 남은 예약 음은 자연 감쇠하도록 둔다 — 뚝 끊기지 않게 */
  }

  function setMood(m) {
    if (MOODS[m]) mood = m;
    if (enabled && !timer) start();
  }

  function setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem(STORE_KEY, enabled ? '1' : '0'); } catch (e) {}
    if (enabled) start(); else stop();
  }
  function toggle() { setEnabled(!enabled); return enabled; }
  function isEnabled() { return enabled; }

  try {
    var saved = localStorage.getItem(STORE_KEY);
    if (saved !== null) enabled = (saved === '1');
  } catch (e) {}

  /* 오디오는 사용자 제스처 이후에만 시작 가능 */
  if (global.document) {
    global.document.addEventListener('pointerdown', function once() {
      if (enabled) start();
      global.document.removeEventListener('pointerdown', once);
    }, { once: true });
  }

  RG.BGM = {
    start: start, stop: stop, setMood: setMood,
    setEnabled: setEnabled, toggle: toggle, isEnabled: isEnabled,
    _ctx: function () { return ctx; }, _mood: function () { return mood; }
  };
})(typeof window !== 'undefined' ? window : global);
