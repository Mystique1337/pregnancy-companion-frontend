/* Bumply pitch deck — navigation, hero scene, count-up stats, charts.
   Charts follow the dataviz rules: one axis, legend whenever there are ≥2 series,
   direct labels, thin marks, recessive grid, validated colour-blind-safe palette
   with separate steps for the dark surface. */

const CSSV = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C1 = () => CSSV("--c1"), C2 = () => CSSV("--c2"), C3 = () => CSSV("--c3");
const C1D = () => CSSV("--c1d"), C2D = () => CSSV("--c2d"), C3D = () => CSSV("--c3d");
const INKMUT = () => CSSV("--ink-muted");
const FONT = "DM Sans, system-ui, sans-serif";
const isExport = () => document.body.classList.contains("export");

/* ----------------------------- navigation ----------------------------- */
const slides = [...document.querySelectorAll(".slide")];
slides.forEach((s, i) => s.setAttribute("data-index", i));
let cur = 0;

function fit() {
  const d = document.getElementById("deck");
  if (document.body.classList.contains("print")) return;
  const w = innerWidth, h = innerHeight;
  const s = Math.min(w / 1600, h / 900);
  // scale from the top-left, then translate by the leftover space to centre.
  // (Grid/flex centring clips when the item is wider than its container.)
  d.style.transform = `translate(${(w - 1600 * s) / 2}px, ${(h - 900 * s) / 2}px) scale(${s})`;
}

function goto(n) {
  const prev = cur;
  cur = Math.max(0, Math.min(slides.length - 1, n));
  // Direction drives the transition: +1 travelling forward, -1 back. Set on
  // every slide so the outgoing one leaves the way the incoming one arrives.
  const dir = cur >= prev ? 1 : -1;
  slides.forEach((s, i) => {
    s.style.setProperty("--dir", i === cur ? String(dir) : String(-dir));
    s.classList.toggle("active", i === cur);
  });
  [...document.querySelectorAll("#nav button")].forEach((b, i) => b.classList.toggle("on", i === cur));
  const bar = document.getElementById("bar");
  if (bar) bar.style.width = `${((cur + 1) / slides.length) * 100}%`;

  slides.forEach((s, i) => {
    const v = s.querySelector("video");
    if (!v) return;
    if (i !== cur) { v.pause(); return; }
    // In export we only ever get a still, so park on a representative frame
    // rather than whatever the transition happens to land on.
    if (isExport()) { v.pause(); v.currentTime = 25; return; }
    v.currentTime = 0;
    playDemo();
  });

  countUp(slides[cur]);
  history.replaceState(null, "", `#${cur + 1}`);
}
window.__goto = goto;
window.__printMode = () => {
  document.body.classList.add("print", "export");
  slides.forEach((s) => { s.classList.add("active"); countUp(s, true); });
  document.querySelectorAll("video").forEach((v) => { v.pause(); v.currentTime = 25; });
};

addEventListener("keydown", (e) => {
  if (["ArrowRight", "PageDown", " ", "n"].includes(e.key)) { e.preventDefault(); goto(cur + 1); }
  if (["ArrowLeft", "PageUp", "p"].includes(e.key)) { e.preventDefault(); goto(cur - 1); }
  if (e.key === "Home") goto(0);
  if (e.key === "End") goto(slides.length - 1);
});
addEventListener("resize", fit);

/* --------------------- count-up on the big numbers ---------------------
   The number is the visualisation on several slides; animating it on entry
   earns a beat of attention without adding a single word. */
function countUp(slide, instant = false) {
  slide.querySelectorAll("[data-count]").forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    const dec = el.dataset.fmt === "int" ? 0 : (String(target).split(".")[1] || "").length;
    const fmt = (v) =>
      (el.dataset.fmt === "int" ? Math.round(v).toLocaleString("en-US") : v.toFixed(dec)) + suffix;
    if (instant || isExport() || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = fmt(target); return;
    }
    const t0 = performance.now(), dur = 1000;
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  });
}

/* ------------------------- hero scene (three.js) -------------------------
   A slowly turning sphere of points over the title photograph: every point is
   a mother the network reaches. Deliberately quiet — it must never compete
   with the wordmark or the faces underneath it. */
