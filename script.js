/**
 * script.js — Cinematic Romantic Birthday Website
 * Modules: Loader · Particles · Reveal · Countdown · Lightbox · MusicPlayer
 */

'use strict';

/* =====================================================
   CONFIG — edit these to personalise the site
   ===================================================== */
const CONFIG = {
  /** Birthday date: 'YYYY-MM-DD' — used by the countdown */
  birthdayDate: '2025-04-20',

  /**
   * Playlist — add your .mp3 files to /music and list them here.
   * { title, artist, src }
   */
  playlist: [
    { title: 'Tu Hi Re', artist: 'Kaavish', src: 'music/TU HI RE - KAAVISH.mp3' },
    { title: 'Abhi Na Jaao Chhodke', artist: 'Asha Bhosle/Mohd Rafi', src: 'music/Abhi Na Jaao Chhod Kar -Mohd RafixAsha Bhosle .mp3' },
    { title: 'Ekhon Onek Raat', artist: 'Anupam Roy', src: 'music/Ekhon Onek Raat (এখন অনেক রাত) -Anupam .mp3' },
    { title: 'Pasoori', artist: 'Ali Sethi', src: 'music/Pasoori _ Ali Sethi x Shae Gill.mp3' },
    { title: 'Just the Two of Us', artist: 'Lucy Ellis Cover', src: 'music/Just the Two of Us.mp3' }
    // { title: 'Perfect',  artist: 'Ed Sheeran',  src: 'music/perfect.mp3'  },
  ],

  /**
   * Background ambient music — plays softly from first interaction.
   * Fades out automatically when the music player is started.
   * Set src to null to disable.
   */
  bgMusic: { src: 'music/bg.mp3', volume: 0.3 },

  /** Particle count — reduce on low-end devices */
  particleCount: 60,
};

/* =====================================================
   UTILITY
   ===================================================== */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }

/* =====================================================
   BACKGROUND MUSIC
   ===================================================== */
// Shared reference so initVanGoghScene can start it and initPlayer can stop it
let bgAudio = null;

function initBgMusic() {
  if (!CONFIG.bgMusic?.src) return;
  const audio = new Audio(CONFIG.bgMusic.src);
  audio.loop   = true;
  audio.volume = CONFIG.bgMusic.volume ?? 0.3;

  audio.fadeOut = function () {
    const step = audio.volume / 20;       // 20 steps over ~1.6 s
    const tick = setInterval(() => {
      if (audio.volume <= step) {
        clearInterval(tick);
        audio.pause();
        audio.volume = 0;
      } else {
        audio.volume = Math.max(0, audio.volume - step);
      }
    }, 80);
  };

  bgAudio = audio;
}

/* =====================================================
   1. LOADER
   ===================================================== */
function initLoader() {
  const loader = $('#loader');
  if (!loader) return;

  // Minimum display time so the animation is seen
  const minDisplay = 1400;
  const start = Date.now();

  window.addEventListener('load', () => {
    const elapsed = Date.now() - start;
    const delay = Math.max(0, minDisplay - elapsed);
    setTimeout(() => loader.classList.add('hidden'), delay);
  });
}

/* =====================================================
   2. STARRY NIGHT CANVAS
   Layers (back → front):
     1. Deep midnight-blue gradient sky
     2. Nebula clouds (4 slow-pulsing radial blobs)
     3. Stars (twinkling, size-tiered, colour-varied)
     4. Drifting glow particles (gentle upward drift)
     5. Shooting stars (occasional streaks)
   ===================================================== */
