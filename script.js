// ✅ 당신의 웹앱 URL
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwIbhY8Qd9VteASqR8v1SJNLdFo2hp6zGCfrYia3iHTaZLR2JTh5jFIJ4OxW9ERBfsY/exec";

document.addEventListener("DOMContentLoaded", () => {
  const formEl = document.querySelector("#surveyForm");
  const cardEl = document.querySelector("#card");
  const resultEl = document.querySelector("#result");
  const retryBtn = document.querySelector("#retry");

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    const answers = collectAnswers(formEl);
    const { areaScores, totalScore } = calcScores(answers);

    // ⬇️ 숫자(20) → 라벨(20대)로 변환하여 평균 요청
    const ageLabelMap = { "10":"10대 이하", "20":"20대", "30":"30대", "40":"40대", "50":"50대 이상" };
    const stats = await fetchPeerAverage(ageLabelMap[answers.age] || "").catch(()=>null);
    const peerTotal = stats?.total_avg ?? 0;
    const count = stats?.count ?? 0;

    renderResult(areaScores, totalScore, peerTotal, count);

    // 저장 (no-cors)
    const payload = buildPayload(areaScores, totalScore, answers);
    saveToSheet(payload);

    // 화면 전환
    cardEl.classList.add("hidden");
    resultEl.classList.remove("hidden");
  });

  retryBtn?.addEventListener("click", () => {
    resultEl.classList.add("hidden");
    cardEl.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

/* ====== 수집 ====== */
function collectAnswers(form){
  const get = (name) => Number(form.querySelector(`input[name="${name}"]:checked`)?.value || 0);
  const sel = (name) => form.querySelector(`[name="${name}"]`)?.value || "";
  return {
    age: sel("age"),
    gender: sel("gender"),
    // 식습관
    diet_veg: get("diet_veg"),
    diet_protein: get("diet_protein"),
    diet_processed: get("diet_processed"),
    diet_late: get("diet_late"),
    diet_water: get("diet_water"),
    // 활동
    act_minutes: get("act_minutes"),
    act_strength: get("act_strength"),
    act_sitting: get("act_sitting"),
    // 수면
    sleep_hours: get("sleep_hours"),
    sleep_regular: get("sleep_regular"),
    // 스트레스
    stress_level: get("stress_level"),
    stress_coping: get("stress_coping"),
    stress_sleep: get("stress_sleep"),
  };
}

/* ====== 점수 계산 (25점×4영역) ====== */
function calcScores(a){
  const diet = (a.diet_veg + a.diet_protein + a.diet_processed + a.diet_late + a.diet_water) / (5*5) * 25;
  const activity = (a.act_minutes + a.act_strength + a.act_sitting) / (3*5) * 25;
  const sleep = (a.sleep_hours + a.sleep_regular) / (2*5) * 25;
  const stress = (a.stress_level + a.stress_coping + a.stress_sleep) / (3*5) * 25;
  const areaScores = {
    diet: Math.round(diet),
    activity: Math.round(activity),
    sleep: Math.round(sleep),
    stress: Math.round(stress),
  };
  const totalScore = Math.round(areaScores.diet + areaScores.activity + areaScores.sleep + areaScores.stress);
  return { areaScores, totalScore };
}

/* ====== 결과 렌더 ====== */
let radarChart, barChart;
function renderResult(area, total, peerTotal, count){
  const summary = document.querySelector("#summaryText");
  const diff = Math.abs(total - peerTotal).toFixed(1);
  summary.innerHTML =
    `당신의 딜레이지 점수는 <b>${total}점</b>입니다. ` +
    `동연령 평균은 <b>${peerTotal}점</b>이며, ` +
    `${total >= peerTotal ? '평균보다 높아요' : '평균보다 낮아요'} (차이 ${diff}점).`;

  document.querySelector("#peerMeta").textContent = `현재 참여자 ${count}명 기준`;
  document.querySelector("#kvdiet").textContent = `${area.diet}점`;
  document.querySelector("#kvact").textContent = `${area.activity}점`;
  document.querySelector("#kvsleep").textContent = `${area.sleep}점`;
  document.querySelector("#kvstress").textContent = `${area.stress}점`;

  drawRadar(area);
  drawBar(total, peerTotal);
}

/* ====== 저장 ====== */
function buildPayload(areaScores, totalScore, answers){
  const ageMap={ "10":"10대 이하","20":"20대","30":"30대","40":"40대","50":"50대 이상" };
  const genderMap={ "0":"밝히고 싶지 않음","1":"남성","2":"여성","3":"기타" };
  return {
    age_group: ageMap[answers.age] || '',
    gender: genderMap[answers.gender] || '',
    areaScores, totalScore,
    answers
  };
}
async function saveToSheet(payload){
  try{
    await fetch(WEB_APP_URL,{
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
  }catch(e){ console.error('Saving failed:', e); }
}

/* ====== 평균(JSONP) ====== */
function fetchPeerAverage(ageLabel){
  return new Promise((resolve, reject)=>{
    const cb = `__avg_cb_${Date.now()}`;
    window[cb] = (data)=>{ try{ resolve(data); } finally{ delete window[cb]; s.remove(); } };
    const qs = new URLSearchParams({ avg:'1', age:String(ageLabel||''), callback:cb });
    const s = document.createElement('script');
    s.src = `${WEB_APP_URL}?${qs.toString()}`;
    s.onerror = ()=>{ delete window[cb]; try{s.remove();}catch{}; reject(new Error('JSONP load error')); };
    document.body.appendChild(s);
    setTimeout(()=>{ if(window[cb]){ delete window[cb]; try{s.remove();}catch{}; resolve(null);} }, 6000);
  });
}

/* ====== 차트 ====== */
function drawRadar(area){
  const ctx = document.getElementById('radarChart')?.getContext('2d');
  if(!ctx) return;
  radarChart?.destroy();
  radarChart = new Chart(ctx,{
    type:'radar',
    data:{
      labels:['식습관','신체활동','수면','스트레스'],
      datasets:[{
        label:'나',
        data:[area.diet, area.activity, area.sleep, area.stress],
        backgroundColor:'rgba(76,201,255,.30)',
        borderColor:'#6C63FF', borderWidth:2, pointBackgroundColor:'#6C63FF'
      }]
    },
    options:{
      responsive:true,
      scales:{ r:{ suggestedMin:0, suggestedMax:25, ticks:{ stepSize:5 } } },
      plugins:{ legend:{ display:false } }
    }
  });
}
function drawBar(me, peer){
  const ctx = document.getElementById('barChart')?.getContext('2d');
  if(!ctx) return;
  barChart?.destroy();
  barChart = new Chart(ctx,{
    type:'bar',
    data:{
      labels:['나','동연령 평균'],
      datasets:[{ label:'점수', data:[me, peer], backgroundColor:['#6C63FF','#4CC9FF'] }]
    },
    options:{
      responsive:true,
      scales:{ y:{ suggestedMin:0, suggestedMax:100, ticks:{ stepSize:10 } } },
      plugins:{ legend:{ display:false } }
    }
  });
}