function initHero() {
  const canvas = document.getElementById("hero3d");
  if (!canvas || typeof THREE === "undefined") return;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(1000, 1000, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.z = 7.2;

  // Fibonacci sphere → even coverage, no clustering at the poles.
  const N = 2000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const warm = new THREE.Color("#E0906A"), gold = new THREE.Color("#E8B96F"), cream = new THREE.Color("#FBF7F1");
  const gr = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = gr * i, R = 2.7;
    pos[i * 3] = Math.cos(th) * r * R;
    pos[i * 3 + 1] = y * R;
    pos[i * 3 + 2] = Math.sin(th) * r * R;
    const t = (i * 2654435761 % 1000) / 1000; // deterministic, so exports are stable
    const c = t > 0.86 ? gold : t > 0.5 ? cream : warm;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.042, vertexColors: true, transparent: true, opacity: 0.92,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(points);

  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.72, 1)),
    new THREE.LineBasicMaterial({ color: 0xE0906A, transparent: true, opacity: 0.14 })
  );
  scene.add(shell);

  let t = 0;
  (function loop() {
    requestAnimationFrame(loop);
    t += 0.002;
    points.rotation.y = t; points.rotation.x = Math.sin(t * 0.5) * 0.15;
    shell.rotation.y = -t * 0.55; shell.rotation.x = Math.sin(t * 0.4) * 0.1;
    renderer.render(scene, camera);
  })();
}

/* ------------------------------- charts ------------------------------- */
const grid = (dark) => ({ color: dark ? "rgba(255,255,255,.10)" : "rgba(46,38,32,.08)", drawTicks: false });
const ticks = (dark, size = 17) => ({
  color: dark ? "rgba(255,255,255,.66)" : INKMUT(),
  font: { family: FONT, size, weight: "500" },
  padding: 8,
});

function chartSensitivity() {
  const el = document.getElementById("c-sens");
  if (!el) return;
  // Two series → legend mandatory, and both are directly labelled.
  new Chart(el, {
    type: "bar",
    data: {
      labels: ["English", "Pidgin", "Yorùbá", "Hausa", "Igbo"],
      datasets: [
        { label: "Before", data: [77.8, 89.3, 33.3, 58.3, 44.4], backgroundColor: "rgba(46,38,32,.15)", borderRadius: 4, barPercentage: 0.74, categoryPercentage: 0.72 },
        { label: "After (shipped)", data: [100, 100, 100, 100, 100], backgroundColor: C1(), borderRadius: 4, barPercentage: 0.74, categoryPercentage: 0.72 },
      ],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      animation: { duration: isExport() ? 0 : 850 },
      layout: { padding: { right: 54 } },
      plugins: {
        legend: { position: "top", align: "start", labels: { boxWidth: 11, boxHeight: 11, usePointStyle: true, pointStyle: "circle", font: { family: FONT, size: 17 }, color: INKMUT(), padding: 16 } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.x}% sensitivity` } },
      },
      scales: {
        x: { min: 0, max: 100, grid: grid(false), border: { display: false }, ticks: { ...ticks(false, 15), callback: (v) => v + "%" } },
        y: { grid: { display: false }, border: { display: false }, ticks: ticks(false, 20) },
      },
    },
    plugins: [{
      id: "endLabels",
      afterDatasetsDraw(c) {
        const ctx = c.ctx;
        c.data.datasets.forEach((ds, di) => {
          c.getDatasetMeta(di).data.forEach((bar, i) => {
            ctx.save();
            ctx.font = `${di === 1 ? 700 : 500} 16px ${FONT}`;
            ctx.fillStyle = di === 1 ? C1() : INKMUT();
            ctx.textBaseline = "middle";
            ctx.fillText(ds.data[i] + "%", bar.x + 9, bar.y);
            ctx.restore();
          });
        });
      },
    }],
  });
}

function chartCost() {
  const el = document.getElementById("c-cost");
  if (!el) return;
  // Two series, so a legend is required and both are directly labelled. The gap
  // between the lines IS the argument: it is the cost of keeping a human in it.
  new Chart(el, {
    type: "line",
    data: {
      labels: ["100", "1,000", "10,000", "100,000"],
      datasets: [
        { label: "Fully loaded", data: [6393, 1485, 425, 172],
          borderColor: CSSV("--gold"), backgroundColor: "rgba(232,185,111,.12)",
          borderWidth: 2.5, fill: true, tension: 0.34,
          pointRadius: 5, pointBackgroundColor: CSSV("--gold"), pointBorderColor: "#231D18", pointBorderWidth: 2 },
        { label: "Technology only", data: [1393, 500, 240, 80],
          borderColor: C1D(), backgroundColor: "transparent",
          borderWidth: 2, borderDash: [6, 4], fill: false, tension: 0.34,
          pointRadius: 4, pointBackgroundColor: C1D(), pointBorderColor: "#231D18", pointBorderWidth: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: isExport() ? 0 : 900 },
      layout: { padding: { top: 26, right: 22 } },
      plugins: {
        legend: { position: "top", align: "start",
          labels: { boxWidth: 11, boxHeight: 11, usePointStyle: true, pointStyle: "circle",
                    font: { family: FONT, size: 16 }, color: "rgba(255,255,255,.72)", padding: 14 } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: \u20A6${c.parsed.y.toLocaleString()}` } },
      },
      scales: {
        y: { type: "logarithmic", min: 50, max: 8000, grid: grid(true), border: { display: false },
             afterBuildTicks: (a) => { a.ticks = [100, 1000, 5000].map((value) => ({ value })); },
             ticks: { ...ticks(true, 14), autoSkip: false, callback: (v) => "\u20A6" + v.toLocaleString() } },
        x: { grid: { display: false }, border: { display: false }, ticks: ticks(true, 16),
             title: { display: true, text: "mothers served", color: "rgba(255,255,255,.5)", font: { family: FONT, size: 14 } } },
      },
    },
    plugins: [{
      id: "ptLabels",
      afterDatasetsDraw(c) {
        const ctx = c.ctx;
        [0, 1].forEach((di) => {
          const meta = c.getDatasetMeta(di);
          [2, 3].forEach((i) => {
            const pt = meta.data[i]; if (!pt) return;
            ctx.save();
            ctx.font = `700 15px ${FONT}`;
            ctx.fillStyle = di === 0 ? CSSV("--gold") : C1D();
            ctx.textAlign = "center";
            ctx.fillText("\u20A6" + c.data.datasets[di].data[i].toLocaleString(), pt.x, pt.y - 13);
            ctx.restore();
          });
        });
      },
    }],
  });
}

