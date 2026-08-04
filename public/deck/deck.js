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
  cur = Math.max(0, Math.min(slides.length - 1, n));
  slides.forEach((s, i) => s.classList.toggle("active", i === cur));
  [...document.querySelectorAll("#nav button")].forEach((b, i) => b.classList.toggle("on", i === cur));
  const bar = document.getElementById("bar");
  if (bar) bar.style.width = `${((cur + 1) / slides.length) * 100}%`;

  slides.forEach((s, i) => {
    const v = s.querySelector("video");
    if (!v) return;
    if (i !== cur) { v.pause(); return; }
    // In export we only ever get a still, so park on a representative frame
    // rather than whatever the transition happens to land on.
    if (isExport()) { v.pause(); v.currentTime = 22; return; }
    v.currentTime = 0;
    // Autoplay is blocked under file:// in most browsers even when muted, so
    // never assume it started: surface a play control whenever the promise rejects.
    const btn = document.getElementById("playbtn");
    v.play().then(() => btn && btn.classList.remove("show"))
            .catch(() => btn && btn.classList.add("show"));
  });

  countUp(slides[cur]);
  history.replaceState(null, "", `#${cur + 1}`);
}
window.__goto = goto;
window.__printMode = () => {
  document.body.classList.add("print", "export");
  slides.forEach((s) => { s.classList.add("active"); countUp(s, true); });
  document.querySelectorAll("video").forEach((v) => { v.pause(); v.currentTime = 22; });
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
  // One series, one axis → no legend box; the title names it.
  new Chart(el, {
    type: "line",
    data: {
      labels: ["100", "1,000", "10,000", "100,000"],
      datasets: [{
        label: "₦ per mother / month",
        data: [1393, 500, 240, 80],
        borderColor: C1D(), backgroundColor: "rgba(224,144,106,.13)",
        borderWidth: 2.5, fill: true, tension: 0.34,
        pointRadius: 6, pointBackgroundColor: C1D(), pointBorderColor: "#231D18", pointBorderWidth: 2.5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: isExport() ? 0 : 900 },
      layout: { padding: { top: 38, right: 34 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ₦${c.parsed.y.toLocaleString()} per mother / month` } },
      },
      scales: {
        y: { beginAtZero: true, grid: grid(true), border: { display: false }, ticks: { ...ticks(true, 15), callback: (v) => "₦" + v } },
        x: { grid: { display: false }, border: { display: false }, ticks: ticks(true, 17),
             title: { display: true, text: "mothers served", color: "rgba(255,255,255,.5)", font: { family: FONT, size: 15 } } },
      },
    },
    plugins: [{
      id: "ptLabels",
      afterDatasetsDraw(c) {
        const ctx = c.ctx;
        c.getDatasetMeta(0).data.forEach((p, i) => {
          const v = c.data.datasets[0].data[i];
          ctx.save();
          ctx.font = `700 19px ${FONT}`;
          ctx.fillStyle = i === 3 ? CSSV("--gold") : "#fff";
          ctx.textAlign = "center";
          ctx.fillText("₦" + v.toLocaleString(), p.x, p.y - 17);
          ctx.restore();
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
        data: [7550000, 2400000, 120000],
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
          type: "logarithmic", min: 1e5, max: 1e7,
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
        const ctx = c.ctx, txt = ["7.55M live births / yr", "2.4M reachable on WhatsApp", "120k in 3 yrs"];
        c.getDatasetMeta(0).data.forEach((bar, i) => {
          ctx.save(); ctx.font = `600 17px ${FONT}`; ctx.fillStyle = INKMUT(); ctx.textBaseline = "middle";
          ctx.fillText(txt[i], bar.x + 12, bar.y); ctx.restore();
        });
      },
    }],
  });
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

/* ---- demo video: play control + click-anywhere-to-toggle ---- */
function wireVideo() {
  const v = document.getElementById("demo");
  const btn = document.getElementById("playbtn");
  if (!v || !btn) return;
  const start = () => {
    v.play().then(() => btn.classList.remove("show")).catch(() => btn.classList.add("show"));
  };
  btn.addEventListener("click", start);
  v.addEventListener("click", () => (v.paused ? start() : v.pause()));
  v.addEventListener("ended", () => btn.classList.add("show"));
  v.addEventListener("playing", () => btn.classList.remove("show"));
  // If the file never loads at all, the poster still shows; say so rather than hang.
  v.addEventListener("error", () => {
    btn.classList.add("show");
    const lbl = btn.querySelector(".lbl");
    if (lbl) lbl.textContent = "Open assets/bumply-demo.mp4";
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
  initHero();
  chartSensitivity(); chartCost(); chartMarket();

  if (location.hash === "#print" || location.hash === "#export") {
    document.body.classList.add("export");
    if (location.hash === "#print") window.__printMode();
    else goto(0);
  } else {
    goto(Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  }
}
document.readyState === "loading" ? addEventListener("DOMContentLoaded", boot) : boot();
