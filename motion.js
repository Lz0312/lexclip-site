const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/* Highlighter progress rail */
const progressFill = document.querySelector(".scroll-progress i");
function updateProgress() {
  if (!progressFill) return;
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const p = max > 0 ? window.scrollY / max : 0;
  progressFill.style.height = `${clamp(p, 0, 1) * 100}%`;
}

/* Section reveals */
const revealEls = [...document.querySelectorAll("[data-reveal]")];
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
);

if (reduceMotion) {
  revealEls.forEach((el) => el.classList.add("is-in"));
} else {
  revealEls.forEach((el) => revealObserver.observe(el));
}

/* Loop pin: scroll jumps to keyframe times (queued seeks, no cancel storm) */
const loopPin = document.querySelector(".loop-pin");
const loopSteps = [...document.querySelectorAll(".loop-step")];
const loopTitle = document.querySelector("[data-loop-title]");
const loopCopy = document.querySelector("[data-loop-copy]");
const loopBar = document.querySelector("[data-loop-bar]");
const chainSpans = [...document.querySelectorAll("[data-chain]")];
const loopVideo = document.querySelector(".loop-video");
let lastLoopIndex = -1;
let loopDuration = 10.45;
let loopReady = false;
let loopSeeking = false;
let loopSeekTarget = null;
let loopAppliedTime = -1;

/** 0 看见 · 2.6 摘下 · 4 点一下 · 5.8 留下来 · end 学会 */
const LOOP_KEY_TIMES = [0, 2.6, 4, 5.8];

function loopKeyTimes() {
  const end = Math.max(loopDuration - 0.05, LOOP_KEY_TIMES.at(-1) + 0.25);
  return [...LOOP_KEY_TIMES, end];
}

function setLoopIndex(index) {
  if (index === lastLoopIndex || !loopSteps.length) return;
  lastLoopIndex = index;
  const step = loopSteps[index];

  loopSteps.forEach((el, i) => {
    el.classList.toggle("is-active", i === index);
    el.classList.toggle("is-done", i < index);
  });

  chainSpans.forEach((el) => {
    const i = Number(el.dataset.chain);
    el.classList.toggle("is-on", i <= index);
  });

  if (loopTitle && step) {
    loopTitle.textContent = step.dataset.title || "";
    loopCopy.textContent = step.dataset.copy || "";
    if (!reduceMotion) {
      loopBar?.classList.remove("is-drawn");
      requestAnimationFrame(() => loopBar?.classList.add("is-drawn"));
    } else {
      loopBar?.classList.add("is-drawn");
    }
  }
}

function flushLoopSeek() {
  if (!loopVideo || !loopReady || loopSeekTarget == null) return;
  const target = clamp(loopSeekTarget, 0, Math.max(0, loopDuration - 0.01));
  loopSeekTarget = null;
  if (Math.abs(loopAppliedTime - target) < 0.03 && Math.abs(loopVideo.currentTime - target) < 0.08) {
    return;
  }
  loopSeeking = true;
  try {
    loopVideo.pause();
    loopVideo.currentTime = target;
  } catch {
    loopSeeking = false;
  }
}

function seekLoopVideo(time) {
  if (!loopVideo || !loopReady) return;
  loopSeekTarget = time;
  if (loopSeeking) return;
  flushLoopSeek();
}

function updateLoop() {
  if (!loopPin || !loopSteps.length) return;
  const rect = loopPin.getBoundingClientRect();
  const total = Math.max(1, loopPin.offsetHeight - window.innerHeight);
  const scrolled = clamp(-rect.top, 0, total);
  const progress = scrolled / total;

  const keys = loopKeyTimes();
  const count = loopSteps.length;
  const index = Math.min(count - 1, Math.floor(progress * count + 1e-6));
  // 滑到这一段最底部时确保落在最后一帧「学会」
  const atEnd = progress >= 0.98;
  const stepIndex = atEnd ? count - 1 : index;

  setLoopIndex(stepIndex);
  seekLoopVideo(keys[stepIndex]);
}

if (loopVideo) {
  const arm = () => {
    if (Number.isFinite(loopVideo.duration) && loopVideo.duration > 0) {
      loopDuration = loopVideo.duration;
    }
    loopReady = true;
    loopVideo.pause();
    updateLoop();
  };
  loopVideo.addEventListener("seeked", () => {
    loopAppliedTime = loopVideo.currentTime;
    loopSeeking = false;
    if (loopSeekTarget != null) flushLoopSeek();
  });
  loopVideo.addEventListener("error", () => {
    document.querySelector(".loop-scene")?.classList.remove("has-loop-video");
  });
  if (loopVideo.readyState >= 1) arm();
  else loopVideo.addEventListener("loadedmetadata", arm, { once: true });
  // 解锁解码后再 seek 更稳
  loopVideo.play().then(() => {
    loopVideo.pause();
    arm();
    updateLoop();
  }).catch(() => arm());
}