function chartMarket() {
  const el = document.getElementById("c-market");
  if (!el) return;
  new Chart(el, {
    type: "bar",
    data: {
      labels: ["TAM", "SAM", "SOM"],
      datasets: [{
        label: "mothers",
        data: [4500000, 1800000, 90000],
        backgroundColor: [C2(), C3(), C1()],
        borderRadius: 4, barPercentage: 0.6,
      }],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      animation: { duration: isExport() ? 0 : 800 },
      layout: { padding: { right: 215 } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.x.toLocaleString()} mothers` } } },
      scales: {
        // Three orders of magnitude: decade ticks carry the scale, direct labels
        // carry the values. A full log tick set is unreadable noise.
        x: {
          type: "logarithmic", min: 5e4, max: 1e7,
          grid: grid(false), border: { display: false },
          afterBuildTicks: (a) => { a.ticks = [1e5, 1e6, 1e7].map((value) => ({ value })); },
          ticks: { ...ticks(false, 15), autoSkip: false, callback: (v) => (v >= 1e6 ? v / 1e6 + "M" : v / 1e3 + "k") },
        },
        y: { grid: { display: false }, border: { display: false }, ticks: ticks(false, 22) },
      },
    },
    plugins: [{
      id: "mLabels",
      afterDatasetsDraw(c) {
        const ctx = c.ctx, txt = ["4.5M reachable mothers", "1.8M in states with budgets", "90k in 3 yrs"];
        c.getDatasetMeta(0).data.forEach((bar, i) => {
          ctx.save(); ctx.font = `600 17px ${FONT}`; ctx.fillStyle = INKMUT(); ctx.textBaseline = "middle";
          ctx.fillText(txt[i], bar.x + 12, bar.y); ctx.restore();
        });
      },
    }],
  });
}


function chartFunds() {
  const el = document.getElementById("c-funds");
  if (!el) return;
  // Share of the round, per the funding strategy's allocation bands. Labour is
  // the largest block once clinical and frontline staffing are counted together.
  const rows = [
    ["Clinical & frontline staffing", 24],
    ["AI compute & infrastructure", 22],
    ["Pilot implementation & M&E", 20],
    ["Engineering & product", 14],
    ["SMS / USSD / IVR channels", 10],
    ["Security, privacy & compliance", 6],
    ["Partnerships & contingency", 4],
  ];
  // One series, one axis, direct labels: no legend needed, the title names it.
  new Chart(el, {
    type: "bar",
    data: {
      labels: rows.map((r) => r[0]),
      datasets: [{
        data: rows.map((r) => r[1]),
        backgroundColor: rows.map((_, i) => (i === 0 ? CSSV("--gold") : "rgba(224,144,106,.75)")),
        borderRadius: 4, barPercentage: 0.78, categoryPercentage: 0.82,
      }],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      animation: { duration: isExport() ? 0 : 800 },
      layout: { padding: { right: 92 } },
      plugins: { legend: { display: false },
                 tooltip: { callbacks: { label: (c) => ` ${c.parsed.x}% of the round` } } },
      scales: {
        x: { grid: grid(true), border: { display: false }, ticks: { ...ticks(true, 14), callback: (v) => v + "%" } },
        y: { grid: { display: false }, border: { display: false }, ticks: ticks(true, 16) },
      },
    },
    plugins: [{
      id: "fundLabels",
      afterDatasetsDraw(c) {
        const ctx = c.ctx;
        c.getDatasetMeta(0).data.forEach((bar, i) => {
          ctx.save();
          ctx.font = `700 15px ${FONT}`;
          ctx.fillStyle = i === 0 ? CSSV("--gold") : "rgba(255,255,255,.82)";
          ctx.textBaseline = "middle";
          ctx.fillText(rows[i][1] + "%", bar.x + 10, bar.y);
          ctx.restore();
        });
      },
    }],
  });
}


function chartCostPerPregnancy() {
  const el = document.getElementById("c-cpp");
  if (!el) return;
  const rows = [
    ["Global apps", 20.00, "rgba(46,38,32,.22)"],
    ["Jacaranda, fully loaded", 2.50, CSSV("--c3")],
    ["Bumply at pilot", 1.44, "rgba(190,90,56,.55)"],
    ["Bumply at scale", 0.48, CSSV("--c1")],
  ];
  // One series, one axis, log scale because the range spans 40x. Direct labels
  // carry the values, so no legend.
  new Chart(el, {
    type: "bar",
    data: { labels: rows.map(r => r[0]), datasets: [{ data: rows.map(r => r[1]),
      backgroundColor: rows.map(r => r[2]), borderRadius: 4, barPercentage: 0.68 }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      animation: { duration: isExport() ? 0 : 800 },
      layout: { padding: { right: 78 } },
      plugins: { legend: { display: false },
                 tooltip: { callbacks: { label: (c) => ` $${c.parsed.x.toFixed(2)} per pregnancy` } } },
      scales: {
        x: { type: "logarithmic", min: 0.3, max: 30, grid: grid(false), border: { display: false },
             afterBuildTicks: (a) => { a.ticks = [0.5, 1, 5, 10, 30].map((value) => ({ value })); },
             ticks: { ...ticks(false, 14), autoSkip: false, callback: (v) => "$" + v } },
        y: { grid: { display: false }, border: { display: false }, ticks: ticks(false, 17) },
      },
    },
    plugins: [{
      id: "cppLabels",
      afterDatasetsDraw(c) {
        const ctx = c.ctx;
        c.getDatasetMeta(0).data.forEach((bar, i) => {
          ctx.save();
          ctx.font = `700 16px ${FONT}`;
          ctx.fillStyle = i === 3 ? C1() : INKMUT();
          ctx.textBaseline = "middle";
          ctx.fillText("$" + rows[i][1].toFixed(2), bar.x + 10, bar.y);
          ctx.restore();
        });
      },
    }],
  });
}


function chartSplit() {
  const el = document.getElementById("c-split");
  if (!el) return;
  const rows = [
    ["Technology", 240, CSSV("--c1")],
    ["CHW stipends", 60, CSSV("--sage")],
    ["Clinical lead", 25, "rgba(110,140,99,.7)"],
    ["Engineering", 60, "rgba(190,90,56,.55)"],
    ["Operations", 25, "rgba(190,90,56,.4)"],
    ["Compliance", 15, "rgba(46,38,32,.28)"],
  ];
  new Chart(el, {
    type: "bar",
    data: { labels: rows.map(r => r[0]), datasets: [{ data: rows.map(r => r[1]),
      backgroundColor: rows.map(r => r[2]), borderRadius: 4, barPercentage: 0.72 }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      animation: { duration: isExport() ? 0 : 800 },
      layout: { padding: { right: 64 } },
      plugins: { legend: { display: false },
                 tooltip: { callbacks: { label: (c) => ` \u20A6${c.parsed.x} per mother per month` } } },
      scales: {
        x: { grid: grid(false), border: { display: false }, ticks: { ...ticks(false, 14), callback: (v) => "\u20A6" + v } },
        y: { grid: { display: false }, border: { display: false }, ticks: ticks(false, 16) },
      },
    },
    plugins: [{
      id: "splitLabels",
      afterDatasetsDraw(c) {
        const ctx = c.ctx;
        c.getDatasetMeta(0).data.forEach((bar, i) => {
          ctx.save(); ctx.font = `700 15px ${FONT}`; ctx.fillStyle = INKMUT(); ctx.textBaseline = "middle";
          ctx.fillText("\u20A6" + rows[i][1], bar.x + 9, bar.y); ctx.restore();
        });
      },
    }],
  });
}


/* ---- warm the demo while the audience is still on slide 1 ----
   The explainer is the single biggest asset in the deck and it sits on slide 7.
   Waiting until then to fetch it means stalling in front of a room on venue
   wifi. Start buffering as soon as the deck opens: by the time anyone reaches
   it, several minutes of presenting have already gone into the download. */
function warmVideo() {
  const v = document.getElementById("demo");
  if (!v || isExport()) return;
  v.preload = "auto";
  try { v.load(); } catch { /* older engines */ }

  // Surface how much is buffered, so the presenter can see whether it is safe
  // to advance rather than finding out live.
  const chip = document.getElementById("soundchip");
  const report = () => {
    if (!chip || !v.duration) return;
    const end = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
    const pct = Math.min(100, Math.round((end / v.duration) * 100));
    chip.dataset.buffered = String(pct);
    if (pct >= 99) v.removeEventListener("progress", report);
  };
  v.addEventListener("progress", report);
  v.addEventListener("loadedmetadata", report);
}

/* ---- layout QA: a slide is a fixed canvas, so spill is silently clipped ---- */
window.__overflow = () =>
  slides.flatMap((s, i) => {
    const body = s.querySelector(".body") || s.querySelector(".overlay");
    if (!body) return [];
    const sr = s.getBoundingClientRect();
    const src = s.querySelector(".src");
    const bottomLimit = src ? src.getBoundingClientRect().top - 6 : sr.bottom - 34;
    const topLimit = sr.top + 58;
    let below = 0, above = 0;
    for (const el of body.children) {
      const r = el.getBoundingClientRect();
      if (!r.height) continue;
      below = Math.max(below, r.bottom - bottomLimit);
      above = Math.max(above, topLimit - r.top);
    }
    const over = Math.round(Math.max(0, below) + Math.max(0, above));
    return over > 2 ? [{ slide: i + 1, overflowPx: over, below: Math.round(below), above: Math.round(above) }] : [];
  });

/* ---- per-item entrance stagger inside any .stagger container ---- */
function wireStagger() {
  document.querySelectorAll(".stagger").forEach((box) => {
    [...box.children].forEach((el, i) => {
      el.classList.add("stg");
      el.style.setProperty("--d", `${0.1 + i * 0.075}s`);
    });
  });
}

/* ---- demo video ----
   The demo is narrated, so it has to reach the room with sound.

   Two things make that unreliable and both are handled here:
   1. A gesture spent on slide 1 does not grant permission to a <video> first
      touched on slide 7, so we unlock the element on the first interaction by
      calling play() on it UNMUTED (at volume 0, so the room hears nothing)
      inside the gesture. Playing it muted grants nothing, which is the trap.
   2. Safari resolves play() and then silently mutes. So we never trust the
      promise: 600ms later we check the clock and the decoded audio counter,
      and if no sound is actually flowing we surface the prompt. */
let audioUnlocked = false;

function demoEl() { return document.getElementById("demo"); }

function unlockAudio() {
  const v = demoEl();
  if (!v || audioUnlocked) return;
  audioUnlocked = true;
  const vol = v.volume;
  v.muted = false;
  v.volume = 0; // silent to the room, but still counts as an unmuted play
  const p = v.play();
  if (p && p.then) {
    p.then(() => { v.pause(); v.currentTime = 0; v.volume = vol; })
     .catch(() => { v.volume = vol; audioUnlocked = false; });
  } else {
    v.volume = vol;
  }
}

function soundState(on) {
  const btn = document.getElementById("playbtn");
  const chip = document.getElementById("soundchip");
  if (btn) btn.classList.toggle("show", !on);
  if (chip) {
    chip.classList.toggle("on", on);
    const t = chip.querySelector(".txt");
    if (t) t.textContent = "LIVE PRODUCT · 37 SECONDS · SOUND " + (on ? "ON" : "OFF");
  }
}

/** Is sound genuinely reaching the speakers right now? */
function audible() {
  const v = demoEl();
  if (!v) return false;
  const bytes = v.webkitAudioDecodedByteCount;
  return !v.paused && !v.muted && v.volume > 0 && (bytes === undefined || bytes > 0);
}

let verifyTimer = null;
function verifySound(label) {
  clearTimeout(verifyTimer);
  // Give the element a beat to actually start decoding before judging it.
  verifyTimer = setTimeout(() => {
    const ok = audible();
    soundState(ok);
    if (!ok) {
      const v = demoEl();
      if (v && v.paused) { v.muted = true; v.play().catch(() => {}); } // keep the picture moving
      label("Click anywhere for sound");
    }
  }, 600);
}

function playDemo() {
  const v = demoEl();
  if (!v) return;
  const btn = document.getElementById("playbtn");
  const label = (t) => { const l = btn && btn.querySelector(".lbl"); if (l) l.textContent = t; };
  v.muted = false;
  v.volume = 1;
  v.play().catch(() => {});
  verifySound(label);
}

function wireVideo() {
  const v = demoEl();
  const btn = document.getElementById("playbtn");
  if (!v || !btn) return;
  const label = (t) => { const l = btn.querySelector(".lbl"); if (l) l.textContent = t; };


  // Any interaction anywhere primes the element for unmuted playback later.
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    addEventListener(ev, unlockAudio, { passive: true }));

  // A click is a real user gesture, so this path works in every browser.
  const startWithSound = (e) => {
    if (e) e.stopPropagation();
    v.muted = false;
    v.volume = 1;
    if (v.ended || v.currentTime >= v.duration - 0.1) v.currentTime = 0;
    v.play().catch(() => {});
    verifySound(label);
  };
  btn.addEventListener("click", startWithSound);
  const chip = document.getElementById("soundchip");
  if (chip) chip.addEventListener("click", (e) => { e.stopPropagation(); startWithSound(e); });
  btn.closest(".slide").addEventListener("click", (e) => {
    if (e.target === btn || btn.contains(e.target)) return; // handled above
    if (!audible()) startWithSound(e); else v.pause();
  });

  v.addEventListener("ended", () => { label("Replay with sound"); soundState(false); });
  v.addEventListener("playing", () => verifySound(label));
  v.addEventListener("pause", () => { if (!v.ended) soundState(false); });
  v.addEventListener("error", () => { label("Open assets/bumply-demo.mp4"); soundState(false); });

  // "m" toggles sound from anywhere, for a room that has to go quiet fast.
  addEventListener("keydown", (e) => {
    if (e.key !== "m" && e.key !== "M") return;
    v.muted = !v.muted;
    if (!v.muted) { v.volume = 1; if (v.paused) v.play().catch(() => {}); }
    verifySound(label);
  });
}

function soundState(on) {
  const btn = document.getElementById("playbtn");
  const chip = document.getElementById("soundchip");
  if (btn) btn.classList.toggle("show", !on);
  if (chip) chip.classList.toggle("on", on);
  const t = chip && chip.querySelector(".txt");
  if (t) t.textContent = "LIVE PRODUCT · 37 SECONDS · SOUND " + (on ? "ON" : "OFF");
}

function playDemo() {
  const v = document.getElementById("demo");
  if (!v) return;
  const btn = document.getElementById("playbtn");
  const label = (t) => { const l = btn && btn.querySelector(".lbl"); if (l) l.textContent = t; };
  v.muted = false;
  v.volume = 1;
  v.play()
    .then(() => soundState(true))
    .catch(() => {
      // Sound refused. Show the picture anyway and make the ask unmissable.
      v.muted = true;
      v.play().catch(() => {});
      label("Click anywhere for sound");
      soundState(false);
    });
}

function wireVideo() {
  const v = document.getElementById("demo");
  const btn = document.getElementById("playbtn");
  if (!v || !btn) return;
  const label = (t) => { const l = btn.querySelector(".lbl"); if (l) l.textContent = t; };

  // Any interaction anywhere primes the element for unmuted playback later.
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    addEventListener(ev, unlockAudio, { once: false, passive: true }));

  const startWithSound = () => {
    v.muted = false;
    v.volume = 1;
    if (v.ended || v.currentTime >= v.duration - 0.1) v.currentTime = 0;
    v.play().then(() => soundState(true)).catch(() => {});
  };
  btn.addEventListener("click", startWithSound);
  const chip = document.getElementById("soundchip");
  if (chip) chip.addEventListener("click", (e) => { e.stopPropagation(); startWithSound(e); });
  // The whole slide is a hit target, not just the disc.
  btn.closest(".slide").addEventListener("click", (e) => {
    if (v.paused || v.muted) { startWithSound(); e.stopPropagation(); }
    else v.pause();
  });
  v.addEventListener("ended", () => { label("Replay with sound"); soundState(false); });
  v.addEventListener("playing", () => soundState(!v.muted));
  v.addEventListener("volumechange", () => soundState(!v.muted && !v.paused));
  v.addEventListener("error", () => { label("Open assets/bumply-demo.mp4"); soundState(false); });

  // "m" toggles sound from anywhere, for a room that has to go quiet fast.
  addEventListener("keydown", (e) => {
    if (e.key !== "m" && e.key !== "M") return;
    v.muted = !v.muted;
    if (!v.muted && v.paused) v.play().catch(() => {});
    soundState(!v.muted);
  });
}

function wireVideo() {
  const v = document.getElementById("demo");
  const btn = document.getElementById("playbtn");
  if (!v || !btn) return;
  const label = (t) => { const l = btn.querySelector(".lbl"); if (l) l.textContent = t; };

  const startWithSound = () => {
    v.muted = false;
    if (v.ended || v.currentTime >= v.duration - 0.1) v.currentTime = 0;
    v.play().then(() => btn.classList.remove("show")).catch(() => {});
  };
  btn.addEventListener("click", startWithSound);
  const chip = document.getElementById("soundchip");
  if (chip) chip.addEventListener("click", (e) => { e.stopPropagation(); startWithSound(e); });
  v.addEventListener("click", () => (v.paused ? startWithSound() : v.pause()));
  v.addEventListener("ended", () => { label("Replay the demo"); btn.classList.add("show"); });
  v.addEventListener("playing", () => { if (!v.muted) btn.classList.remove("show"); });
  v.addEventListener("error", () => { label("Open assets/bumply-demo.mp4"); btn.classList.add("show"); });

  // "m" toggles sound from anywhere, for a room where audio has to go quiet fast.
  addEventListener("keydown", (e) => {
    if (e.key !== "m" && e.key !== "M") return;
    v.muted = !v.muted;
    if (!v.muted) btn.classList.remove("show");
  });
}

/* ------------------------------- boot ------------------------------- */
function boot() {
  const nav = document.getElementById("nav");
  slides.forEach((_, i) => {
    const b = document.createElement("button");
    b.onclick = () => goto(i);
    b.setAttribute("aria-label", `Slide ${i + 1}`);
    nav.appendChild(b);
  });
  fit();
  wireStagger();
  wireVideo();
  warmVideo();
  initHero();
  chartSensitivity(); chartCost(); chartMarket(); chartFunds(); chartSplit();

  if (location.hash === "#print" || location.hash === "#export") {
    document.body.classList.add("export");
    if (location.hash === "#print") window.__printMode();
    else goto(0);
  } else {
    goto(Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  }
}
document.readyState === "loading" ? addEventListener("DOMContentLoaded", boot) : boot();
