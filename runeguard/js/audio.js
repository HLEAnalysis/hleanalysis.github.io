/* RUNEGUARD — 사운드 (Web Audio 합성)
   오디오 파일을 전혀 쓰지 않는다. 모든 효과음을 오실레이터/노이즈로 그 자리에서 만든다.
   → 정적 사이트 그대로 배포되고, 로딩도 네트워크 요청도 없다. */
(function (global) {
  'use strict';

  var RG = global.RG = global.RG || {};

  var ctx = null;
  var master = null;
  var punchBus = null;        /* 새추레이션 통과 — 타격 전용 */
  var enabled = true;
  var volume = 0.5;
  var noiseBuf = null;

  /* 재생마다 피치를 살짝 흔들어 반복감을 없앤다 */
  function vary() { return 0.88 + Math.random() * 0.24; }

  function distCurve(k) {
    var c = new Float32Array(256);
    for (var i = 0; i < 256; i++) {
      var x = (i / 128) - 1;
      c[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return c;
  }

  var STORE_KEY = 'runeguard.sound';

  /* ═══════════ 초기화 ═══════════ */
  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = volume;

    /* 겹쳐 울릴 때 찢어지지 않도록 가볍게 눌러 준다 */
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 8;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;

    master.connect(comp);
    comp.connect(ctx.destination);

    /* 펀치 버스: 가벼운 새추레이션 -> 마스터. 타격음이 '살집'을 얻는다 */
    punchBus = ctx.createGain();
    punchBus.gain.value = 0.9;
    var shaper = ctx.createWaveShaper();
    shaper.curve = distCurve(2.6);
    shaper.oversample = '2x';
    punchBus.connect(shaper);
    shaper.connect(master);

    /* 재사용할 화이트 노이즈 버퍼 */
    var len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    return true;
  }

  function now() { return ctx.currentTime; }

  /* ═══════════ 기본 빌딩 블록 ═══════════ */

  /* 단음 — freq에서 slideTo까지 미끄러뜨릴 수 있다 */
  function tone(o) {
    var t0 = now() + (o.delay || 0);
    var dur = o.dur || 0.18;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();

    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;

    var peak = (o.gain == null ? 0.25 : o.gain);
    var atk = o.attack == null ? 0.008 : o.attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    var node = osc;
    if (o.filter) {
      var f = ctx.createBiquadFilter();
      f.type = o.filter.type || 'lowpass';
      f.frequency.value = o.filter.freq || 1200;
      if (o.filter.q) f.Q.value = o.filter.q;
      osc.connect(f); node = f;
    }
    node.connect(g);
    g.connect(o.bus === 'punch' && punchBus ? punchBus : master);

    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /* 노이즈 — 필터를 쓸어 주면 타격/바람 소리가 된다 */
  function noise(o) {
    var t0 = now() + (o.delay || 0);
    var dur = o.dur || 0.15;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    var f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 900, t0);
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.sweepTo), t0 + dur);
    f.Q.value = o.q == null ? 1.2 : o.q;

    var g = ctx.createGain();
    var peak = o.gain == null ? 0.2 : o.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(f); f.connect(g);
    g.connect(o.bus === 'punch' && punchBus ? punchBus : master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function chord(freqs, o) {
    o = o || {};
    freqs.forEach(function (f, i) {
      tone({
        freq: f, type: o.type || 'triangle',
        dur: o.dur || 0.5, gain: (o.gain || 0.16),
        delay: (o.delay || 0) + i * (o.stagger || 0.05),
        attack: 0.01
      });
    });
  }

  /* ═══════════ 효과음 목록 ═══════════ */
  var SFX = {
    /* UI */
    click: function () {
      tone({ freq: 900, type: 'square', dur: 0.05, gain: 0.07, filter: { type: 'lowpass', freq: 2200 } });
    },
    select: function () {
      tone({ freq: 620, slideTo: 880, type: 'triangle', dur: 0.1, gain: 0.14 });
    },
    cancel: function () {
      tone({ freq: 520, slideTo: 300, type: 'triangle', dur: 0.11, gain: 0.12 });
    },
    error: function () {
      tone({ freq: 150, type: 'sawtooth', dur: 0.16, gain: 0.13, filter: { type: 'lowpass', freq: 500 } });
    },

    /* 카드 */
    draw: function () {
      noise({ freq: 3200, sweepTo: 1100, dur: 0.13, gain: 0.1, q: 0.8, type: 'highpass' });
    },
    summon: function () {
      var v = vary();
      /* 상승 라이저 + 화음 + 착지 툭 (낙하 연출과 맞춤) */
      noise({ freq: 500, sweepTo: 2600, dur: 0.22, gain: 0.08, type: 'bandpass', q: 0.7 });
      chord([294 * v, 392 * v, 588 * v], { dur: 0.4, gain: 0.12, stagger: 0.04 });
      tone({ freq: 120, slideTo: 50, type: 'sine', dur: 0.14, gain: 0.22, delay: 0.2, bus: 'punch' });
      noise({ freq: 900, sweepTo: 250, dur: 0.08, gain: 0.1, q: 1.0, delay: 0.2 });
    },
    spell: function () {
      var v = vary();
      /* 차지 상승 + 반짝임 아르페지오 + 방출 임팩트 */
      tone({ freq: 520 * v, slideTo: 1900 * v, type: 'sine', dur: 0.2, gain: 0.15 });
      tone({ freq: 1040 * v, type: 'sine', dur: 0.12, gain: 0.08, delay: 0.04 });
      tone({ freq: 1380 * v, type: 'sine', dur: 0.12, gain: 0.08, delay: 0.09 });
      tone({ freq: 1840 * v, type: 'sine', dur: 0.14, gain: 0.09, delay: 0.14 });
      tone({ freq: 1500 * v, slideTo: 220, type: 'sawtooth', dur: 0.18, gain: 0.15, delay: 0.16,
             filter: { type: 'lowpass', freq: 3400 }, bus: 'punch' });
      tone({ freq: 90 * v, slideTo: 45, type: 'sine', dur: 0.16, gain: 0.2, delay: 0.16, bus: 'punch' });
      noise({ freq: 3200, sweepTo: 7000, dur: 0.26, gain: 0.06, type: 'highpass', q: 0.6 });
    },
    power: function () {
      chord([392, 494, 587, 784], { dur: 0.6, gain: 0.12, stagger: 0.04, type: 'triangle' });
      tone({ freq: 1568, type: 'sine', dur: 0.7, gain: 0.06, delay: 0.08 });
    },
    build: function () {
      noise({ freq: 260, sweepTo: 120, dur: 0.13, gain: 0.22, q: 1.6, type: 'bandpass' });
      noise({ freq: 240, sweepTo: 100, dur: 0.16, gain: 0.2, q: 1.6, type: 'bandpass', delay: 0.15 });
      tone({ freq: 140, slideTo: 90, type: 'sine', dur: 0.3, gain: 0.16, delay: 0.15 });
    },

    /* 전투 */
    move: function () {
      noise({ freq: 620, sweepTo: 200, dur: 0.12, gain: 0.13, q: 0.9 });
      tone({ freq: 170, slideTo: 110, type: 'sine', dur: 0.13, gain: 0.1 });
    },
    attack: function () {
      var v = vary();
      /* 휘두름 — 참격 연출과 타이밍을 맞춘다 */
      noise({ freq: 1400 * v, sweepTo: 320, dur: 0.09, gain: 0.14, q: 0.8 });
      /* 임팩트 (70ms 뒤): 클릭 트랜지언트 + 금속 클랭(디튠 쌍) + 몸통 + 서브 */
      var t = 0.07;
      noise({ freq: 6800, sweepTo: 3800, dur: 0.018, gain: 0.3, q: 0.5, delay: t, bus: 'punch' });
      tone({ freq: 420 * v, slideTo: 300 * v, type: 'square', dur: 0.12, gain: 0.2, delay: t,
             filter: { type: 'bandpass', freq: 2100, q: 2.2 }, bus: 'punch' });
      tone({ freq: 428 * v, slideTo: 296 * v, type: 'square', dur: 0.1, gain: 0.14, delay: t + 0.004,
             filter: { type: 'bandpass', freq: 2600, q: 2.0 }, bus: 'punch' });
      tone({ freq: 160 * v, slideTo: 52, type: 'triangle', dur: 0.17, gain: 0.3, delay: t, bus: 'punch' });
      tone({ freq: 72 * v, slideTo: 36, type: 'sine', dur: 0.24, gain: 0.36, delay: t, bus: 'punch' });
      /* 파편 */
      noise({ freq: 4800, sweepTo: 1600, dur: 0.1, gain: 0.09, q: 0.7, delay: t + 0.03 });
    },
    ranged: function () {
      var v = vary();
      /* 발사 크랙 + 탄도 휘파람 + 꼬리 */
      noise({ freq: 7000, sweepTo: 2400, dur: 0.02, gain: 0.32, q: 0.4, type: 'highpass', bus: 'punch' });
      tone({ freq: 2100 * v, slideTo: 340, type: 'sawtooth', dur: 0.13, gain: 0.12,
             filter: { type: 'lowpass', freq: 3200 } });
      tone({ freq: 120 * v, slideTo: 55, type: 'sine', dur: 0.1, gain: 0.18, bus: 'punch' });
      noise({ freq: 2400, sweepTo: 600, dur: 0.16, gain: 0.06, q: 0.6, delay: 0.03 });
    },
    hit: function () {
      var v = vary();
      noise({ freq: 5600, sweepTo: 2800, dur: 0.014, gain: 0.22, q: 0.5, bus: 'punch' });
      tone({ freq: 130 * v, slideTo: 42, type: 'sine', dur: 0.2, gain: 0.34, bus: 'punch' });
      noise({ freq: 800 * v, sweepTo: 160, dur: 0.12, gain: 0.16, q: 1.0, bus: 'punch' });
    },
    death: function () {
      var v = vary();
      /* 파괴 — 서브 붐 + 폭발 노이즈 + 잔해 틱틱 + 저음 잔향 */
      tone({ freq: 95 * v, slideTo: 28, type: 'sine', dur: 0.42, gain: 0.42, bus: 'punch' });
      noise({ freq: 900 * v, sweepTo: 90, dur: 0.34, gain: 0.26, q: 0.7, bus: 'punch' });
      tone({ freq: 260 * v, slideTo: 60, type: 'sawtooth', dur: 0.3, gain: 0.14,
             filter: { type: 'lowpass', freq: 900 }, bus: 'punch' });
      noise({ freq: 3200, sweepTo: 1200, dur: 0.05, gain: 0.1, q: 1.4, delay: 0.1 });
      noise({ freq: 2600, sweepTo: 900, dur: 0.05, gain: 0.08, q: 1.4, delay: 0.19 });
      noise({ freq: 240, sweepTo: 70, dur: 0.5, gain: 0.1, q: 0.5, delay: 0.12 });
    },

    /* 흐름 */
    turn: function () {
      /* 따뜻한 2음 차임 + 옥타브 배음 */
      tone({ freq: 196, type: 'sine', dur: 0.6, gain: 0.12, attack: 0.02 });
      tone({ freq: 392, type: 'sine', dur: 0.5, gain: 0.05, delay: 0.02 });
      tone({ freq: 294, type: 'triangle', dur: 0.5, gain: 0.08, delay: 0.09 });
    },
    ark: function () {
      /* 고동치는 상승 펄스 — 점령이 진행되는 긴장감 */
      tone({ freq: 220, slideTo: 440, type: 'sine', dur: 0.5, gain: 0.14 });
      chord([523, 659, 784], { dur: 0.7, gain: 0.09, stagger: 0.06, type: 'sine', delay: 0.18 });
      tone({ freq: 1047, type: 'sine', dur: 0.8, gain: 0.08, delay: 0.42, attack: 0.01 });
      noise({ freq: 2400, sweepTo: 5200, dur: 0.5, gain: 0.04, type: 'highpass', q: 0.6 });
    },
    win: function () {
      /* 3단 팡파르: 상승 아르페지오 -> 대화음 -> 종 */
      [392, 494, 587, 784].forEach(function (f, i) {
        tone({ freq: f, type: 'triangle', dur: 0.32, gain: 0.15, delay: i * 0.09, attack: 0.01 });
      });
      chord([523, 659, 784, 1047], { dur: 1.5, gain: 0.16, stagger: 0.05, delay: 0.42 });
      tone({ freq: 2093, type: 'sine', dur: 1.2, gain: 0.07, delay: 0.55 });
      tone({ freq: 1568, type: 'sine', dur: 1.0, gain: 0.05, delay: 0.72 });
      noise({ freq: 3000, sweepTo: 7000, dur: 0.7, gain: 0.05, type: 'highpass', q: 0.5, delay: 0.4 });
      tone({ freq: 98, type: 'sine', dur: 1.4, gain: 0.15, delay: 0.42 });
    },
    lose: function () {
      /* 하강 단조 + 낮은 드론 — 무겁게 가라앉는다 */
      [466, 415, 349].forEach(function (f, i) {
        tone({ freq: f, type: 'triangle', dur: 0.5, gain: 0.13, delay: i * 0.22, attack: 0.02 });
      });
      chord([233, 277, 349], { dur: 1.6, gain: 0.12, stagger: 0.08, delay: 0.66 });
      tone({ freq: 58, type: 'sine', dur: 2.0, gain: 0.16, delay: 0.6 });
      noise({ freq: 400, sweepTo: 90, dur: 1.4, gain: 0.06, q: 0.6, delay: 0.6 });
    }
  };

  /* ═══════════ 공개 API ═══════════ */
  function play(name) {
    if (!enabled) return;
    if (!SFX[name]) return;
    if (!ensure()) return;
    try { SFX[name](); } catch (e) { /* 오디오는 게임 진행을 막지 않는다 */ }
  }

  function setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem(STORE_KEY, enabled ? '1' : '0'); } catch (e) {}
    if (enabled) ensure();
  }
  function toggle() { setEnabled(!enabled); return enabled; }
  function isEnabled() { return enabled; }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume;
  }

  /* 저장된 설정 복원 */
  try {
    var saved = localStorage.getItem(STORE_KEY);
    if (saved !== null) enabled = (saved === '1');
  } catch (e) {}

  /* 브라우저 정책상 오디오는 사용자 제스처 이후에만 시작할 수 있다 */
  if (global.document) {
    global.document.addEventListener('pointerdown', function once() {
      if (enabled) ensure();
      global.document.removeEventListener('pointerdown', once);
    }, { once: true });
  }

  RG.Audio = {
    play: play,
    setEnabled: setEnabled, toggle: toggle, isEnabled: isEnabled,
    setVolume: setVolume,
    NAMES: Object.keys(SFX),
    _ctx: function () { return ctx; }          /* 디버그용 */
  };
})(typeof window !== 'undefined' ? window : global);