function initParticles() {
  const canvas = $('#particles');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fall back to a static CSS gradient for motion-sensitive users
  if (prefersReduced) {
    canvas.style.background =
      'linear-gradient(175deg,#020510 0%,#050c1f 40%,#080d1e 70%,#0c0a16 100%)';
    return;
  }

  // ── State ──────────────────────────────────────────────────
  let W = 0, H = 0;
  let bgGrad   = null;   // cached sky gradient (rebuilt on resize)
  let stars    = [];
  let drifters = [];
  let nebulas  = [];
  let shooters = [];
  let nextShot = 0;      // timestamp for next shooting star
  let rafId, lastTime = 0;

  // ── Constants ──────────────────────────────────────────────
  const TAU  = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  // Star colour palette [r, g, b] — weighted toward cold blue-white
  const STAR_COLS = [
    [200, 215, 255],  // blue-white  (most common)
    [215, 225, 255],  // soft blue
    [255, 255, 255],  // pure white
    [255, 248, 225],  // warm ivory
    [255, 215, 195],  // faint rose
    [170, 195, 255],  // deep blue-white
  ];

  // Drift particle colours
  const DRIFT_COLS = [
    [180, 205, 255],  // blue-white
    [232, 164, 170],  // rose
  ];

  // ── Resize + rebuild ───────────────────────────────────────
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;

    // Sky gradient — zenith near-black → rich midnight → subtle purple horizon
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0.00, '#020510');
    bgGrad.addColorStop(0.25, '#040a1c');
    bgGrad.addColorStop(0.60, '#060c1d');
    bgGrad.addColorStop(1.00, '#0b0917');

    buildNebulas();
    buildStars();
    buildDrifters();
  }

  // ── Nebula blobs ───────────────────────────────────────────
  // Each blob is an elliptical radial gradient rendered via ctx scale trick.
  function buildNebulas() {
    nebulas = [
      // { nx,ny = normalised centre, rx,ry = radii in px, r,g,b, base opacity, pulse speed, phase }
      { nx:0.18, ny:0.20, rx:W*0.42, ry:H*0.30, r: 75, g: 50, b:170, base:0.075, spd:0.00017, ph:0.0  },
      { nx:0.72, ny:0.28, rx:W*0.36, ry:H*0.26, r: 35, g: 25, b:130, base:0.055, spd:0.00022, ph:2.1  },
      { nx:0.48, ny:0.58, rx:W*0.52, ry:H*0.20, r:115, g: 45, b: 95, base:0.045, spd:0.00013, ph:4.3  },
      { nx:0.12, ny:0.72, rx:W*0.28, ry:H*0.22, r: 55, g: 75, b:165, base:0.060, spd:0.00019, ph:1.5  },
    ];
  }

  // ── Stars ──────────────────────────────────────────────────
  function buildStars() {
    const count = Math.min(300, Math.max(130, Math.round(W * 0.17)));
    stars = [];

    for (let i = 0; i < count; i++) {
      // Weighted colour selection
      const t = Math.random();
      const col =
        t < 0.55 ? STAR_COLS[Math.floor(Math.random() * 2)] :   // 55% blue-white
        t < 0.70 ? STAR_COLS[2] :                                // 15% pure white
        t < 0.85 ? STAR_COLS[3 + Math.floor(Math.random()*2)] : // 15% warm/rose
                   STAR_COLS[5];                                  // 15% deep blue

      // Strongly weighted toward tiny (most real stars look tiny)
      const sz = Math.random();
      const r  = sz < 0.62 ? rand(0.22, 0.65)   // micro
               : sz < 0.86 ? rand(0.65, 1.15)   // small
               : sz < 0.96 ? rand(1.15, 1.75)   // medium
               :              rand(1.75, 2.50);  // rare large

      const glow = r > 1.4;
      stars.push({
        x: rand(0, W),
        y: rand(0, H),
        r,
        baseAlpha:    rand(0.45, 1.0),
        twinkleAmp:   rand(0.15, 0.55),
        twinkleSpeed: rand(0.28, 1.9),
        twinklePhase: rand(0, TAU),
        // Precomputed strings to avoid allocations in hot path
        fill:    `rgb(${col[0]},${col[1]},${col[2]})`,
        shadow:  `rgba(${col[0]},${col[1]},${col[2]},0.85)`,
        glow,
      });
    }
  }

  // ── Drifting glow particles ────────────────────────────────
  function buildDrifters() {
    drifters = [];
    for (let i = 0; i < 38; i++) spawnDrifter(true);
  }

  function spawnDrifter(initial = false) {
    const col = DRIFT_COLS[Math.random() < 0.62 ? 0 : 1];
    drifters.push({
      x: rand(0, W),
      y: initial ? rand(0, H) : H + 8,
      vx: rand(-0.10, 0.10),
      vy: rand(-0.20, -0.06),
      waveAmp:   rand(0.06, 0.22),
      waveSpeed: rand(0.0005, 0.0022),
      wavePhase: rand(0, TAU),
      r:         rand(1.0, 2.8),
      baseAlpha: rand(0.06, 0.26),
      alpha:     0,
      fill:   `rgb(${col[0]},${col[1]},${col[2]})`,
      shadow: `rgba(${col[0]},${col[1]},${col[2]},0.9)`,
      blur:   rand(4, 11),
      fadingIn: true,
    });
  }

  // ── Shooting stars ─────────────────────────────────────────
  function maybeSpawnShooter(now) {
    if (now < nextShot) return;
    nextShot = now + rand(5000, 13000);

    const leftward = Math.random() < 0.5;
    shooters.push({
      x:       leftward ? rand(W * 0.05, W * 0.55) : rand(W * 0.45, W * 0.95),
      y:       rand(H * 0.04, H * 0.42),
      vx:      (leftward ? -1 : 1) * rand(7, 13),   // px per frame @60fps
      vy:      rand(2, 5),
      len:     rand(90, 170),
      life:    rand(0.35, 0.65),
      elapsed: 0,
      alpha:   1,
    });
  }

  // ── Update ─────────────────────────────────────────────────
  function updateNebulas(now) {
    nebulas.forEach(n => {
      n.alpha = n.base * (0.72 + 0.28 * Math.sin(now * n.spd + n.ph));
    });
  }

  function updateDrifters(now) {
    for (let i = drifters.length - 1; i >= 0; i--) {
      const p = drifters[i];
      p.x += p.vx + p.waveAmp * Math.sin(now * p.waveSpeed + p.wavePhase);
      p.y += p.vy;

      if (p.fadingIn) {
        p.alpha = Math.min(p.alpha + 0.003, p.baseAlpha);
        if (p.alpha >= p.baseAlpha) p.fadingIn = false;
      } else if (p.y < H * 0.2) {
        p.alpha -= 0.0018;
      }

      if (p.y < -15 || p.alpha <= 0) {
        drifters.splice(i, 1);
        spawnDrifter(false);
      }
    }
  }

  function updateShooters(dt) {
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.elapsed += dt;
      s.x      += s.vx;
      s.y      += s.vy;
      s.alpha   = Math.max(0, 1 - s.elapsed / s.life);
      if (s.elapsed >= s.life) shooters.splice(i, 1);
    }
  }

  // ── Draw ───────────────────────────────────────────────────
  function drawSky() {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawNebulas() {
    // Render each blob by scaling context into a unit circle so the radial
    // gradient stretches into the desired ellipse automatically.
    nebulas.forEach(({ nx, ny, rx, ry, r, g, b, alpha }) => {
      if (alpha <= 0.002) return;
      const cx = nx * W, cy = ny * H;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0,    `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},${(alpha * 0.38).toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx, ry);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawStars(now) {
    // Pass 1: non-glowing stars — no save/restore, minimal state changes
    stars.forEach(s => {
      if (s.glow) return;
      const tw = Math.sin(now * 0.001 * s.twinkleSpeed + s.twinklePhase);
      ctx.globalAlpha = Math.min(1, Math.max(0, s.baseAlpha + tw * s.twinkleAmp));
      ctx.fillStyle   = s.fill;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Pass 2: large glowing stars — shadow state needed, batched separately
    stars.forEach(s => {
      if (!s.glow) return;
      const tw = Math.sin(now * 0.001 * s.twinkleSpeed + s.twinklePhase);
      const a  = Math.min(1, Math.max(0, s.baseAlpha + tw * s.twinkleAmp));
      ctx.save();
      ctx.shadowColor = s.shadow;
      ctx.shadowBlur  = s.r * 4.5;
      ctx.globalAlpha = a;
      ctx.fillStyle   = s.fill;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawDrifters() {
    drifters.forEach(p => {
      if (p.alpha <= 0.005) return;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.shadow;
      ctx.shadowBlur  = p.blur;
      ctx.fillStyle   = p.fill;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawShooters() {
    shooters.forEach(s => {
      const angle = Math.atan2(s.vy, s.vx);
      const tx = s.x - Math.cos(angle) * s.len;
      const ty = s.y - Math.sin(angle) * s.len;

      const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
      grad.addColorStop(0,   `rgba(255,255,255,${s.alpha.toFixed(2)})`);
      grad.addColorStop(0.3, `rgba(200,220,255,${(s.alpha * 0.35).toFixed(2)})`);
      grad.addColorStop(1,    'rgba(180,210,255,0)');

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = 'rgba(210,230,255,0.9)';
      ctx.shadowBlur  = 7;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
    });
  }

  // ── Main loop ──────────────────────────────────────────────
  function loop(now = 0) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    drawSky();
    updateNebulas(now);
    drawNebulas();
    drawStars(now);
    updateDrifters(now);
    drawDrifters();
    maybeSpawnShooter(now);
    updateShooters(dt);
    drawShooters();

    rafId = requestAnimationFrame(loop);
  }

  // Pause rendering while tab is hidden (saves CPU/battery)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  });

  const debouncedResize = debounce(resize, 250);
  window.addEventListener('resize', debouncedResize);
  // iOS Safari fires visualViewport resize when the address bar shows/hides
  window.visualViewport?.addEventListener('resize', debouncedResize);

  resize();
  rafId = requestAnimationFrame(loop);
}

/* =====================================================
   3. SCROLL REVEAL
   ===================================================== */
function initReveal() {
  const els = $$('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
}

/* =====================================================
   4. COUNTDOWN — elapsed time since last birthday
   ===================================================== */
function initCountdown() {
  const daysEl    = $('#cd-days');
  const hoursEl   = $('#cd-hours');
  const minutesEl = $('#cd-minutes');
  const secondsEl = $('#cd-seconds');

  if (!daysEl) return;

  const birthday = new Date(CONFIG.birthdayDate + 'T00:00:00').getTime();

  function update() {
    const now  = Date.now();
    let diff   = Math.max(0, now - birthday);

    const days    = Math.floor(diff / 86_400_000);        diff %= 86_400_000;
    const hours   = Math.floor(diff /  3_600_000);        diff %=  3_600_000;
    const minutes = Math.floor(diff /     60_000);        diff %=     60_000;
    const seconds = Math.floor(diff /      1_000);

    daysEl.textContent    = pad(days);
    hoursEl.textContent   = pad(hours);
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);
  }

  update();
  setInterval(update, 1000);
}

/* =====================================================
   5. LIGHTBOX
   ===================================================== */
function initLightbox() {
  const lightbox = $('#lightbox');
  const lbImg    = $('#lightbox-img');
  const lbClose  = $('#lightbox-close');
  const lbPrev   = $('#lb-prev');
  const lbNext   = $('#lb-next');
  const items    = $$('.gallery__item:not(.gallery__item--placeholder)');

  if (!lightbox || !items.length) return;

  let current = 0;

  function open(idx) {
    current = idx;
    const img = items[idx].querySelector('img');
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }

  function close() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    items[current].focus();
  }

  function prev() { open((current - 1 + items.length) % items.length); }
  function next() { open((current + 1) % items.length); }

  items.forEach((item, idx) => {
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `View photo ${idx + 1}`);

    item.addEventListener('click', () => open(idx));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(idx); }
    });
  });

  lbClose.addEventListener('click', close);
  lbPrev.addEventListener('click', prev);
  lbNext.addEventListener('click', next);

  lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });

  document.addEventListener('keydown', e => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape')      close();
    if (e.key === 'ArrowLeft')   prev();
    if (e.key === 'ArrowRight')  next();
  });
}

/* =====================================================
   6. MUSIC PLAYER
   ===================================================== */
function initPlayer() {
  const playlist = CONFIG.playlist;
  const trackNameEl   = $('#track-name');
  const trackArtistEl = $('#track-artist');
  const progressBar   = $('#progress-bar');
  const volumeBar     = $('#volume-bar');
  const timeCurrent   = $('#time-current');
  const timeTotal     = $('#time-total');
  const btnPlay       = $('#btn-play');
  const btnPrev       = $('#btn-prev');
  const btnNext       = $('#btn-next');
  const disc          = $('#player-disc');
  const playlistEl    = $('#playlist');

  if (!btnPlay) return;

  // No tracks configured — show friendly message
  if (!playlist.length) {
    if (trackNameEl) trackNameEl.textContent = 'No tracks yet';
    if (trackArtistEl) trackArtistEl.textContent = 'Add songs to CONFIG.playlist in script.js';
    [btnPlay, btnPrev, btnNext].forEach(b => b && (b.disabled = true));
    return;
  }

  let currentIdx = 0;
  let isPlaying  = false;
  const audio    = new Audio();
  audio.volume   = parseFloat(volumeBar?.value ?? 0.7);

  // Build playlist DOM
  playlist.forEach((track, i) => {
    const li = document.createElement('li');
    li.setAttribute('data-index', i + 1);
    li.textContent = `${track.title} — ${track.artist}`;
    li.addEventListener('click', () => loadTrack(i, true));
    playlistEl.appendChild(li);
  });

  function formatTime(s) {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${pad(s % 60)}`;
  }

  function setPlaylistActive(idx) {
    $$('li', playlistEl).forEach((li, i) => li.classList.toggle('active', i === idx));
  }

  function loadTrack(idx, autoPlay = false) {
    currentIdx = idx;
    const track = playlist[idx];
    audio.src = track.src;
    trackNameEl.textContent   = track.title;
    trackArtistEl.textContent = track.artist;
    progressBar.value = 0;
    timeCurrent.textContent = '0:00';
    timeTotal.textContent   = '0:00';
    setPlaylistActive(idx);
    if (autoPlay) play();
  }

  function play() {
    bgAudio?.fadeOut?.();
    audio.play().then(() => {
      isPlaying = true;
      updatePlayBtn();
      disc.classList.add('spinning');
    }).catch(() => {});
  }

  function pause() {
    audio.pause();
    isPlaying = false;
    updatePlayBtn();
    disc.classList.remove('spinning');
  }

  function updatePlayBtn() {
    const iconPlay  = btnPlay.querySelector('.icon-play');
    const iconPause = btnPlay.querySelector('.icon-pause');
    iconPlay.hidden  =  isPlaying;
    iconPause.hidden = !isPlaying;
    btnPlay.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  }

  btnPlay.addEventListener('click', () => {
    if (!audio.src) loadTrack(0);
    isPlaying ? pause() : play();
  });

  btnPrev.addEventListener('click', () => {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    loadTrack((currentIdx - 1 + playlist.length) % playlist.length, isPlaying);
  });

  btnNext.addEventListener('click', () => {
    loadTrack((currentIdx + 1) % playlist.length, isPlaying);
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressBar.value = pct;
    timeCurrent.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('loadedmetadata', () => {
    timeTotal.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('ended', () => {
    loadTrack((currentIdx + 1) % playlist.length, true);
  });

  progressBar?.addEventListener('input', () => {
    if (!audio.duration) return;
    audio.currentTime = (progressBar.value / 100) * audio.duration;
  });

  volumeBar?.addEventListener('input', () => {
    audio.volume = parseFloat(volumeBar.value);
  });

  // Load first track without auto-playing (browser autoplay policy)
  loadTrack(0, false);
}

/* =====================================================
   7. ENVELOPE — idle tilt + cinematic open sequence
   Animation stages (triggered on click):
     0  Flatten tilt · pause float · dim backdrop
     1  Camera zooms in                       T≈100ms
     2  Seal crack animation                  T≈450ms
     3  Flap rotates fully open (-185°)       T≈700ms
     4  Inner warm glow fades in              T≈850ms
     5  Letter slides up                      T≈1100ms
     6  Burst particles spawn                 T≈1250ms
     7  Message text & close btn appear       T≈2000ms
   ===================================================== */
function initEnvelope() {
  const tilt     = $('#env-tilt');
  const zoom     = $('#env-zoom');
  const floater  = $('#env-float');
  const envBody  = $('#env-body');
  const flap     = $('#env-flap');
  const seal     = $('#env-seal');
  const letter   = $('#env-letter');
  const glow     = $('#env-glow');
  const shadow   = $('#env-shadow');
  const closeBtn = $('#env-close');
  const hint     = $('.env-hint');
  const section  = $('#envelope-section');

  if (!tilt || !flap) return;

  let isOpen     = false;
  let isAnimating = false;
  let backdrop   = null;
  let springTimer;

  // ── Constants ──────────────────────────────────────────
  const MAX_TILT   = 14;
  const SPRING_MS  = 650;
  const SPRING_EASE = 'cubic-bezier(.34,1.56,.64,1)';

  // ── Idle hover tilt ────────────────────────────────────
  function applyTilt(clientX, clientY) {
    if (isOpen || isAnimating) return;
    const b  = tilt.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, (clientX - b.left - b.width  / 2) / (b.width  / 2)));
    const ny = Math.max(-1, Math.min(1, (clientY - b.top  - b.height / 2) / (b.height / 2)));
    tilt.style.transition = 'transform 0.09s ease-out';
    tilt.style.transform  =
      `rotateX(${(-ny * MAX_TILT).toFixed(2)}deg) rotateY(${(nx * MAX_TILT).toFixed(2)}deg)`;
  }

  function resetTilt() {
    if (isOpen || isAnimating) return;
    clearTimeout(springTimer);
    tilt.style.transition = `transform ${SPRING_MS}ms ${SPRING_EASE}`;
    tilt.style.transform  = 'rotateX(0deg) rotateY(0deg)';
    springTimer = setTimeout(() => { tilt.style.transition = ''; }, SPRING_MS);
  }

  tilt.addEventListener('mousemove',   e => { clearTimeout(springTimer); applyTilt(e.clientX, e.clientY); });
  tilt.addEventListener('mouseleave',  resetTilt);
  tilt.addEventListener('touchmove',   e => {
    if (e.touches.length !== 1 || isOpen || isAnimating) return;
    e.preventDefault();
    clearTimeout(springTimer);
    applyTilt(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  tilt.addEventListener('touchend',    resetTilt);
  tilt.addEventListener('touchcancel', resetTilt);

  // ── Burst particles ────────────────────────────────────
  function spawnBurst() {
    const ICONS  = ['❤', '✦', '✧', '★', '·', '✨'];
    const COLORS = ['#e8a4aa', '#d4a76a', '#f0d4a0', '#ffffff', '#c9737a', '#f5c6cb'];
    const count  = window.innerWidth < 480 ? 12 : 20;
    const origin = envBody.offsetTop;    // y-position of envelope opening in env-tilt

    for (let i = 0; i < count; i++) {
      const el    = document.createElement('span');
      // Spread ±65° around straight-up (-90°)
      const angle = -90 + (Math.random() - 0.5) * 130;
      const dist  = 65 + Math.random() * 155;
      const dx    = Math.cos(angle * Math.PI / 180) * dist;
      const dy    = Math.sin(angle * Math.PI / 180) * dist;

      el.className   = 'env-burst-particle';
      el.textContent = ICONS[Math.floor(Math.random() * ICONS.length)];
      el.style.top   = origin + 'px';
      el.style.left  = '50%';
      el.style.fontSize = (9 + Math.random() * 13) + 'px';
      el.style.color    = COLORS[Math.floor(Math.random() * COLORS.length)];
      el.style.setProperty('--dx',    `${dx}px`);
      el.style.setProperty('--dy',    `${dy}px`);
      el.style.setProperty('--rot',   `${Math.random() * 360}deg`);
      el.style.setProperty('--delay', `${Math.random() * 280}ms`);
      el.style.setProperty('--dur',   `${850 + Math.random() * 550}ms`);

      tilt.appendChild(el);
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
  }

  // ── Open sequence ──────────────────────────────────────
  function openEnvelope() {
    if (isOpen || isAnimating) return;
    isAnimating = true;

    // Stage 0 — flatten tilt, freeze float, raise section z-index
    clearTimeout(springTimer);
    tilt.style.transition = 'transform 0.45s cubic-bezier(.4,0,.2,1)';
    tilt.style.transform  = 'rotateX(0deg) rotateY(0deg)';
    floater.classList.add('is-paused');
    section.style.zIndex  = '200';

    // Smooth scroll to keep envelope centred
    tilt.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Hide hint text
    hint && hint.classList.add('is-hidden');

    // Create and mount backdrop
    backdrop = document.createElement('div');
    backdrop.className = 'env-backdrop';
    document.body.appendChild(backdrop);

    // Stage 1 — backdrop fade + camera zoom in
    setTimeout(() => {
      backdrop.classList.add('is-visible');
      zoom.classList.add('is-zoomed');
    }, 80);

    // Stage 2 — seal crack + reveal letter behind body
    setTimeout(() => {
      seal.classList.add('is-cracking');
      letter.classList.add('is-ready');
    }, 450);

    // Stage 3 — flap swings open
    setTimeout(() => {
      flap.classList.add('is-open');
      envBody.classList.add('is-open');
    }, 700);

    // Stage 4 — warm glow rises
    setTimeout(() => {
      glow.classList.add('is-glowing');
    }, 850);

    // Stage 5 — letter slides out in front of envelope (translateZ brings it forward)
    setTimeout(() => {
      // Compute exact rise so all content clears the envelope body
      const bodyTop     = envBody.offsetTop;          // = env-peek px
      const letterH     = letter.offsetHeight;
      const rise        = letterH - bodyTop + 28;     // 28px breathing room
      letter.style.transform = `translateX(-50%) translateY(-${rise}px) translateZ(2px)`;
      letter.classList.add('is-out');
      shadow.style.opacity = '0';
    }, 1100);

    // Stage 6 — burst particles
    setTimeout(spawnBurst, 1250);

    // Stage 6.5 — envelope seals itself as the letter rises clear
    setTimeout(() => {
      flap.classList.remove('is-open');
      envBody.classList.remove('is-open');
      glow.classList.remove('is-glowing');
    }, 1550);

    // Stage 7 — show close button, mark complete
    setTimeout(() => {
      isOpen      = true;
      isAnimating = false;
      tilt.setAttribute('aria-pressed', 'true');
      tilt.setAttribute('aria-label',   'Close the envelope');
      closeBtn.hidden = false;
      // rAF ensures hidden→block takes effect before opacity transition
      requestAnimationFrame(() => closeBtn.classList.add('is-visible'));
    }, 2050);
  }

  // ── Close sequence ─────────────────────────────────────
  function closeEnvelope() {
    if (!isOpen || isAnimating) return;
    isAnimating = true;

    // Hide close button
    closeBtn.classList.remove('is-visible');
    setTimeout(() => { closeBtn.hidden = true; }, 400);

    // Fade letter content and body text out first
    letter.classList.remove('is-out');
    letter.classList.remove('is-ready');   // opacity → 0 (0.4s)
    glow.classList.remove('is-glowing');
    envBody.classList.remove('is-open');

    // After letter fades, silently slide it back behind body (reset Z too)
    setTimeout(() => {
      letter.style.transform = 'translateX(-50%) translateY(0px) translateZ(0px)';
    }, 450);

    // Flap closes
    setTimeout(() => flap.classList.remove('is-open'), 600);

    // Zoom out + backdrop fade
    setTimeout(() => {
      zoom.classList.remove('is-zoomed');
      backdrop && backdrop.classList.remove('is-visible');
    }, 750);

    // Restore float, shadow
    setTimeout(() => {
      floater.classList.remove('is-paused');
      shadow.style.opacity = '';
    }, 1100);

    // Cleanup: remove backdrop DOM node, show hint, reset state
    setTimeout(() => {
      backdrop && backdrop.remove();
      backdrop = null;
      section.style.zIndex = '';
      hint && hint.classList.remove('is-hidden');
      tilt.setAttribute('aria-pressed', 'false');
      tilt.setAttribute('aria-label',   'Open the envelope');
      isOpen      = false;
      isAnimating = false;
    }, 1400);
  }

  // ── Event wiring ───────────────────────────────────────
  tilt.addEventListener('click', () => isOpen ? closeEnvelope() : openEnvelope());
  tilt.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      isOpen ? closeEnvelope() : openEnvelope();
    }
  });

  closeBtn && closeBtn.addEventListener('click', closeEnvelope);

  // Clicking the backdrop also closes
  document.addEventListener('click', e => {
    if (isOpen && !isAnimating && e.target.classList.contains('env-backdrop')) {
      closeEnvelope();
    }
  });

}

/* =====================================================
   9. VAN GOGH OPENING SCENE
   ===================================================== */
function initVanGoghScene() {
  const scene    = $('#vg-scene');
  const canvas   = $('#vg-canvas');
  const enterBtn = $('#vg-enter');
  if (!scene || !canvas) return;

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  let raf = null;

  // ── Van Gogh Starry Night palette (r,g,b) ────────────────
  // Weighted heavily toward deep blues; fewer yellows for the star halos
  const BLUES = [
    [12,  30, 110],  // prussian
    [18,  45, 150],  // cobalt
    [8,   20,  82],  // midnight navy
    [28,  58, 168],  // royal blue
    [38,  88, 200],  // vivid blue
    [55, 115, 220],  // cornflower
    [20,  60, 140],  // ultramarine
    [15,  40, 120],  // deep blue
    [45, 100, 190],  // cerulean
    [10,  50, 100],  // dark teal-blue
    [65, 130, 215],  // sky blue
    [35,  75, 160],  // indigo blue
  ];
  const LIGHTS = [
    [255, 225,  80],  // golden star
    [255, 245, 140],  // bright lemon
    [240, 200,  60],  // amber
    [255, 255, 220],  // cream white
    [200, 235, 255],  // ice blue halo
  ];

  // ── Stars (fixed, glowing) ──────────────────────────────
  let stars = [];
  function buildStars() {
    stars = Array.from({ length: 11 }, (_, i) => ({
      x: 0, y: 0,
      r:     3 + Math.random() * 7,
      phase: Math.random() * Math.PI * 2,
      speed: 0.0018 + Math.random() * 0.0015,
      // Alternate between gold and blue-white
      warm: i % 3 !== 2,
    }));
  }

  function placeStars() {
    // Scatter across upper 55% of screen, avoid centre letter area
    const cx = W * 0.5, cw = W * 0.28;
    stars.forEach(s => {
      let x, y, tries = 0;
      do {
        x = W * 0.04 + Math.random() * W * 0.92;
        y = H * 0.04 + Math.random() * H * 0.5;
        tries++;
      } while (Math.abs(x - cx) < cw && tries < 30);
      s.x = x;
      s.y = y;
    });
  }

  // ── Flow-field particles ──────────────────────────────────
  const PARTICLE_COUNT = 350;
  let particles = [];

  function makeParticle() {
    const isLight = Math.random() < 0.12;
    const palette = isLight ? LIGHTS : BLUES;
    const [r, g, b] = palette[Math.floor(Math.random() * palette.length)];
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      px: 0, py: 0,
      speed:   0.6 + Math.random() * 1.8,
      life:    0,
      maxLife: 80 + Math.random() * 140,
      // Precomputed rgb prefix — only alpha is dynamic per frame
      fill:  `rgb(${r},${g},${b})`,
      alpha: 0.28 + Math.random() * 0.45,
      lw:   0.7 + Math.random() * 2.2,
    };
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    placeStars();
    // Paint initial background on hard resize
    ctx.fillStyle = '#06102a';
    ctx.fillRect(0, 0, W, H);
  }

  // ── Flow field: trig curl noise ──────────────────────────
  function flowAngle(x, y, t) {
    const a = Math.sin(x * 0.0035 + t * 0.00022) * Math.cos(y * 0.003  - t * 0.00018);
    const b = Math.cos(x * 0.0055 - t * 0.00015) * Math.sin(y * 0.0045 + t * 0.00028);
    const c = Math.sin((x - y) * 0.002 + t * 0.00012);
    return (a + b + c * 0.4) * Math.PI;
  }

  function drawStars(t) {
    stars.forEach(s => {
      const pulse = 0.68 + 0.32 * Math.sin(t * s.speed + s.phase);
      const haloR = s.r * 5 * pulse;

      // Outer soft halo
      const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, haloR * 2.4);
      if (s.warm) {
        halo.addColorStop(0,   `rgba(255,235,100,${0.22 * pulse})`);
        halo.addColorStop(0.5, `rgba(255,210, 50,${0.09 * pulse})`);
        halo.addColorStop(1,   'rgba(255,190, 30,0)');
      } else {
        halo.addColorStop(0,   `rgba(180,220,255,${0.20 * pulse})`);
        halo.addColorStop(0.5, `rgba(130,185,255,${0.08 * pulse})`);
        halo.addColorStop(1,   'rgba(100,160,255,0)');
      }
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(s.x, s.y, haloR * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      const core = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 1.8 * pulse);
      core.addColorStop(0,   `rgba(255,255,230,${0.95 * pulse})`);
      core.addColorStop(0.5, s.warm
        ? `rgba(255,235,120,${0.55 * pulse})`
        : `rgba(200,230,255,${0.55 * pulse})`);
      core.addColorStop(1,   'rgba(200,200,200,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 2.2 * pulse, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ── Main loop ─────────────────────────────────────────────
  function draw(now = 0) {
    raf = requestAnimationFrame(draw);

    // Slow-fade overlay — builds up the layered stroke texture
    ctx.fillStyle = 'rgba(6, 16, 42, 0.09)';
    ctx.fillRect(0, 0, W, H);

    // Flow-field strokes
    ctx.lineCap = 'round';
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      if (p.life >= p.maxLife) {
        particles[i] = makeParticle();
        continue;
      }

      p.px = p.x;
      p.py = p.y;
      const ang = flowAngle(p.x, p.y, now);
      p.x += Math.cos(ang) * p.speed;
      p.y += Math.sin(ang) * p.speed;
      p.life++;

      // Edge wrap
      if (p.x < -2)  p.x = W + 2;
      if (p.x > W+2) p.x = -2;
      if (p.y < -2)  p.y = H + 2;
      if (p.y > H+2) p.y = -2;

      const lr   = p.life / p.maxLife;
      const fade = lr < 0.12 ? lr / 0.12 : lr > 0.88 ? (1 - lr) / 0.12 : 1;

      ctx.globalAlpha  = p.alpha * fade;
      ctx.strokeStyle  = p.fill;
      ctx.lineWidth    = p.lw;
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x,  p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    drawStars(now);
  }

  // ── Enter button ─────────────────────────────────────────
  function enter() {
    enterBtn.disabled = true;
    scene.classList.add('is-exiting');
    // First user gesture — safe to start ambient audio
    bgAudio?.play().catch(() => {});
    // Cancel animation after transition ends to free resources
    setTimeout(() => {
      cancelAnimationFrame(raf);
      raf = null;
      scene.hidden = true;
    }, 1450);
  }

  // ── Keyboard shortcut (any key to continue) ──────────────
  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      document.removeEventListener('keydown', onKey);
      enter();
    }
  }

  // ── Boot ─────────────────────────────────────────────────
  buildStars();
  resize();
  particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);

  // Paint solid background before first frame
  ctx.fillStyle = '#06102a';
  ctx.fillRect(0, 0, W, H);

  draw();

  const debouncedVGResize = debounce(() => { if (!scene.hidden) resize(); }, 200);
  enterBtn && enterBtn.addEventListener('click', enter);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', debouncedVGResize);
  window.visualViewport?.addEventListener('resize', debouncedVGResize);
}

/* =====================================================
   10. FOOTER YEAR
   ===================================================== */
function initFooter() {
  const el = $('#footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

/* =====================================================
   UTILITIES
   ===================================================== */
function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

/* =====================================================
   BOOTSTRAP
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initBgMusic();
  initVanGoghScene();
  initLoader();
  initParticles();
  initReveal();
  initEnvelope();
  initCountdown();
  initLightbox();
  initPlayer();
  initFooter();
});
