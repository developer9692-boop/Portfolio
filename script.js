/* ============================================================
   TECHBOOSTER — interaction layer
   Vanilla JS. No dependencies. No build step.
   ============================================================ */
(function () {
  'use strict';

  /* ==========================================================
     01 — CONFIG  (edit here, nowhere else)
     ========================================================== */
  var CONFIG = {

    /* Media assets. Relative paths so the site also works in a sub-folder. */
    assets: {
      video: 'assets/tb.mp4',
      audio: 'assets/rb.mp3',
      poster: 'assets/poster.jpg'
    },

    /* Audio. AUDIO_OFFSET is the only value you need to touch
       if the voice needs a slight sync adjustment (seconds). */
    AUDIO_VOLUME: 1.0,
    AUDIO_OFFSET: 0,
    AUDIO_LOOP: false,

    /* Keep the video track silent — the voice comes from rb.mp3. */
    VIDEO_MUTED: true,
    VIDEO_LOOP: true,

    /* Contact. Nothing is invented: anything left null / empty is
       simply not rendered. Fill in real values only. */
    contact: {
      /* Where the "START A PROJECT" button points.
         Examples:  'mailto:name@example.com'  |  'https://t.me/username'  */
      primary: null,

      /* Optional extra channels, rendered as small editorial links.
         Example entry: { label: 'TELEGRAM', href: 'https://t.me/username' } */
      channels: []
    }
  };

  var AUDIO_VOLUME = CONFIG.AUDIO_VOLUME;
  var AUDIO_OFFSET = CONFIG.AUDIO_OFFSET;

  /* ==========================================================
     02 — UTILITIES
     ========================================================== */
  var doc = document;
  var win = window;
  var mqReduce = win.matchMedia('(prefers-reduced-motion: reduce)');
  var mqFine = win.matchMedia('(hover: hover) and (pointer: fine)');
  var reduced = function () { return mqReduce.matches; };

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  function safe(fn) { try { fn(); } catch (e) { /* never break the page */ } }

  /* ==========================================================
     03 — HERO MEDIA SYSTEM
     Video  : tb.mp4  (visual, muted, loops)
     Audio  : rb.mp3  (voice, full volume, plays once)
     Starts on the FIRST genuine user gesture. No prompts, no UI.
     ========================================================== */
  var heroVideo = $('#heroVideo');
  var heroPanel = $('#heroPanel');
  var heroSource = heroVideo ? heroVideo.querySelector('source') : null;

  var heroAudio = new Audio(CONFIG.assets.audio);
  heroAudio.loop = CONFIG.AUDIO_LOOP;
  heroAudio.preload = 'none';          // loaded on first gesture, not on page load
  heroAudio.volume = AUDIO_VOLUME;

  var experienceStarted = false;
  var GESTURES = ['pointerdown', 'touchstart', 'click', 'keydown'];

  function markVideoUnavailable() {
    if (heroPanel) heroPanel.classList.add('no-video');
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[TechBooster] Hero video not found at "' + CONFIG.assets.video +
        '". Upload the file to /assets/ — the page keeps working without it.');
    }
  }

  if (heroVideo) {
    heroVideo.addEventListener('error', markVideoUnavailable);
    heroVideo.addEventListener('loadedmetadata', function () {
      if (!heroVideo.videoWidth) markVideoUnavailable();
    });
  }
  if (heroSource) heroSource.addEventListener('error', markVideoUnavailable);

  /* Audio failures are swallowed silently — no alerts, no error screens. */
  heroAudio.addEventListener('error', function () {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[TechBooster] Hero audio not found at "' + CONFIG.assets.audio + '".');
    }
  });

  function playMedia(el, resetTo) {
    if (!el) return;
    safe(function () {
      if (typeof resetTo === 'number' && isFinite(resetTo)) el.currentTime = resetTo;
    });
    safe(function () {
      var p = el.play();
      if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay policy — ignore */ });
    });
  }

  function startExperience() {
    if (experienceStarted) return;
    experienceStarted = true;

    if (heroVideo) {
      heroVideo.muted = CONFIG.VIDEO_MUTED;
      heroVideo.loop = CONFIG.VIDEO_LOOP;
      playMedia(heroVideo, 0);
    }

    heroAudio.volume = AUDIO_VOLUME;
    heroAudio.loop = CONFIG.AUDIO_LOOP;
    playMedia(heroAudio, AUDIO_OFFSET);

    removeExperienceListeners();
  }

  function onGesture(e) {
    /* Never block the original interaction — media starts, the click still lands. */
    if (e && e.type === 'keydown' && e.repeat) return;
    startExperience();
  }

  function removeExperienceListeners() {
    GESTURES.forEach(function (g) {
      win.removeEventListener(g, onGesture, true);
    });
  }

  GESTURES.forEach(function (g) {
    win.addEventListener(g, onGesture, { capture: true, passive: true });
  });

  /* ==========================================================
     04 — REVEALS
     ========================================================== */
  function initReveals() {
    var items = $$('.reveal:not(.reveal-hero), [data-fade]');

    if (!('IntersectionObserver' in win) || reduced()) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var pending = items.slice();
    var io = null;

    function done(el) {
      el.classList.add('is-in');
      if (io) io.unobserve(el);
      var i = pending.indexOf(el);
      if (i > -1) pending.splice(i, 1);
    }

    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) done(entry.target); });
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });

    items.forEach(function (el) { io.observe(el); });

    /* Safety net: an IntersectionObserver can miss elements during a very fast
       scroll or an instant anchor jump. Anything already scrolled past must
       never be left invisible. */
    function sweep() {
      var limit = win.innerHeight * 0.94;
      for (var i = pending.length - 1; i >= 0; i--) {
        if (pending[i].getBoundingClientRect().top <= limit) done(pending[i]);
      }
    }
    onScroll(sweep);
    win.setTimeout(sweep, 500);
  }

  /* Hero reveals run on the boot timeline instead of on scroll. */
  function initHeroReveal() {
    var heroTitle = $('#heroTitle');
    if (!heroTitle) return;
    var delay = reduced() ? 0 : 1000;
    win.setTimeout(function () { heroTitle.classList.add('is-in'); }, delay);
  }

  /* ==========================================================
     05 — CHAPTER TRACKING (rail + HUD counter)
     ========================================================== */
  function initChapters() {
    var chapters = $$('[data-chapter]');
    var railLinks = $$('.rail a[data-rail]');
    var hudChapter = $('#hudChapter');
    if (!chapters.length) return;

    var current = '';

    function paint(id) {
      if (id === current) return;
      current = id;
      if (hudChapter) hudChapter.textContent = id;
      railLinks.forEach(function (a) {
        var on = a.getAttribute('data-rail') === id;
        a.classList.toggle('is-active', on);
        if (on) { a.setAttribute('aria-current', 'true'); } else { a.removeAttribute('aria-current'); }
      });
    }

    function update() {
      var line = win.innerHeight * 0.42;
      var active = chapters[0];
      for (var i = 0; i < chapters.length; i++) {
        if (chapters[i].getBoundingClientRect().top <= line) active = chapters[i];
      }
      if (active) paint(active.getAttribute('data-chapter'));
    }

    if ('IntersectionObserver' in win) {
      var io = new IntersectionObserver(update, { rootMargin: '-40% 0px -40% 0px', threshold: 0 });
      chapters.forEach(function (ch) { io.observe(ch); });
    }
    onScroll(update);
    update();
  }

  /* ==========================================================
     06 — SCROLL LOOP (progress bar + topbar state)
     ========================================================== */
  var scrollHandlers = [];
  var ticking = false;

  function onScroll(fn) { scrollHandlers.push(fn); }

  function runScroll() {
    ticking = false;
    for (var i = 0; i < scrollHandlers.length; i++) safe(scrollHandlers[i]);
  }

  function requestScroll() {
    if (ticking) return;
    ticking = true;
    win.requestAnimationFrame(runScroll);
  }

  win.addEventListener('scroll', requestScroll, { passive: true });
  win.addEventListener('resize', requestScroll);

  function initScrollUI() {
    var bar = $('#progressBar');
    var topbar = $('#topbar');
    var lastState = null;

    onScroll(function () {
      var h = doc.documentElement.scrollHeight - win.innerHeight;
      var p = h > 0 ? (win.scrollY || doc.documentElement.scrollTop || 0) / h : 0;
      if (bar) bar.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(2) + '%';

      if (topbar) {
        var scrolled = (win.scrollY || 0) > 40;
        if (scrolled !== lastState) {
          topbar.classList.toggle('is-scrolled', scrolled);
          lastState = scrolled;
        }
      }
    });
  }

  /* ==========================================================
     07 — CUSTOM CURSOR (fine pointers only)
     ========================================================== */
  function initCursor() {
    if (!mqFine.matches || reduced()) return;

    var dot = $('#cursorDot');
    var ring = $('#cursorRing');
    if (!dot || !ring) return;

    doc.documentElement.classList.add('has-cursor');

    var tx = 0, ty = 0, rx = 0, ry = 0, visible = false, active = true;

    win.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!visible) {
        visible = true;
        rx = tx; ry = ty;
        dot.classList.add('is-on');
        ring.classList.add('is-on');
      }
    }, { passive: true });

    doc.addEventListener('pointerleave', function () {
      dot.classList.remove('is-on');
      ring.classList.remove('is-on');
      visible = false;
    });

    doc.addEventListener('pointerdown', function () { ring.style.transform = scaleRing(0.86); });
    doc.addEventListener('pointerup', function () { ring.style.transform = scaleRing(1); });

    function scaleRing(v) {
      return 'translate3d(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px,0) scale(' + v + ')';
    }

    function setState(state) {
      ring.classList.toggle('is-link', state === 'link');
      ring.classList.toggle('is-project', state === 'project');
    }

    doc.addEventListener('pointerover', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-cursor], a, button') : null;
      if (!t) { setState(''); return; }
      var explicit = t.getAttribute('data-cursor');
      if (explicit) setState(explicit);
      else setState('link');
    });

    function frame() {
      if (active) {
        rx += (tx - rx) * 0.18;
        ry += (ty - ry) * 0.18;
        dot.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0)';
        ring.style.transform = 'translate3d(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px,0)';
      }
      win.requestAnimationFrame(frame);
    }

    doc.addEventListener('visibilitychange', function () { active = !doc.hidden; });
    frame();
  }

  /* ==========================================================
     08 — MOBILE MENU
     ========================================================== */
  function initMenu() {
    var btn = $('#menuBtn');
    var menu = $('#mobileMenu');
    if (!btn || !menu) return;

    var links = $$('a', menu);
    links.forEach(function (a, i) { a.style.setProperty('--i', i); });

    function open() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      doc.body.style.overflow = 'hidden';
      win.requestAnimationFrame(function () {
        win.requestAnimationFrame(function () { menu.classList.add('is-open'); });
      });
      if (links[0]) links[0].focus({ preventScroll: true });
    }

    function close(refocus) {
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      doc.body.style.overflow = '';
      win.setTimeout(function () {
        if (!menu.classList.contains('is-open')) menu.hidden = true;
      }, reduced() ? 0 : 420);
      if (refocus) btn.focus({ preventScroll: true });
    }

    function toggle() { menu.classList.contains('is-open') ? close(true) : open(); }

    btn.addEventListener('click', toggle);
    links.forEach(function (a) { a.addEventListener('click', function () { close(false); }); });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) close(true);
    });
  }

  /* ==========================================================
     09 — CONTACT (renders only real, configured channels)
     ========================================================== */
  function initContact() {
    var wrap = $('#contactLinks');
    var cta = $('#projectCta');
    var c = CONFIG.contact;
    if (!wrap) return;

    if (cta && c.primary) {
      cta.setAttribute('href', c.primary);
      if (!/^#/.test(c.primary)) {
        cta.setAttribute('target', '_blank');
        cta.setAttribute('rel', 'noopener noreferrer');
      }
    }

    var list = (c.channels || []).filter(function (ch) { return ch && ch.href && ch.label; });

    if (!list.length) {
      var note = doc.createElement('p');
      note.className = 'contact-empty';
      note.textContent = 'DIRECT CONTACT CHANNELS NOT PUBLISHED YET';
      wrap.appendChild(note);
      return;
    }

    list.forEach(function (ch) {
      var a = doc.createElement('a');
      a.href = ch.href;
      a.setAttribute('data-cursor', 'link');
      if (!/^(mailto:|tel:|#)/.test(ch.href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
      a.innerHTML = '<svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">' +
        '<circle cx="5" cy="5" r="2" fill="currentColor"/></svg><span></span>';
      a.querySelector('span').textContent = ch.label;
      wrap.appendChild(a);
    });
  }

  /* ==========================================================
     10 — SMOOTH ANCHORS (keeps the native action intact)
     ========================================================== */
  function initAnchors() {
    doc.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var id = a.getAttribute('href');
      if (!id || id === '#' || id.length < 2) return;
      var target = doc.querySelector(id);
      if (!target) return;
      e.preventDefault();
      startExperience();          // media first…
      target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      win.history.replaceState(null, '', id);
      if (target.getAttribute('tabindex') === null) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  /* ==========================================================
     11 — BOOT SEQUENCE
     ========================================================== */
  function initBoot() {
    if (reduced()) { doc.body.classList.add('is-ready'); return; }
    win.requestAnimationFrame(function () {
      win.requestAnimationFrame(function () { doc.body.classList.add('is-ready'); });
    });
  }

  /* ==========================================================
     12 — INIT
     ========================================================== */
  function init() {
    initReveals();
    initHeroReveal();
    initChapters();
    initScrollUI();
    initCursor();
    initMenu();
    initContact();
    initAnchors();
    initBoot();
    runScroll();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

  /* Live-tweak hook while developing: window.TB_CONFIG */
  win.TB_CONFIG = CONFIG;
})();
