// Fruit Pop Blast · página de download.
// 1) Lê a versão mais recente (release.json, gerado no deploy; se faltar, a API pública do GitHub).
// 2) Moranguinho: a mesma animação de vitória do app (atlas do sprite-gen, tempos de mascotAnimations.ts).
// 3) Demonstração do tabuleiro 7x7: duas jogadas que fecham uma linha e depois coluna + duas linhas.
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

  /* ---------------- Versão mais recente ---------------- */

  const repo = document.documentElement.dataset.repo;
  const download = $('#baixar');
  const cta = $('#cta');
  const slot = (name) => $(`[data-slot="${name}"]`);

  const fmtSize = (bytes) => `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  async function fromReleaseJson() {
    const res = await fetch('release.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`release.json ${res.status}`);
    const r = await res.json();
    if (!r.apkUrl) throw new Error('release.json sem apkUrl');
    return r;
  }

  async function fromGitHubApi() {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const r = await res.json();
    const apk = (r.assets || []).find((a) => a.name.endsWith('.apk'));
    if (!apk) throw new Error('release sem APK');
    const m = /^v?(.+?)-build(\d+)$/.exec(r.tag_name) || [];
    return {
      version: m[1] || r.tag_name,
      build: m[2] ? Number(m[2]) : null,
      publishedAt: r.published_at,
      size: apk.size,
      apkName: apk.name,
      apkUrl: apk.browser_download_url,
      releasesUrl: `https://github.com/${repo}/releases`,
    };
  }

  function renderRelease(r) {
    cta.href = r.apkUrl;
    cta.setAttribute('download', r.apkName || '');
    document.querySelectorAll('[data-cta-mirror]').forEach((a) => {
      a.href = r.apkUrl;
      a.setAttribute('download', r.apkName || '');
    });
    const parts = [`Versão ${r.version}`];
    if (r.build) parts.push(`build ${r.build}`);
    if (r.size) parts.push(fmtSize(r.size));
    slot('line').textContent = parts.join(' · ');
    slot('date').textContent = r.publishedAt ? `Publicada em ${fmtDate(r.publishedAt)}` : '';
    slot('footer-version').textContent = ` · versão ${r.version}${r.build ? ` (build ${r.build})` : ''}`;
    if (r.releasesUrl) {
      slot('all-link').href = r.releasesUrl;
      slot('all').hidden = false;
    }
    download.dataset.state = 'ready';
  }

  function renderError() {
    download.dataset.state = 'error';
    slot('line').textContent = 'Não deu para buscar a versão agora.';
    slot('date').textContent = 'Recarregue a página em instantes.';
    cta.removeAttribute('href');
    cta.setAttribute('aria-disabled', 'true');
  }

  (async () => {
    try {
      renderRelease(await fromReleaseJson());
    } catch {
      try {
        renderRelease(await fromGitHubApi());
      } catch {
        renderError();
      }
    }
  })();

  /* QR code para quem abriu no computador (o APK só instala no Android). */
  const qrBox = $('#qr');
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (!isAndroid && window.matchMedia('(min-width: 900px)').matches) {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    s.async = true;
    s.onload = () => {
      try {
        const qr = window.qrcode(0, 'M');
        qr.addData(location.href.split('#')[0]);
        qr.make();
        slot('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
        qrBox.hidden = false;
      } catch {
        /* sem QR, a página continua igual */
      }
    };
    document.head.appendChild(s);
  }

  /* ---------------- Moranguinho ---------------- */

  const mascot = $('#mascot');
  // Mesmos quadros e tempos do clipe "victory" do app (src/config/mascotAnimations.ts).
  const ROWS = { victory_a: 0, victory_b: 1, happy_idle: 2 };
  const INTRO = [
    ['victory_a', 0, 220], ['victory_a', 1, 220], ['victory_a', 2, 140], ['victory_a', 3, 260],
    ['victory_b', 0, 280], ['victory_b', 1, 220], ['victory_b', 2, 280],
  ];
  const LIFT = [[0, 0], [440, 0], [580, 0.55], [840, 1], [1120, 0.55], [1340, 0], [1480, 0.14], [1620, 0]];
  let jumping = false;

  const setFrame = (state, index) => {
    mascot.style.backgroundPosition = `calc(var(--cell) * ${-index}) calc(var(--cell) * ${-ROWS[state]})`;
  };

  function jump() {
    if (!mascot || jumping || reduceMotion) return;
    jumping = true;
    const total = INTRO.reduce((s, f) => s + f[2], 0);
    const amp = mascot.offsetHeight * 0.16;
    mascot.animate(
      LIFT.map(([t, v]) => ({ offset: Math.min(t / total, 1), transform: `translateY(${-v * amp}px)` })),
      { duration: total, easing: 'ease-in-out' },
    );
    let t = 0;
    INTRO.forEach(([state, i, ms]) => {
      setTimeout(() => setFrame(state, i), t);
      t += ms;
    });
    setTimeout(() => {
      setFrame('happy_idle', 0);
      jumping = false;
    }, t);
  }

  if (mascot) {
    setFrame('happy_idle', 0);
    if (!reduceMotion) {
      mascot.animate([{ transform: 'scale(1, 1)' }, { transform: 'scale(1.02, 0.975)' }, { transform: 'scale(1, 1)' }], {
        duration: 2600, iterations: Infinity, easing: 'ease-in-out', composite: 'add',
      });
      setTimeout(jump, 900);
    }
    cta.addEventListener('click', jump);
    document.querySelectorAll('[data-cta-mirror]').forEach((a) => a.addEventListener('click', jump));
    mascot.addEventListener('pointerenter', jump);
  }

  /* ---------------- Demonstração do tabuleiro ---------------- */

  const FRUIT = { S: 'strawberry', W: 'watermelon', G: 'grape', K: 'kiwi', B: 'blueberry', O: 'orange', L: 'lemon' };
  const START = [
    '...S...',
    '...OG..',
    '.K.WG..',
    'BK.SO..',
    'SSW..SL',
    'OLS.KSB',
    'WGB.SOK',
  ];
  // Peças dos 12 formatos do jogo: Linha de 2 (deitada), Linha de 3 (em pé) e Quadrado 2x2 (fica na bandeja).
  const PIECES = [
    { cells: [[0, 0, 'S'], [1, 0, 'S']], at: [3, 4] },
    { cells: [[0, 0, 'S'], [0, 1, 'L'], [0, 2, 'S']], at: [3, 4] },
    { cells: [[0, 0, 'G'], [1, 0, 'B'], [0, 1, 'K'], [1, 1, 'O']], at: null },
  ];

  const boardEl = $('#board');
  const grid = slot('grid');
  const fx = slot('fx');
  const toast = slot('toast');
  const tray = slot('tray');
  const goalEl = slot('goal');
  const scoreEl = slot('score');
  const goalPill = $('.hud__goal');
  if (!boardEl) return;

  const tileImg = (f) => {
    const img = new Image();
    img.src = `assets/fruit-${FRUIT[f]}.webp`;
    img.alt = '';
    img.width = 144;
    img.height = 144;
    return img;
  };

  let board, cellsEl, goal, score;

  function buildBoard() {
    grid.replaceChildren();
    cellsEl = [];
    board = START.map((row) => row.split('').map((ch) => (ch === '.' ? null : ch)));
    for (let y = 0; y < 7; y++) {
      cellsEl.push([]);
      for (let x = 0; x < 7; x++) {
        const c = document.createElement('div');
        c.className = 'cell';
        if (board[y][x]) {
          const t = tileImg(board[y][x]);
          t.className = 'tile';
          c.append(t);
        }
        grid.append(c);
        cellsEl[y].push(c);
      }
    }
    tray.replaceChildren();
    PIECES.forEach((p, i) => {
      const s = document.createElement('div');
      s.className = 'slot';
      const el = pieceEl(p, 'piece');
      el.dataset.index = i;
      s.append(el);
      tray.append(s);
    });
    goal = 0;
    score = 0;
    goalEl.textContent = '0';
    scoreEl.textContent = '0';
    goalPill.classList.remove('is-done');
  }

  function pieceEl(p, cls) {
    const el = document.createElement('div');
    el.className = cls;
    p.cells.forEach(([x, y, f]) => {
      const img = tileImg(f);
      img.style.gridColumn = x + 1;
      img.style.gridRow = y + 1;
      el.append(img);
    });
    return el;
  }

  const rectIn = (el) => {
    const a = el.getBoundingClientRect();
    const b = boardEl.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  };

  function countUp(el, from, to, ms) {
    const start = performance.now();
    const tick = (now) => {
      const k = Math.min((now - start) / ms, 1);
      el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function burst(x, y) {
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('i');
      s.className = 'spark';
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      fx.append(s);
      const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.6;
      const d = 22 + Math.random() * 26;
      s.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(0.2)`, opacity: 0 },
        ],
        { duration: 620, easing: EASE_OUT },
      ).onfinish = () => s.remove();
    }
  }

  async function showToast(text) {
    toast.textContent = text;
    await toast.animate(
      [
        { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1.06, offset: 0.25 },
        { opacity: 1, scale: 1, offset: 0.4 },
        { opacity: 1, scale: 1, offset: 0.8 },
        { opacity: 0, scale: 0.9 },
      ],
      { duration: 1500, easing: EASE_OUT },
    ).finished;
  }

  async function play(i) {
    const p = PIECES[i];
    const src = tray.querySelector(`.piece[data-index="${i}"]`);
    src.classList.add('is-lifted');
    await sleep(420);

    // Destaca onde a peça vai cair.
    const [ax, ay] = p.at;
    const targets = p.cells.map(([x, y]) => cellsEl[ay + y][ax + x]);
    const from = rectIn(src);
    const to = rectIn(targets[0]);

    const flyer = pieceEl(p, 'flyer');
    boardEl.append(flyer);
    const scale = from.w / flyer.getBoundingClientRect().width;
    src.classList.add('is-gone');
    targets.forEach((c) => c.classList.add('is-target'));
    await flyer.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) scale(${scale})` },
        { transform: `translate(${(from.x + to.x) / 2}px, ${Math.min(from.y, to.y) - 40}px) scale(${(scale + 1) / 2 + 0.08})`, offset: 0.55 },
        { transform: `translate(${to.x}px, ${to.y}px) scale(1)` },
      ],
      { duration: 900, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' },
    ).finished;

    // Encaixa: as frutas passam a ser do tabuleiro.
    flyer.remove();
    p.cells.forEach(([x, y, f], k) => {
      board[ay + y][ax + x] = f;
      const t = tileImg(f);
      t.className = 'tile';
      targets[k].classList.remove('is-target');
      targets[k].append(t);
      t.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260, easing: EASE_OUT });
    });
    countUp(scoreEl, score, score + p.cells.length, 300);
    score += p.cells.length;
    await sleep(320);

    // Linhas e colunas completas (uma célula no cruzamento conta uma vez só).
    const full = new Set();
    let lines = 0;
    for (let y = 0; y < 7; y++) if (board[y].every(Boolean)) { lines++; for (let x = 0; x < 7; x++) full.add(`${x},${y}`); }
    for (let x = 0; x < 7; x++) if (board.every((r) => r[x])) { lines++; for (let y = 0; y < 7; y++) full.add(`${x},${y}`); }
    if (!lines) return;

    const cx = ax + 0.5;
    const cy = ay + 0.5;
    const list = [...full].map((k) => k.split(',').map(Number));
    let berries = 0;
    await Promise.all(
      list.map(async ([x, y]) => {
        if (board[y][x] === 'S') berries++;
        board[y][x] = null;
        const c = cellsEl[y][x];
        const t = c.querySelector('.tile');
        await sleep(Math.hypot(x - cx, y - cy) * 55);
        const r = rectIn(c);
        burst(r.x + r.w / 2, r.y + r.h / 2);
        await t.animate(
          [
            { transform: 'scale(1)', filter: 'brightness(1)' },
            { transform: 'scale(1.22)', filter: 'brightness(1.45)', offset: 0.35 },
            { transform: 'scale(0)', filter: 'brightness(1.8)', opacity: 0 },
          ],
          { duration: 430, easing: EASE_OUT, fill: 'forwards' },
        ).finished;
        t.remove();
      }),
    );
    const gained = list.length * 10 * lines;
    countUp(scoreEl, score, score + gained, 700);
    score += gained;
    countUp(goalEl, goal, Math.min(goal + berries, 12), 500);
    goal = Math.min(goal + berries, 12);
    goalPill.animate([{ scale: 1 }, { scale: 1.15 }, { scale: 1 }], { duration: 420, easing: EASE_OUT });
    if (lines > 1) await showToast(`Combo x${lines}!`);
  }

  let running = false;
  async function loop() {
    if (running) return;
    running = true;
    while (visible) {
      buildBoard();
      grid.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 500, easing: EASE_OUT });
      await sleep(1200);
      await play(0);
      await sleep(700);
      await play(1);
      if (goal >= 12) {
        goalPill.classList.add('is-done');
        await showToast('Objetivo completo!');
      }
      await sleep(1600);
    }
    running = false;
  }

  let visible = false;
  buildBoard();
  if (reduceMotion) return;
  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) loop();
    },
    { threshold: 0.35 },
  ).observe(boardEl);
})();
