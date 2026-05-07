/* ================================
   DelayAge 설문 앱 - script.js (5단계)
================================ */

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- 엘리먼트 캐시 ---------- */
  const body = document.body;
  const USE_OLD_PEER_FLOW = false;
  const startSection = document.querySelector("#start");
  const startBtn = document.querySelector("#btnStart");

  const cardSection = document.querySelector("#card");
  const form = document.querySelector("#surveyForm");

  const resultSection = document.querySelector("#result");
  const retryBtn = document.querySelector("#retry");

  const progressWrap = document.querySelector("#progressWrap");
  const progressBar = document.querySelector("#progressBar");

  const steps = Array.from(document.querySelectorAll("#card .step")); // data-step="1..5"
  const totalSteps = steps.length; // 5
  let currentStep = 1;
  const loadingEl = document.getElementById("loading");
  const showLoading = (msg = "점수를 계산하는 중이에요…") => {
    if (!loadingEl) return;
    loadingEl.classList.remove("hidden");
    const t = loadingEl.querySelector(".loading-title");
    if (t) t.textContent = msg;
  };
  const hideLoading = () => loadingEl?.classList.add("hidden");
  /* ---------- 시작 화면 ---------- */
  body.classList.add("start-active"); // 시작화면에서 헤더/푸터 숨김

  /* ---------- 유틸 ---------- */
  const getStepEl = (n) => steps.find((s) => Number(s.dataset.step) === n);
  const hideAllSteps = () => steps.forEach((s) => s.classList.add("hidden"));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function showStep(n) {
    hideAllSteps();
    const el = getStepEl(n);
    el?.classList.remove("hidden");
    currentStep = n;
    updateProgress();
    updateButtonsState();
  }

  function toggleProgress(show) {
    progressWrap.classList.toggle("hidden", !show);
  }

  const STEP_NAMES = ["", "기본정보", "식습관", "신체활동", "수면", "스트레스"];

  function updateProgress() {
    const ratio = clamp((currentStep - 1) / totalSteps, 0, 1);
    const pct = Math.round(ratio * 100);
    progressBar.style.width = `${pct}%`;
    progressBar.setAttribute("aria-valuenow", String(pct));

    const stepLabelEl = document.getElementById("stepLabel");
    const stepNameEl = document.getElementById("stepName");
    if (stepLabelEl) stepLabelEl.textContent = `STEP ${currentStep} / ${totalSteps}`;
    if (stepNameEl) stepNameEl.textContent = STEP_NAMES[currentStep] || "";
  }

  /* ---------- 스텝 유효성 + 버튼 활성 ---------- */
  function isStepValid(stepEl) {
    if (!stepEl) return false;

    const requiredEls = stepEl.querySelectorAll(
      "select[required], input[required]"
    );
    const radioGroups = new Set();

    for (const el of requiredEls) {
      if (el.tagName === "SELECT") {
        if (!el.value) return false;
      } else if (el.type === "radio") {
        radioGroups.add(el.name);
      }
    }
    for (const name of radioGroups) {
      const checked = stepEl.querySelector(`input[name="${name}"]:checked`);
      if (!checked) return false;
    }
    return true;
  }

  function updateButtonsState() {
    const stepEl = getStepEl(currentStep);
    if (!stepEl) return;

    const nextBtn = stepEl.querySelector(".js-next");
    const submitBtn = stepEl.querySelector(
      'button[type="submit"], input[type="submit"]'
    );
    const valid = isStepValid(stepEl);

    if (nextBtn) nextBtn.disabled = !valid;
    if (submitBtn) submitBtn.disabled = !valid;
  }

  /* ---------- 이벤트 ---------- */

  // 시작 → 설문 시작
  startBtn?.addEventListener("click", () => {
    body.classList.remove("start-active"); // 헤더/푸터 다시 보임
    startSection.classList.add("hidden");
    cardSection.classList.remove("hidden");

    toggleProgress(true);
    showStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // 다음 버튼 (event delegation)
  cardSection.addEventListener("click", (e) => {
    const btn = e.target.closest(".js-next");
    if (!btn) return;

    const cur = getStepEl(currentStep);
    if (!isStepValid(cur)) return;

    if (currentStep < totalSteps) {
      showStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  // 입력 변경 시 버튼 상태 갱신
  form.addEventListener("change", updateButtonsState);
  form.addEventListener("input", updateButtonsState);

  // 제출(결과 보기)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const cur = getStepEl(currentStep);
    if (!isStepValid(cur)) return;

    // 1) 로딩 오픈
    showLoading("점수를 계산하는 중이에요…");

    try {
      // 2) 내 점수 계산
      const answers = collectAnswers(form);
      const { areaScores, totalScore } = calcScores(answers);

      // 3) 동연령 평균 JSONP 조회
      const ageLabelMap = {
        10: "10대 이하",
        20: "20대",
        30: "30대",
        40: "40대",
        50: "50대 이상",
      };
      const ageLabel = ageLabelMap[answers.age] || "";
      let stats = null;
      try {
        stats = await fetchPeerAverageJSONP(ageLabel);
      } catch {}

      const peerTotal = Number(stats?.total_avg ?? 0);
      const count = Number(stats?.count ?? 0);

      // 4) 결과 화면으로 전환 (총점·평균 '동시에' 렌더)
      toggleProgress(false);
      cardSection.classList.add("hidden");
      resultSection.classList.remove("hidden");

      // 총점 & 영역 점수
      renderResult(areaScores, totalScore);
      // 평균/비교문 & 막대그래프(나 vs 평균)
      updateResultUI(areaScores, totalScore, peerTotal, count);
      drawBar(totalScore, peerTotal);

      // 개인화 피드백(평균 표준화 후)
      const peerAvgs = normalizePeerAverages(stats);
      if (peerAvgs) renderPersonalFeedback(areaScores, peerAvgs);
      const payload = buildSavePayload(areaScores, totalScore, answers);
      postSaveNoCORS(payload);

      // 축하 효과
      fireConfetti({
        particles: 160,
        duration: 2000,
        gravity: 0.28,
        colors: [
          "#7CFF6B",
          "#34D399",
          "#22C55E",
          "#A7F3D0",
          "#60A5FA",
          "#A78BFA",
        ],
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      // 5) 로딩 닫기 (성공/실패 상관없이)
      hideLoading();
    }
  });

  // 다시하기 → 시작화면
  retryBtn?.addEventListener("click", () => {
    resultSection.classList.add("hidden");
    startSection.classList.remove("hidden");
    body.classList.add("start-active");

    hideAllSteps();
    currentStep = 1;
    progressBar.style.width = "0%";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------- 초기 ---------- */
  toggleProgress(false);
  updateButtonsState();
});

/* ================================
   데이터 수집/계산/차트
================================ */

function collectAnswers(form) {
  const get = (name) =>
    Number(form.querySelector(`input[name="${name}"]:checked`)?.value || 0);
  const sel = (name) => form.querySelector(`[name="${name}"]`)?.value || "";

  return {
    // 기본정보
    age: sel("age"),
    gender: sel("gender"), // 1:남성, 2:여성

    // 식습관(5문항)
    diet_veg: get("diet_veg"),
    diet_protein: get("diet_protein"),
    diet_processed: get("diet_processed"),
    diet_late: get("diet_late"),
    diet_water: get("diet_water"),

    // 신체활동(3문항)
    act_minutes: get("act_minutes"),
    act_strength: get("act_strength"),
    act_sitting: get("act_sitting"),

    // 수면(2문항)
    sleep_hours: get("sleep_hours"),
    sleep_regular: get("sleep_regular"),

    // 스트레스(3문항)
    stress_level: get("stress_level"),
    stress_manage: get("stress_manage"),
    stress_screen: get("stress_screen"),
  };
}

/** 각 영역 25점씩 총 100점 */
function calcScores(a) {
  const diet =
    ((a.diet_veg +
      a.diet_protein +
      a.diet_processed +
      a.diet_late +
      a.diet_water) /
      (5 * 5)) *
    25;

  const activity =
    ((a.act_minutes + a.act_strength + a.act_sitting) / (3 * 5)) * 25;

  const sleep = ((a.sleep_hours + a.sleep_regular) / (2 * 5)) * 25;

  const stress =
    ((a.stress_level + a.stress_manage + a.stress_screen) / (3 * 5)) * 25;

  const areaScores = {
    diet: Math.round(diet),
    activity: Math.round(activity),
    sleep: Math.round(sleep),
    stress: Math.round(stress),
  };

  const totalScore = Math.round(
    areaScores.diet + areaScores.activity + areaScores.sleep + areaScores.stress
  );

  return { areaScores, totalScore };
}

/* ---------- 결과 렌더 ---------- */
let radarChart, barChart;

function renderResult(area, total) {
  const summary = document.querySelector("#summaryText");
  summary.innerHTML = `당신의 총점은 <b>${total}점</b>입니다.`;

  document.querySelector("#kvdiet").textContent = `${area.diet}점`;
  document.querySelector("#kvact").textContent = `${area.activity}점`;
  document.querySelector("#kvsleep").textContent = `${area.sleep}점`;
  document.querySelector("#kvstress").textContent = `${area.stress}점`;

  drawRadar(area);
  drawBar(total);
}

/* ---------- 차트 ---------- */
function drawRadar(area) {
  const ctx = document.getElementById("radarChart")?.getContext("2d");
  if (!ctx) return;

  const GREEN_MAIN = "#7cff6b"; // 메인 타원 초록
  const GREEN_FILL = "rgba(124, 255, 107, 0.25)";
  const GREEN_DARK = "#10b981";

  radarChart?.destroy();
  radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["식습관", "신체활동", "수면", "스트레스"],
      datasets: [
        {
          label: "영역 점수",
          data: [area.diet, area.activity, area.sleep, area.stress],
          backgroundColor: GREEN_FILL, // 채움색(연한 초록)
          borderColor: GREEN_MAIN, // 외곽선(밝은 초록)
          borderWidth: 2,
          pointBackgroundColor: GREEN_DARK, // 포인트(진한 초록)
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: GREEN_MAIN,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        r: { suggestedMin: 0, suggestedMax: 25, ticks: { stepSize: 5 } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function drawBar(myTotal, peerTotal = null) {
  const ctx = document.getElementById("barChart")?.getContext("2d");
  if (!ctx) return;

  try {
    window.barChart?.destroy();
  } catch {}

  const labels =
    peerTotal == null ? ["총점(100점 만점)"] : ["나", "동연령 평균"];
  const data = peerTotal == null ? [myTotal] : [myTotal, peerTotal];

  // ✅ 그라데이션 생성 함수
  const makeGradient = (ctx, topColor, bottomColor) => {
    const g = ctx.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, topColor);
    g.addColorStop(1, bottomColor);
    return g;
  };

  // ✅ 색상 지정
  const myGradient = makeGradient(ctx, "#B6FF5C", "#00FF7F"); // 형광 연두 → 진한 초록
  const peerGradient = makeGradient(ctx, "#3EFFD4", "#00B4FF"); // 민트 → 파랑

  window.barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "점수",
          data,
          backgroundColor:
            peerTotal == null ? myGradient : [myGradient, peerGradient],
          borderColor: peerTotal == null ? "#00FF7F" : ["#00FF7F", "#00B4FF"],
          borderWidth: 1.5,
          borderRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { suggestedMin: 0, suggestedMax: 100, ticks: { stepSize: 10 } },
        x: { grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
}
/* ================================
   Confetti (lightweight canvas)
================================ */
function createConfettiCanvas() {
  let canvas = document.getElementById("confettiCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "confettiCanvas";
    canvas.className = "confetti-canvas";
    document.body.appendChild(canvas);
  }
  // 사이즈 동기화
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);
  return canvas;
}

function fireConfetti({
  particles = 160,
  duration = 2000,
  spread = Math.PI * 2, // ✅ 360°
  gravity = 0.22, // 살짝만 내려오게
  colors = ["#7CFF6B", "#34D399", "#22C55E", "#A7F3D0", "#60A5FA", "#A78BFA"],
} = {}) {
  const canvas = createConfettiCanvas();
  const ctx = canvas.getContext("2d");

  // 파티클 초기화
  const W = window.innerWidth;
  const H = window.innerHeight;
  const originX = W / 2;
  const originY = H * 0.15; // 상단에서 터지게

  const rand = (min, max) => Math.random() * (max - min) + min;

  const parts = Array.from({ length: particles }).map(() => {
    const angle = rand(0, Math.PI * 2); // 0 ~ 360도 방향으로 균일
    const speed = rand(5, 11); // 조금 더 팡! 튀게 속도 상향
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: rand(6, 12),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.2, 0.2),
      color: colors[(Math.random() * colors.length) | 0],
      alpha: 1,
      life: rand(0.8, 1.0), // 페이드 타이밍 다양화
      shape: Math.random() < 0.6 ? "rect" : "circle",
    };
  });

  let start = null;
  let rafId = 0;

  const draw = (timestamp) => {
    if (!start) start = timestamp;
    const t = timestamp - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    parts.forEach((p) => {
      // 물리
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      // 페이드아웃
      if (t > duration * p.life) {
        p.alpha -= 0.03;
      }
      // 그림
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    });

    // 살아있는 파티클이 있으면 계속
    const alive = parts.some(
      (p) => p.alpha > 0 && p.y < window.innerHeight + 60
    );
    if (t < duration + 1200 && alive) {
      rafId = requestAnimationFrame(draw);
    } else {
      // 끝나면 비워주기(다시 보기 대비)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(rafId);
    }
  };

  rafId = requestAnimationFrame(draw);
}
const PEER_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwIbhY8Qd9VteASqR8v1SJNLdFo2hp6zGCfrYia3iHTaZLR2JTh5jFIJ4OxW9ERBfsY/exec";

/* 3) 후처리: 응답 수집 → 점수계산 → 평균조회(JSONP) → 결과영역 업데이트 → 저장(POST) */
async function runPeerFlowSafely() {
  try {
    const answers = collectAnswersFromDOM();
    const { areaScores, totalScore } = calcScoresFromAnswers(answers);

    const ageLabelMap = {
      10: "10대 이하",
      20: "20대",
      30: "30대",
      40: "40대",
      50: "50대 이상",
    };
    const ageLabel = ageLabelMap[answers.age] || "";

    // (A) 평균 조회(JSONP)
    const stats = await fetchPeerAverageJSONP(ageLabel).catch(() => null);
    const peerTotal = Number(stats?.total_avg ?? 0);
    const count = Number(stats?.count ?? 0);

    // (B) 결과 화면 업데이트(요약/표본수/막대비교)
    updateResultUI(areaScores, totalScore, peerTotal, count);
    // 막대그래프도 '나 vs 동연령 평균'으로 갱신
    drawBar(totalScore, peerTotal);
    // (C) 저장 (no-cors POST) — 동일 스프레드시트에 누적
    // 평균 키 표준화 → 피드백 렌더
    const peerAvgs = normalizePeerAverages(stats);
    renderPersonalFeedback(areaScores, peerAvgs);
    const payload = buildSavePayload(areaScores, totalScore, answers);
    postSaveNoCORS(payload);
  } catch (err) {
    console.warn("[DelayAge Peer] 후처리 실패:", err);
  }
}

/* 4) DOM에서 값 읽기 — HTML의 name과 1:1 매칭 (에티엠엘.html 기준) */
function collectAnswersFromDOM() {
  const selVal = (name) =>
    document.querySelector(`[name="${name}"]`)?.value || "";
  const radioVal = (name) =>
    Number(document.querySelector(`input[name="${name}"]:checked`)?.value || 0);

  return {
    age: selVal("age"),
    gender: selVal("gender"),

    // 식습관(5)
    diet_veg: radioVal("diet_veg"),
    diet_protein: radioVal("diet_protein"),
    diet_processed: radioVal("diet_processed"),
    diet_late: radioVal("diet_late"),
    diet_water: radioVal("diet_water"),

    // 신체활동(3)
    act_minutes: radioVal("act_minutes"),
    act_strength: radioVal("act_strength"),
    act_sitting: radioVal("act_sitting"),

    // 수면(2)
    sleep_hours: radioVal("sleep_hours"),
    sleep_regular: radioVal("sleep_regular"),

    // 스트레스(3)
    stress_level: radioVal("stress_level"),
    stress_manage: radioVal("stress_manage"),
    stress_screen: radioVal("stress_screen"),
  };
}

/* 5) 점수계산 — 각 영역 25점, 총점 100점 */
function calcScoresFromAnswers(a) {
  const diet =
    ((a.diet_veg +
      a.diet_protein +
      a.diet_processed +
      a.diet_late +
      a.diet_water) /
      (5 * 5)) *
    25;
  const activity =
    ((a.act_minutes + a.act_strength + a.act_sitting) / (3 * 5)) * 25;
  const sleep = ((a.sleep_hours + a.sleep_regular) / (2 * 5)) * 25;
  const stress =
    ((a.stress_level + a.stress_manage + a.stress_screen) / (3 * 5)) * 25;

  const areaScores = {
    diet: Math.round(diet),
    activity: Math.round(activity),
    sleep: Math.round(sleep),
    stress: Math.round(stress),
  };
  const totalScore =
    areaScores.diet +
    areaScores.activity +
    areaScores.sleep +
    areaScores.stress;

  return { areaScores, totalScore: Math.round(totalScore) };
}

/* 6) 평균 조회(JSONP) — ?avg=1&age=라벨&callback=함수명 */
function fetchPeerAverageJSONP(ageLabel) {
  return new Promise((resolve, reject) => {
    const cb = `__delayage_avg_cb_${Date.now()}`;
    window[cb] = (data) => {
      try {
        resolve(data);
      } finally {
        delete window[cb];
        try {
          s.remove();
        } catch {}
      }
    };

    const qs = new URLSearchParams({
      avg: "1",
      age: String(ageLabel || ""),
      callback: cb,
    });
    const s = document.createElement("script");
    s.src = `${PEER_WEB_APP_URL}?${qs.toString()}`;
    s.onerror = () => {
      delete window[cb];
      try {
        s.remove();
      } catch {}
      reject(new Error("JSONP load error"));
    };
    document.body.appendChild(s);

    // 타임아웃 폴백
    setTimeout(() => {
      if (window[cb]) {
        delete window[cb];
        try {
          s.remove();
        } catch {}
        resolve(null);
      }
    }, 6000);
  });
}

/* 7) 결과 UI 업데이트 — 기존 요소/레이아웃은 그대로 사용 */
let __peerBarChart; // 이 모듈에서만 쓰는 막대 차트 핸들
function updateResultUI(area, meTotal, peerTotal, count) {
  const summaryEl = document.querySelector("#summaryText");
  if (summaryEl) {
    const diff = Math.abs(meTotal - peerTotal).toFixed(1);
    const extra =
      `동연령 평균은 <b>${peerTotal}점</b>이며, ` +
      `${meTotal >= peerTotal ? "평균보다 높아요" : "평균보다 낮아요"} `;

    const base = (summaryEl.innerHTML || "").trim();

    if (base) {
      // 이미 평균 문구가 없다면, 줄바꿈 후 붙이기
      if (!/동연령 평균은/.test(base)) {
        summaryEl.innerHTML = `${base}<br><br>${extra}`;
      }
    } else {
      // 처음 쓰는 경우: 총점 → 빈 줄 → 평균 문장
      summaryEl.innerHTML = `당신의 딜레이지 점수는 <b>${meTotal}점</b>입니다.<br><br>${extra}`;
    }
  }

  // (b) 표본 수
  const metaEl = document.querySelector("#peerMeta");
  if (metaEl) metaEl.textContent = `현재 참여자 ${count}명 기준`;

  // (c) 막대 차트: '나' vs '동연령 평균'
  const canvas = document.getElementById("barChart");
  if (!canvas || !window.Chart) return;

  try {
    // 기존에 우리 모듈이 만든 차트가 있으면 파괴 후 재생성
    if (__peerBarChart) {
      __peerBarChart.destroy();
      __peerBarChart = null;
    }
    const ctx = canvas.getContext("2d");
    __peerBarChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["나", "동연령 평균"],
        datasets: [
          {
            label: "점수",
            data: [meTotal, peerTotal],
            backgroundColor: ["#6C63FF", "#4CC9FF"],
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { suggestedMin: 0, suggestedMax: 100, ticks: { stepSize: 10 } },
        },
        plugins: { legend: { display: false } },
      },
    });
  } catch (err) {
    console.warn("[DelayAge Peer] barChart 갱신 실패:", err);
  }

  // (d) 영역별 텍스트(있다면 값 채우기 — 기존 값이 없을 때만)
  const kvIfEmpty = (sel, val) => {
    const el = document.querySelector(sel);
    if (el && !el.textContent?.trim()) el.textContent = `${val}점`;
  };
  kvIfEmpty("#kvdiet", area.diet);
  kvIfEmpty("#kvact", area.activity);
  kvIfEmpty("#kvsleep", area.sleep);
  kvIfEmpty("#kvstress", area.stress);
}

/* 8) 저장 (no-cors POST) — 동일 스프레드시트에 누적 */
function buildSavePayload(areaScores, totalScore, answers) {
  const ageMap = {
    10: "10대 이하",
    20: "20대",
    30: "30대",
    40: "40대",
    50: "50대 이상",
  };
  const genderMap = { 0: "밝히고 싶지 않음", 1: "남성", 2: "여성", 3: "기타" };
  return {
    age_group: ageMap[answers.age] || "",
    gender: genderMap[answers.gender] || "",
    areaScores,
    totalScore,
    answers,
  };
}

async function postSaveNoCORS(payload) {
  try {
    await fetch(PEER_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[DelayAge Peer] 저장 실패:", e);
  }
}
/* ==========================================================
   결과 하단에 "다른 사람들 평균(4개 카테고리)" 표시 모듈
   - 기존 코드/화면 삭제 없이, script.js 맨 아래에 '추가'만 하면 작동
   - JSONP 응답에 diet_avg, activity_avg, sleep_avg, stress_avg 가 있으면 자동 반영
   ========================================================== */

/** (1) 결과 섹션(#result) 맨 아래에 평균 박스가 없다면 동적으로 생성 */
function ensurePeerCategoryBox() {
  const result = document.querySelector("#result");
  if (!result) return null;

  let box = document.querySelector("#peerCategoryAverages");
  if (box) return box;

  box = document.createElement("div");
  box.id = "peerCategoryAverages";
  box.style.marginTop = "16px";
  box.style.padding = "16px";
  box.style.borderTop = "1px solid rgba(0,0,0,0.08)";
}

/** (2) 하단 평균값 렌더링 (값 없으면 '—' 표시) */
function renderPeerCategoryAverages(stats) {
  ensurePeerCategoryBox();

  const fmt = (v) =>
    typeof v === "number" && !Number.isNaN(v) ? `${Math.round(v)}점` : "—";

  const dietEl = document.querySelector("#peerAvgDiet");
  const actEl = document.querySelector("#peerAvgAct");
  const sleepEl = document.querySelector("#peerAvgSleep");
  const stressEl = document.querySelector("#peerAvgStress");

  // 응답 필드명: diet_avg, activity_avg, sleep_avg, stress_avg (없으면 '—')
  dietEl && (dietEl.textContent = fmt(Number(stats?.diet_avg)));
  actEl &&
    (actEl.textContent = fmt(
      pickNum(
        stats?.activity_avg,
        stats?.act_avg,
        stats?.activityMean,
        stats?.activity
      )
    ));
  sleepEl && (sleepEl.textContent = fmt(Number(stats?.sleep_avg)));
  stressEl && (stressEl.textContent = fmt(Number(stats?.stress_avg)));
}

/** (3) 우리 쪽 후처리 흐름(runPeerFlowSafely)이 있다면, 그 안에서 호출만 추가
 *    - 이미 runPeerFlowSafely/ fetchPeerAverageJSONP 등을 붙여둔 경우:
 *      renderPeerCategoryAverages(stats); 한 줄만 더 호출하면 끝.
 *    - 없다면, 아래의 "자동 훅"이 결과 화면으로 넘어간 직후 JSONP 재호출해서 그려줌.
 */

// A) runPeerFlowSafely 안에 한 줄만 추가 ▶ 이미 있는 분기라면 이 한 줄만 넣으면 됩니다.
//    (있는 파일에 이 블록을 '검색'해서 추가하는 느낌으로)
if (typeof runPeerFlowSafely === "function") {
  const __orig = runPeerFlowSafely;
  window.runPeerFlowSafely = async function patchedRunPeerFlowSafely() {
    // 원래 로직 수행
    const ret = await __orig.apply(this, arguments);
    try {
      // 기존 함수 안에서 이미 stats를 구했다면, window.__lastPeerStats에 보관하도록
      // (없다면 아래 B 훅이 대신 동작)
      if (window.__lastPeerStats) {
        renderPeerCategoryAverages(window.__lastPeerStats);
      }
    } catch (e) {
      console.warn("[PeerAvg] render after runPeerFlowSafely failed:", e);
    }
    return ret;
  };
}
function normalizePeerAverages(stats) {
  if (!stats || typeof stats !== "object") return null;

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  return {
    // 응답 포맷이 여러 가지일 수 있어서 키를 표준화
    diet_avg: toNum(stats.diet_avg ?? stats.dietMean ?? stats.diet),
    activity_avg: toNum(
      stats.activity_avg ??
        stats.act_avg ??
        stats.activityMean ??
        stats.activity
    ),
    sleep_avg: toNum(stats.sleep_avg ?? stats.sleepMean ?? stats.sleep),
    stress_avg: toNum(stats.stress_avg ?? stats.stressMean ?? stats.stress),
  };
}

/** (4) 폴백: 최소한 age만 가져올 수 있으면 JSONP는 호출 가능 */
function collectAnswersFallback() {
  const selVal = (name) =>
    document.querySelector(`[name="${name}"]`)?.value || "";
  return { age: selVal("age") };
}
/* ==========================================================
   결과 하단에 "큰 흰 박스"로
   1) 동연령 '전체 평균'(총점)  2) 세부 평균(4개) 표시
   - 기존 코드/화면 삭제 없이 '추가'만 하면 됨
   ========================================================== */

/* (0) 웹앱 URL 탐색: 이미 정의돼 있으면 재사용 */
const __AVG_URL =
  (typeof PEER_WEB_APP_URL === "string" && PEER_WEB_APP_URL) ||
  (typeof WEB_APP_URL === "string" && WEB_APP_URL) ||
  "";

/* (1) JSONP 함수가 없으면 폴백 정의 */
if (typeof fetchPeerAverageJSONP !== "function") {
  window.fetchPeerAverageJSONP = function (ageLabel) {
    return new Promise((resolve, reject) => {
      if (!__AVG_URL) return resolve(null);
      const cb = `__peer_avg_cb_${Date.now()}`;
      window[cb] = (data) => {
        try {
          resolve(data);
        } finally {
          delete window[cb];
          try {
            s.remove();
          } catch {}
        }
      };
      const qs = new URLSearchParams({
        avg: "1",
        age: String(ageLabel || ""),
        callback: cb,
      });
      const s = document.createElement("script");
      s.src = `${__AVG_URL}?${qs.toString()}`;
      s.onerror = () => {
        delete window[cb];
        try {
          s.remove();
        } catch {}
        reject(new Error("JSONP load error"));
      };
      document.body.appendChild(s);
      setTimeout(() => {
        if (window[cb]) {
          delete window[cb];
          try {
            s.remove();
          } catch {}
          resolve(null);
        }
      }, 6000);
    });
  };
}
/* ==========================================================
   결과 카테고리 옆에 동연령 평균 표시 (박스 제거 버전)
   ========================================================== */
function renderPeerCategoryInline(stats) {
  if (!stats) return;

  const fmt = (v) =>
    typeof v === "number" && !Number.isNaN(v) ? Math.round(v) : null;

  const pickNum = (...vals) => {
    for (const v of vals) {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
    return null;
  };

  const setInlineAvg = (sel, avg) => {
    const el = document.querySelector(sel);
    if (!el || avg == null) return;
    let avgSpan = el.parentElement.querySelector(".peer-inline-avg");
    if (!avgSpan) {
      avgSpan = document.createElement("span");
      avgSpan.className = "peer-inline-avg";
      avgSpan.style.color = "#999";
      avgSpan.style.fontSize = "14px";
      avgSpan.style.marginLeft = "8px";
      avgSpan.style.fontWeight = "400";
      el.parentElement.appendChild(avgSpan);
    }
    avgSpan.textContent = `(평균 ${avg}점)`;
  };

  // ✅ 여러 키 중 첫 번째로 존재하는 값을 선택
  const activityAvg = pickNum(
    stats.activity_avg,
    stats.act_avg,
    stats.activityMean,
    stats.activity
  );

  setInlineAvg("#kvdiet", fmt(stats.diet_avg));
  setInlineAvg("#kvact", fmt(activityAvg)); // ✅ 수정된 부분
  setInlineAvg("#kvsleep", fmt(stats.sleep_avg));
  setInlineAvg("#kvstress", fmt(stats.stress_avg));
}

/* ==========================================================
     결과화면으로 전환된 후, 평균값 가져와 카테고리 옆에 표시
     ========================================================== */
(function attachInlineAvgHook() {
  if (window.__inlineAvgHookAttached) return;
  window.__inlineAvgHookAttached = true;

  const form = document.querySelector("#surveyForm");
  if (!form) return;

  form.addEventListener("submit", () => {
    setTimeout(async () => {
      try {
        const ageCode = document.querySelector('[name="age"]')?.value || "";
        const map = {
          10: "10대 이하",
          20: "20대",
          30: "30대",
          40: "40대",
          50: "50대 이상",
        };
        const ageLabel = map[ageCode] || "";
        const stats = await fetchPeerAverageJSONP(ageLabel).catch(() => null);
        if (stats) renderPeerCategoryInline(stats);
      } catch (e) {
        console.warn("[InlineAvg] failed:", e);
      }
    }, 200);
  });
})();
// 값 고르기: 숫자화 가능한 첫 번째 값을 반환
function pickNum() {
  for (const v of arguments) {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return NaN;
}
function renderPersonalFeedback(myScores, peerAverages) {
  const result = document.querySelector("#result");
  if (!result || !peerAverages) return;

  // 중복 생성 방지
  let box = document.querySelector("#feedbackBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "feedbackBox";
    box.style.marginTop = "24px";
    box.style.padding = "20px";
    box.style.background = "#ffffff";
    box.style.border = "1px solid rgba(0,0,0,0.08)";
    box.style.borderRadius = "12px";
    box.style.textAlign = "center";
    box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)";
    result.appendChild(box);
  }

  const lt = (a, b) => Number.isFinite(b) && a < b;
  const gt = (a, b) => Number.isFinite(b) && a > b;

  const lowMsgs = [];
  const highMsgs = [];

  if (lt(myScores.diet, peerAverages.diet_avg)) lowMsgs.push("식습관");
  else if (gt(myScores.diet, peerAverages.diet_avg)) highMsgs.push("식습관");

  if (lt(myScores.activity, peerAverages.activity_avg))
    lowMsgs.push("신체활동");
  else if (gt(myScores.activity, peerAverages.activity_avg))
    highMsgs.push("신체활동");

  if (lt(myScores.sleep, peerAverages.sleep_avg)) lowMsgs.push("수면");
  else if (gt(myScores.sleep, peerAverages.sleep_avg)) highMsgs.push("수면");

  if (lt(myScores.stress, peerAverages.stress_avg)) lowMsgs.push("스트레스");
  else if (gt(myScores.stress, peerAverages.stress_avg))
    highMsgs.push("스트레스");

  // 문장 생성
  const joinKR = (arr) => {
    if (arr.length <= 1) return arr.join("");
    if (arr.length === 2) return `${arr[0]}와 ${arr[1]}`;
    return `${arr.slice(0, -1).join(", ")} 그리고 ${arr[arr.length - 1]}`;
  };

  let sentence = "";
  if (lowMsgs.length > 0 && highMsgs.length === 0) {
    // 평균보다 낮은 항목만 있음 → 개선 안내
    sentence =
      `${joinKR(lowMsgs)} 점수가 평균보다 낮아요 🧐<br><br> ` +
      `하단의 <b>더 알아보기</b> 버튼을 눌러 도움이 되는 영상을 확인해보세요!`;
  } else if (lowMsgs.length === 0 && highMsgs.length > 0) {
    // 평균보다 높은 항목만 있음 → 칭찬
    sentence =
      `${joinKR(highMsgs)} 점수가 평균보다 높아요! 대단해요 🥳<br><br> ` +
      `저속노화에 대해 더 알고 싶다면 아래 버튼을 눌러보세요.`;
  } else if (lowMsgs.length > 0 && highMsgs.length > 0) {
    // 혼합: 칭찬 + 개선 함께
    sentence =
      `${joinKR(highMsgs)}, 평균보다 높아요. 잘하고 있어요 👏<br><br>` +
      `반면 ${joinKR(lowMsgs)}에서 조금 더 보완하면 좋아요. ` +
      `아래 <b>더 알아보기</b>에서 맞춤 도움을 받아보세요!`;
  } else {
    // 전부 비슷(동률)하거나 평균 없음 → 박스 숨김/종료
    box.remove();
    return;
  }

  box.innerHTML = `
    <p style="font-size:16px; font-weight:600; margin-bottom:30px;">${sentence}</p>
    <button id="helpButton"
      style="
        background-color:#00B87A; /* 메인 버튼 컬러와 동일하게 */
        color:#fff;
        border:none;
        border-radius:25px;
        padding:12px 28px;
        font-size:15px;
        cursor:pointer;
        font-weight:600;
        transition:transform .12s ease, box-shadow .12s ease;
        box-shadow:0 6px 14px rgba(0,184,122,0.28);">
      저속노화 더 알아보기 ▶
    </button>
  `;

  const btn = box.querySelector("#helpButton");
  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "translateY(-1px)";
    btn.style.boxShadow = "0 10px 18px rgba(0,184,122,0.34)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "translateY(0)";
    btn.style.boxShadow = "0 6px 14px rgba(0,184,122,0.28)";
  });
  btn.addEventListener("click", () => {
    toggleLearnMore(true);
  });
}
function toggleLearnMore(show) {
  const resultSection = document.querySelector("#result");
  const learnMoreSection = document.querySelector("#learnMore");
  const startSection = document.querySelector("#start");
  const cardSection = document.querySelector("#card");
  if (!learnMoreSection || !resultSection) return;

  if (show) {
    resultSection.classList.add("hidden");
    startSection?.classList.add("hidden");
    cardSection?.classList.add("hidden");
    learnMoreSection.classList.remove("hidden");
  } else {
    learnMoreSection.classList.add("hidden");
    resultSection.classList.remove("hidden");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
/* ===== Learn More (영상 추천) ===== */
(function initLearnMore() {
  const resultSection = document.querySelector("#result");
  const learnMoreSection = document.querySelector("#learnMore");
  const startSection = document.querySelector("#start");
  const cardSection = document.querySelector("#card");

  const btnLearnMore = document.getElementById("btnLearnMore");
  const btnBack = document.getElementById("btnBackToResult");

  if (btnLearnMore && learnMoreSection && resultSection) {
    btnLearnMore.addEventListener("click", () => {
      // 결과 숨김 → 추천 보이기
      resultSection.classList.add("hidden");
      startSection?.classList.add("hidden");
      cardSection?.classList.add("hidden");
      learnMoreSection.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (btnBack && learnMoreSection && resultSection) {
    btnBack.addEventListener("click", () => {
      // 추천 숨김 → 결과 보이기
      learnMoreSection.classList.add("hidden");
      resultSection.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // 썸네일 자동 세팅 (YouTube id → 썸네일)
  document.querySelectorAll("#learnMore .thumb").forEach((el) => {
    const id = el.getAttribute("data-yt");
    if (!id) return;
    // 기본 고화질 썸네일
    el.style.backgroundImage = `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)`;
  });
})();