/* Darkroom photo scan */
const photoFrame = document.querySelector("[data-scan]");
const photoDemo = document.querySelector(".photo-demo");
const inviteCap = document.querySelector(".invite-cap");
let scanPlayed = false;

const scanObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || scanPlayed) continue;
      scanPlayed = true;
      if (reduceMotion) {
        photoFrame?.classList.add("is-ready");
        photoDemo?.classList.add("is-beam");
        inviteCap?.classList.add("is-glow");
        return;
      }
      photoFrame?.classList.add("is-scanning");
      window.setTimeout(() => {
        photoFrame?.classList.remove("is-scanning");
        photoFrame?.classList.add("is-ready");
        photoDemo?.classList.add("is-beam");
        inviteCap?.classList.add("is-glow");
      }, 1100);
    }
  },
  { threshold: 0.45 }
);
if (photoFrame) scanObserver.observe(photoFrame);

/* Review flip on view */
const flipCard = document.querySelector("[data-flip]");
let flipTimer = null;
const flipObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!flipCard) return;
      if (entry.isIntersecting) {
        if (reduceMotion) {
          flipCard.classList.add("is-flipped");
          return;
        }
        flipCard.classList.remove("is-flipped");
        window.clearTimeout(flipTimer);
        flipTimer = window.setTimeout(() => flipCard.classList.add("is-flipped"), 900);
        window.setTimeout(() => {
          flipCard.classList.remove("is-flipped");
          flipTimer = window.setTimeout(() => flipCard.classList.add("is-flipped"), 1600);
        }, 2800);
      }
    }
  },
  { threshold: 0.5 }
);
if (flipCard) flipObserver.observe(flipCard);

/* Journal word marks staggered when hero enters */
const hero = document.querySelector(".hero");
if (hero && !reduceMotion) {
  const words = hero.querySelectorAll(".mark-word");
  const heroObs = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        words.forEach((w, i) => {
          window.setTimeout(() => w.classList.add("is-marked"), 400 + i * 160);
        });
        heroObs.disconnect();
      }
    },
    { threshold: 0.3 }
  );
  heroObs.observe(hero);
} else {
  document.querySelectorAll(".mark-word").forEach((w) => w.classList.add("is-marked"));
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    updateProgress();
    updateLoop();
    ticking = false;
  });
}

/* Wire real screenshots / muted clips when files exist */
function armMedia() {
  const heroVideo = document.querySelector(".hero-video");
  if (heroVideo) {
    const phone = heroVideo.closest(".phone");
    const showFallback = () => {
      phone?.classList.remove("has-hero-video");
      phone?.classList.add("is-fallback");
    };
    heroVideo.addEventListener(
      "loadeddata",
      () => {
        phone?.classList.add("has-hero-video");
        phone?.classList.remove("is-fallback");
        if (reduceMotion) {
          heroVideo.pause();
          heroVideo.currentTime = 0;
        } else {
          heroVideo.play().catch(() => {});
        }
      },
      { once: true }
    );
    heroVideo.addEventListener("error", showFallback, { once: true });
  }

  document.querySelectorAll(".photo-frame").forEach((frame) => {
    const video = frame.querySelector(".shot-video");
    const img = frame.querySelector("img.shot");
    if (video) {
      video.addEventListener(
        "loadeddata",
        () => {
          video.classList.add("is-ready");
          frame.classList.add("has-media", "has-video");
        },
        { once: true }
      );
      video.addEventListener("error", () => {
        if (img?.complete && img.naturalWidth > 0) {
          frame.classList.add("has-media");
          img.style.display = "block";
        }
      });
    }
    if (img) {
      const mark = () => {
        if (img.naturalWidth > 0 && !frame.classList.contains("has-video")) {
          frame.classList.add("has-media");
          img.style.display = "block";
        }
      };
      if (img.complete) mark();
      else img.addEventListener("load", mark, { once: true });
    }
  });

  document.querySelectorAll(".phone > .shot, .shot-band > .shot").forEach((img) => {
    const slot = img.closest(".phone, .shot-band");
    const ok = () => {
      if (img.naturalWidth > 0) slot?.classList.remove("is-fallback");
      else slot?.classList.add("is-fallback");
    };
    if (img.complete) ok();
    else {
      img.addEventListener("load", ok, { once: true });
      img.addEventListener("error", () => slot?.classList.add("is-fallback"), { once: true });
    }
  });
}

const clipObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const video = entry.target;
      if (!(video instanceof HTMLVideoElement)) continue;
      if (entry.isIntersecting && video.classList.contains("is-ready")) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  },
  { threshold: 0.4 }
);
document.querySelectorAll(".shot-video").forEach((v) => clipObserver.observe(v));

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll);
armMedia();
updateProgress();
setLoopIndex(0);
updateLoop();
