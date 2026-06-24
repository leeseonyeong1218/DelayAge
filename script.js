/* =========================================================
   DELAGE – script.js (전면 리디자인)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ── 상태 ── */
  const state = {
    nick: '',
    age: '',
    gender: '',
    answers: {},   // { diet_veg: 5, act_minutes: 3, ... }
    scores: {},    // { diet: 0, activity: 0, sleep: 0, stress: 0 }
    peerAvg: null, // 서버에서 받아온 동연령 평균
  };

  /* ── DOM 캐시 ── */
  const $ = id => document.getElementById(id);

  const screens = {
    main:    $('s-main'),
    nick:    $('s-nick'),
    info:    $('s-info'),
    survey:  $('s-survey'),
    loading: $('s-loading'),
    result:  $('s-result'),
    custom:  $('s-custom'),
  };

  /* ── 화면 전환 ── */
  function goTo(name) {
    Object.values(screens).forEach(s => {
      s.classList.remove('active');
      s.classList.add('hidden');
    });
    screens[name].classList.remove('hidden');
    screens[name].classList.add('active');
  }

  /* ================================================================
     눈알 마우스 트래킹
     ================================================================ */
  function initEyeTracking() {
    const MAX_OFFSET = 14; // 동공이 움직일 수 있는 최대 반경(px)

    function trackEyes(e) {
      const mx = e.clientX ?? (e.touches?.[0]?.clientX);
      const my = e.clientY ?? (e.touches?.[0]?.clientY);
      if (mx == null) return;

      document.querySelectorAll('.card-eye').forEach(eye => {
        const rect = eye.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top  + rect.height / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ratio = Math.min(dist, MAX_OFFSET) / dist;
        const pupil = eye.querySelector('.card-pupil');
        if (pupil) {
          pupil.style.transform = `translate(${dx * ratio}px, ${dy * ratio}px)`;
        }
      });
    }

    window.addEventListener('mousemove', trackEyes);
    window.addEventListener('touchmove', trackEyes, { passive: true });
  }

  initEyeTracking();

  /* ================================================================
     메인 화면
     ================================================================ */
  $('btn-start').addEventListener('click', () => goTo('nick'));

  /* ================================================================
     닉네임 화면
     ================================================================ */
  const nickInput  = $('nick-input');
  const btnNickNext = $('btn-nick-next');
  const nickRe = /^[가-힣]{1,4}$/;

  nickInput.addEventListener('input', () => {
    const v = nickInput.value.trim();
    btnNickNext.disabled = !nickRe.test(v);
  });

  btnNickNext.addEventListener('click', () => {
    state.nick = nickInput.value.trim();
    goTo('info');
  });

  /* ================================================================
     기본 정보 화면
     ================================================================ */
  const selAge    = $('sel-age');
  const selGender = $('sel-gender');
  const btnInfoNext = $('btn-info-next');

  function checkInfo() {
    btnInfoNext.disabled = !(selAge.value && selGender.value);
  }
  selAge.addEventListener('change', checkInfo);
  selGender.addEventListener('change', checkInfo);

  btnInfoNext.addEventListener('click', () => {
    state.age    = selAge.value;
    state.gender = selGender.value;
    goTo('survey');
    showSurveyStep(1);
  });

  /* ================================================================
     게이지 바
     ================================================================ */
  const gaugeFill = $('gauge-fill');
  const gNodes = [null, $('gn1'), $('gn2'), $('gn3'), $('gn4')];
  const FILL_PCT = [null, '0%', '33%', '67%', '100%'];

  function updateGauge(step) {
    gaugeFill.style.width = FILL_PCT[step];
    for (let i = 1; i <= 4; i++) {
      const n = gNodes[i];
      n.classList.remove('active', 'done');
      if (i < step)  n.classList.add('done');
      if (i === step) n.classList.add('active');
    }
  }

  /* ================================================================
     설문 스텝 전환
     ================================================================ */
  const steps = [null,
    $('step-1'), $('step-2'), $('step-3'), $('step-4')
  ];

  // 각 스텝의 필수 질문 키
  const STEP_QS = {
    1: ['diet_veg', 'diet_protein', 'diet_processed', 'diet_late', 'diet_water'],
    2: ['act_minutes', 'act_strength', 'act_sitting'],
    3: ['sleep_hours', 'sleep_regular'],
    4: ['stress_level', 'stress_manage', 'stress_screen'],
  };

  function showSurveyStep(n) {
    for (let i = 1; i <= 4; i++) {
      steps[i].classList.toggle('hidden', i !== n);
    }
    updateGauge(n);
    refreshNextBtn(n);
  }

  /* ── 옵션 선택 ── */
  function allAnswered(stepN) {
    return STEP_QS[stepN].every(k => state.answers[k] !== undefined);
  }

  function refreshNextBtn(stepN) {
    const btn = steps[stepN].querySelector('.btn-next');
    btn.disabled = !allAnswered(stepN);
  }

  // 옵션 클릭 이벤트 – 모든 .opt 버튼
  document.querySelectorAll('.q-block').forEach(block => {
    const qKey = block.dataset.q;
    block.querySelectorAll('.opt').forEach(btn => {
      btn.addEventListener('click', () => {
        // 같은 블록 내 선택 해제
        block.querySelectorAll('.opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.answers[qKey] = Number(btn.dataset.val);

        // 현재 스텝 번호 알아내기
        const stepEl = btn.closest('.survey-step');
        const stepN  = Number(stepEl.dataset.step);
        refreshNextBtn(stepN);
      });
    });
  });

  // 다음 단계 버튼
  document.querySelectorAll('.js-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const stepEl = btn.closest('.survey-step');
      const stepN  = Number(stepEl.dataset.step);
      showSurveyStep(stepN + 1);
    });
  });

  // 결과 보기 버튼 (마지막 스텝)
  document.querySelector('.js-submit').addEventListener('click', () => {
    startLoading();
  });

  /* ================================================================
     로딩 (3초, 4캐릭터 400ms 순환)
     ================================================================ */
  const LOAD_CHARS = [
    'image/Artboard 4@300x.png',
    'image/Artboard 6@300x.png',
    'image/Artboard 5@300x.png',
    'image/Artboard 7@300x.png',
  ];
  const loadCharImg = $('loading-char');

  function startLoading() {
    // 설문 화면 위에 오버레이로 표시 (goTo 대신 직접 토글)
    $('s-loading').classList.remove('hidden');
    let idx = 0;
    loadCharImg.src = LOAD_CHARS[0];
    const iv = setInterval(() => {
      idx = (idx + 1) % LOAD_CHARS.length;
      loadCharImg.src = LOAD_CHARS[idx];
    }, 400);

    setTimeout(() => {
      clearInterval(iv);
      $('s-loading').classList.add('hidden');
      calcScores();
      fetchPeerAvg(() => {
        renderResult();
        goTo('result');
      });
    }, 3000);
  }

  /* ================================================================
     점수 계산 (각 영역 최대 25점 만점 정규화)
     ================================================================ */
  function calcScores() {
    const a = state.answers;

    // 식습관: 5문항 × 최대5 = 25
    const dietRaw = (a.diet_veg||0) + (a.diet_protein||0) +
                    (a.diet_processed||0) + (a.diet_late||0) + (a.diet_water||0);
    state.scores.diet = Math.round(dietRaw);

    // 신체활동: 3문항 × 최대5 = 15 → ×(25/15) 정규화
    const actRaw = (a.act_minutes||0) + (a.act_strength||0) + (a.act_sitting||0);
    state.scores.activity = Math.round(actRaw * (25/15));

    // 수면: 2문항 × 최대5 = 10 → ×(25/10)
    const slpRaw = (a.sleep_hours||0) + (a.sleep_regular||0);
    state.scores.sleep = Math.round(slpRaw * (25/10));

    // 스트레스: 3문항 × 최대5 = 15 → ×(25/15)
    const strRaw = (a.stress_level||0) + (a.stress_manage||0) + (a.stress_screen||0);
    state.scores.stress = Math.round(strRaw * (25/15));
  }

  /* ================================================================
     동연령 평균 (Google Apps Script JSONP)
     ================================================================ */
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxjhKVmXGNdSyvD-kDVFRhcRbwCXrKqhxC3TJt7N6wjMr8Gm-jSO1pVDGMd91EqCkl/exec';

  function fetchPeerAvg(cb) {
    const fn = 'delageCallback_' + Date.now();
    const done = (data) => {
      state.peerAvg = data;
      cb();
    };
    const timeout = setTimeout(() => { done(null); }, 4000);

    window[fn] = (data) => {
      clearTimeout(timeout);
      delete window[fn];
      done(data);
    };

    const s = document.createElement('script');
    s.onerror = () => { clearTimeout(timeout); delete window[fn]; done(null); };
    s.src = `${GAS_URL}?callback=${fn}&age=${state.age}&gender=${state.gender}`;
    document.head.appendChild(s);
  }

  /* ================================================================
     결과 화면 렌더링
     ================================================================ */
  const CAT_META = {
    diet:     { label: '식습관',  char: 'image/Artboard 4@300x.png', theme: 'theme-diet',     txtCls: 'diet-txt'     },
    activity: { label: '신체활동', char: 'image/Artboard 6@300x.png', theme: 'theme-activity', txtCls: 'activity-txt' },
    sleep:    { label: '수면',    char: 'image/Artboard 5@300x.png', theme: 'theme-sleep',    txtCls: 'sleep-txt'    },
    stress:   { label: '스트레스', char: 'image/Artboard 7@300x.png', theme: 'theme-stress',   txtCls: 'stress-txt'   },
  };
  const CAT_ORDER = ['diet', 'activity', 'sleep', 'stress'];
  let barChart = null;

  function rankedCats() {
    return [...CAT_ORDER].sort((a, b) => state.scores[b] - state.scores[a]);
  }

  function renderResult() {
    const ranked = rankedCats();
    const topCat = ranked[0];
    const meta   = CAT_META[topCat];
    const s      = state.scores;
    const total  = s.diet + s.activity + s.sleep + s.stress;

    // 테마
    const arch = $('result-arch');
    arch.className = 'result-arch ' + meta.theme;

    // 캐릭터 메달
    $('result-char-img').src = meta.char;

    // 닉네임 / 총점
    $('result-name').textContent = `${state.nick}님의 저속노화 점수`;
    $('result-total').textContent = total;

    // 점수 행
    const ids = { diet: 'r-diet', activity: 'r-act', sleep: 'r-sleep', stress: 'r-stress' };
    const avgIds = { diet: 'r-diet-avg', activity: 'r-act-avg', sleep: 'r-sleep-avg', stress: 'r-stress-avg' };
    CAT_ORDER.forEach(cat => {
      $(ids[cat]).textContent  = s[cat] + '점';
      const avg = state.peerAvg ? state.peerAvg[cat] : null;
      $(avgIds[cat]).textContent = avg !== null ? `(평균 ${avg}점)` : '';
    });

    // 동연령 메시지
    if (state.peerAvg) {
      const peerTotal = (state.peerAvg.diet||0) + (state.peerAvg.activity||0) +
                        (state.peerAvg.sleep||0) + (state.peerAvg.stress||0);
      const diff = total - peerTotal;
      $('result-peer-msg').textContent =
        diff >= 0
          ? `동연령 평균보다 ${diff}점 높아요!`
          : `동연령 평균보다 ${Math.abs(diff)}점 낮아요.`;
    } else {
      $('result-peer-msg').textContent = '';
    }

    // 바 차트
    renderChart(s, state.peerAvg);
  }

  function renderChart(s, peer) {
    const ctx = $('barChart').getContext('2d');
    if (barChart) barChart.destroy();

    const labels = ['식습관', '신체활동', '수면', '스트레스'];
    const myData  = [s.diet, s.activity, s.sleep, s.stress];
    const peerData = peer
      ? [peer.diet, peer.activity, peer.sleep, peer.stress]
      : null;

    const datasets = [{
      label: '나',
      data: myData,
      backgroundColor: ['#E8784A','#5B8DEF','#8B6BC8','#F5C234'],
      borderRadius: 8,
      borderSkipped: false,
    }];

    if (peerData) {
      datasets.push({
        label: '동연령 평균',
        data: peerData,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 8,
        borderSkipped: false,
      });
    }

    barChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 12 } } },
        },
        scales: {
          y: { min: 0, max: 25, grid: { color: '#F0F0F0' },
               ticks: { stepSize: 5, font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { size: 12 } } },
        },
      },
    });
  }

  /* ================================================================
     커스텀 페이지 렌더링
     ================================================================ */
  const FEEDBACK = {
    diet: [
      '채소와 단백질 섭취를 늘려보세요. 하루 2회 이상 균형 잡힌 식사가 저속노화의 핵심이에요.',
      '가공식품과 야식을 줄이고 규칙적인 식사 시간을 지켜보세요.',
      '하루 2L 이상의 충분한 수분 섭취가 세포 노화를 늦춰줘요.',
    ],
    activity: [
      '주 3회 이상, 150분 목표로 유산소 운동을 시작해보세요.',
      '근력 운동을 주 2회 이상 추가하면 근손실을 예방할 수 있어요.',
      '매시간 5분씩 스트레칭으로 좌식 시간을 줄여보세요.',
    ],
    sleep: [
      '7~8시간의 규칙적인 수면 패턴이 저속노화에 가장 중요해요.',
      '취침 시간과 기상 시간을 일정하게 유지해 생체 리듬을 맞춰보세요.',
    ],
    stress: [
      '하루 10분 명상이나 복식호흡으로 스트레스 호르몬을 낮춰보세요.',
      '취침 1시간 전 스크린 사용을 줄이면 수면의 질도 올라가요.',
      '주기적인 야외 활동과 사회적 교류가 스트레스 해소에 효과적이에요.',
    ],
  };

  function renderCustom() {
    const ranked  = rankedCats();
    const botCat  = ranked[ranked.length - 1];   // 최저
    const bot2Cat = ranked[ranked.length - 2];   // 2번째 최저

    const arch = $('custom-arch');
    arch.className = 'custom-arch ' + CAT_META[botCat].theme;

    $('custom-subtitle').textContent =
      `${state.nick}님을 위한 맞춤 저속노화 실천 팁이에요.`;

    const area = $('custom-feedback-area');
    area.innerHTML = '';

    [botCat, bot2Cat].forEach((cat, idx) => {
      const m  = CAT_META[cat];
      const fb = FEEDBACK[cat];
      const div = document.createElement('div');
      div.className = 'fb-item';
      div.innerHTML = `
        <div class="fb-step-tag">STEP 0${idx + 1}</div>
        <div class="fb-category ${m.txtCls}">${m.label}</div>
        <div class="fb-text">${fb.join('<br><br>')}</div>
      `;
      area.appendChild(div);
    });
  }

  /* ================================================================
     버튼 – 결과 → 커스텀 / 다시하기 / 공유
     ================================================================ */
  $('btn-to-custom').addEventListener('click', () => {
    renderCustom();
    goTo('custom');
  });

  $('btn-retry').addEventListener('click', () => resetAll());
  $('btn-custom-retry').addEventListener('click', () => goTo('result'));
  $('btn-custom-share').addEventListener('click', () => shareResult());

  function shareResult() {
    const total = Object.values(state.scores).reduce((a,b) => a+b, 0);
    const text  = `[DELAGE 딜레이지] ${state.nick}님의 저속노화 총점: ${total}/100점 🌿`;
    if (navigator.share) {
      navigator.share({ title: 'DELAGE 딜레이지', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text)
        .then(() => alert('결과가 클립보드에 복사되었어요!'))
        .catch(() => alert(text));
    }
  }

  /* ================================================================
     전체 리셋
     ================================================================ */
  function resetAll() {
    state.nick = '';
    state.age  = '';
    state.gender = '';
    state.answers = {};
    state.scores  = {};
    state.peerAvg = null;

    nickInput.value = '';
    btnNickNext.disabled = true;
    selAge.value = '';
    selGender.value = '';
    btnInfoNext.disabled = true;

    // 설문 선택 초기화
    document.querySelectorAll('.opt').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.btn-next').forEach(b => { b.disabled = true; });

    if (barChart) { barChart.destroy(); barChart = null; }

    goTo('main');
  }

}); // DOMContentLoaded
