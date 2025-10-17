// ===== 팔레트 =========================================================
const BLUE = { primary:"#6C63FF", accent:"#4CC9FF" };

// ===== GAS Web App URL (배포 URL로 교체) ==============================
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyYx_SpaivLhxbGpGc4WGHC1VXKTLniFO59lhIst1BCUZLVT0Mz2yHUMUzy71IqCCgD/exec";

// ===== 설문 정의 ======================================================
const SURVEY = [ /* (이전과 동일 — 생략 안 하고 실제 동작 위해 아래 전체 유지) */ 
  {
    key: "basic", title: "기본정보", subtitle: "점수에는 반영되지 않아요 (참고용)", weight: 0,
    questions: [
      { id:"age", label:"현재 나이대를 선택해주세요.", type:"single",
        choices:["10대 이하","20대","30대","40대","50대 이상"].map((t,i)=>({label:t,value:[10,20,30,40,50][i]})) },
      { id:"gender", label:"성별을 선택해주세요.", type:"single",
        choices:["남성","여성","기타","밝히고 싶지 않음"].map((t,i)=>({label:t,value:i})) },
      { id:"height", label:"(선택) 키(cm)", type:"number" },
      { id:"weight", label:"(선택) 체중(kg)", type:"number" },
    ]
  },
  {
    key: "diet", title: "식습관", subtitle: "총 25점", weight:25,
    questions: [
      q("diet_veg","하루에 채소나 과일을 얼마나 섭취하시나요?",[c("거의 먹지 않는다",0),c("하루 1회",3),c("하루 2회 이상",5)]),
      q("diet_protein","단백질(육류, 달걀, 콩류 등)을 얼마나 자주 섭취하시나요?",[c("거의 안 먹는다",0),c("하루 1회",3),c("하루 2회 이상",5)]),
      q("diet_processed","가공식품(패스트푸드, 인스턴트, 과자 등)을 얼마나 자주 섭취하시나요?",[c("주 3회 이상",0),c("주 1~2회",3),c("거의 안 먹는다",5)]),
      q("diet_late","야식이나 늦은 시간 식사를 자주 하시나요?",[c("자주 한다",0),c("가끔 한다",3),c("거의 안 한다",5)]),
      q("diet_water","하루에 물을 얼마나 마시나요?",[c("1L 미만",0),c("1~2L",3),c("2L 이상",5)]),
    ]
  },
  {
    key: "activity", title: "신체활동", subtitle: "총 25점", weight:25,
    questions: [
      q("act_minutes","일주일 동안 총 운동 시간은 얼마나 되나요?",[c("전혀 하지 않는다",0),c("주 1~2회 (30~60분)",3),c("주 3회 이상 (150분 이상)",5)]),
      q("act_strength","근력운동(웨이트, 필라테스 등)을 주 몇 회 하시나요?",[c("전혀 안 함",0),c("주 1회",3),c("주 2회 이상",5)]),
      q("act_sitting","하루 평균 앉아있는 시간(좌식시간)은 얼마나 되나요?",[c("9시간 이상",0),c("5~8시간",3),c("4시간 이하",5)]),
    ]
  },
  {
    key: "sleep", title: "수면", subtitle: "총 25점", weight:25,
    questions: [
      q("sleep_hours","평균적으로 몇 시간 주무시나요?",[c("5시간 이하",0),c("6~7시간",3),c("7~8시간",5)]),
      q("sleep_regular","잠드는 시간과 기상 시간이 일정한 편인가요?",[c("매우 불규칙하다",0),c("약간 일정하다",3),c("매우 규칙적이다",5)]),
    ]
  },
  {
    key: "stress", title: "스트레스", subtitle: "총 25점", weight:25,
    questions: [
      q("stress_level","지난 2주간 전반적인 스트레스 수준은 어떠했나요?",[c("매우 높다",0),c("보통이다",3),c("낮다",5)]),
      q("stress_coping","호흡/명상/산책 등으로 스트레스를 관리했나요?",[c("거의 안 했다",0),c("가끔 했다",3),c("규칙적으로 했다",5)]),
      q("stress_sleep","취침 1시간 전 스크린 사용(휴대폰/노트북)을 줄이나요?",[c("줄이지 않는다",0),c("가끔 줄인다",3),c("거의 사용하지 않는다",5)]),
    ]
  }
];
function q(id,label,choices){ return { id, label, type:"single", choices }; }
function c(label,value){ return { label, value }; }

// ===== 상태/DOM ======================================================
const $ = s => document.querySelector(s);
const card = $("#card"), result = $("#result");
const progressFill = $("#progressFill"), progressIndex = $("#progressIndex");
const yearEl = $("#year"), nextFab = $("#nextFab");
yearEl.textContent = new Date().getFullYear();

let step = 0;
const answers = {};
renderStep();

// ===== 렌더링 ========================================================
function renderStep(){
  const section = SURVEY[step];
  progressIndex.textContent = `${step+1} / ${SURVEY.length}`;
  progressFill.style.width = `${((step+1)/SURVEY.length)*100}%`;

  result.classList.add("hidden");
  card.classList.remove("hidden");
  showChrome(true);

  card.innerHTML = `
    <h2 class="card-title">${section.title}</h2>
    ${section.subtitle ? `<p class="muted">${section.subtitle}</p>` : ""}
    <div class="q-wrap"></div>
    <div class="nav-row">
      <button id="prevBtn" class="btn ghost"${step===0?" disabled":""}>이전</button>
      <button id="nextBtn" class="btn"${!isSectionAnswered(section)?" disabled":""}>${step<SURVEY.length-1?"다음":"결과 보기"}</button>
    </div>
  `;

  const qWrap = card.querySelector(".q-wrap");
  section.questions.forEach(q=>{
    const box = document.createElement("div");
    box.className="q-box"; box.innerHTML = `<div class="q-title">${q.label}</div>`;
    if(q.type==="single"){
      const wrap = document.createElement("div"); wrap.className="choices";
      q.choices.forEach(ch=>{
        const b = document.createElement("button");
        b.className="choice"; b.textContent = ch.label;
        if(answers[q.id]===ch.value) b.classList.add("active");
        b.onclick = ()=>{ answers[q.id]=ch.value; renderStep(); };
        wrap.appendChild(b);
      });
      box.appendChild(wrap);
    }else{
      const input = document.createElement("input");
      input.type="number"; input.className="input"; input.placeholder="선택 입력";
      input.value = answers[q.id] ?? ""; input.oninput = e=>answers[q.id]=Number(e.target.value);
      box.appendChild(input);
    }
    qWrap.appendChild(box);
  });

  $("#prevBtn").onclick = ()=>{ if(step>0){ step--; renderStep(); } };
  $("#nextBtn").onclick = onNext;
  nextFab.onclick = onNext;
  nextFab.disabled = !isSectionAnswered(section);
}
function onNext(){
  const section = SURVEY[step];
  if(!isSectionAnswered(section)) return;
  if(step < SURVEY.length-1){ step++; renderStep(); }
  else{
    const { areaScores, totalScore } = calcScores();
    showResult(areaScores, totalScore);
  }
}
function isSectionAnswered(section){
  return section.questions.every(q=> q.type==="number" ? true : answers[q.id]!==undefined );
}

// ===== 점수/결과 ======================================================
function calcScores(){
  const area = {}; let total = 0;
  SURVEY.forEach(sec=>{
    if(sec.weight===0){ area[sec.key]=0; return; }
    const sum = sec.questions.reduce((a,q)=> a + (typeof answers[q.id]==="number"?answers[q.id]:0), 0);
    const max = sec.questions.length * 5;
    const scaled = max? (sum/max)*sec.weight : 0;
    area[sec.key] = Math.round(scaled); total += scaled;
  });
  return { areaScores: area, totalScore: Math.round(total) };
}

async function showResult(areaScores, totalScore){
  showChrome(false);
  card.classList.add("hidden");
  result.classList.remove("hidden");

  // ▼ 실제 평균 불러오기(JSONP). age는 10|20|30|40|50
  const ageNum = answers["age"];
  const peer = await fetchPeerAverage(ageNum).catch(()=>null);
  const peerAvg = (peer && peer.total_avg) ? peer.total_avg : estimatePeerAvg(ageNum);
  const participantCount = peer && typeof peer.count==='number' ? peer.count : 0;

  $("#summaryText").innerHTML =
    `당신의 딜레이지 점수는 <b>${totalScore}점</b> 입니다. ` +
    `이는 동연령대 평균보다 <b>${Math.abs(totalScore-peerAvg)}점 ${totalScore>=peerAvg?"높으며":"낮으며"}</b> 입니다.`;

  const ageLabel = ({10:"10대 이하",20:"20대",30:"30대",40:"40대",50:"50대 이상"})[ageNum] || "전체";
  $("#peerMeta").textContent = `현재 참여자 ${participantCount}명 기준 (${ageLabel} 평균)`;

  $("#strength").textContent = strongest(areaScores);
  $("#weakness").textContent = weakest(areaScores);

  const suggestions = buildSuggestions(answers);
  const ul = $("#suggestList"); ul.innerHTML = "";
  suggestions.forEach(s=>{ const li=document.createElement("li"); li.textContent=s; ul.appendChild(li); });

  drawRadar(areaScores);
  drawBar(totalScore, peerAvg);

  // 자동 저장(시트로)
  const payload = buildPayload(areaScores, totalScore);
  saveToSheet(payload);

  $("#retryBtn").onclick = ()=>{
    for(const k of Object.keys(answers)) delete answers[k];
    step = 0; renderStep(); window.scrollTo({top:0,behavior:"smooth"});
  };
  $("#printBtn").onclick = ()=> window.print();
}

// 상단 UI 토글
function showChrome(show){
  [".site-header",".progress-wrap",".site-footer",".fab-wrap"].forEach(sel=>{
    const el = document.querySelector(sel); if(el) el.style.display = show ? "" : "none";
  });
}

function estimatePeerAvg(age){ const a=age||30; return Math.round(a>=40?62:a>=30?66:70); }
function strongest(area){ const s=Object.entries(area).filter(([k])=>k!=="basic").sort((a,b)=>b[1]-a[1]); return labelOf(s[0]?.[0])||"-"; }
function weakest(area){ const s=Object.entries(area).filter(([k])=>k!=="basic").sort((a,b)=>a[1]-b[1]); return labelOf(s[0]?.[0])||"-"; }
function labelOf(key){ return ({diet:"식습관",activity:"신체활동",sleep:"수면",stress:"스트레스"})[key]||key; }
function buildSuggestions(a){
  const out=[]; if((a["act_strength"]??0)<5) out.push("주 2회 근력운동 추가");
  if((a["stress_sleep"]??0)<5) out.push("취침 전 스크린 OFF");
  if((a["diet_water"]??0)>=3) out.push("하루 2L 수분 섭취 유지");
  if((a["sleep_regular"]??0)<5) out.push("기상·취침 시간 고정하기");
  if((a["diet_processed"]??0)<5) out.push("가공식품 주 1회 이하");
  return out.slice(0,4);
}

// ===== 저장 전송 =====================================================
function buildPayload(areaScores,totalScore){
  const ageMap={10:'10대 이하',20:'20대',30:'30대',40:'40대',50:'50대 이상'};
  const genderMap={0:'밝히고 싶지 않음',1:'남성',2:'여성',3:'기타'};
  return {
    userAgent:navigator.userAgent,
    age_group:ageMap[answers.age]||'', gender:genderMap[answers.gender]||'',
    height:answers.height||'', weight:answers.weight||'',
    areaScores, totalScore,
    answers:{
      diet_veg:answers.diet_veg, diet_protein:answers.diet_protein, diet_processed:answers.diet_processed,
      diet_late:answers.diet_late, diet_water:answers.diet_water,
      act_minutes:answers.act_minutes, act_strength:answers.act_strength, act_sitting:answers.act_sitting,
      sleep_hours:answers.sleep_hours, sleep_regular:answers.sleep_regular,
      stress_level:answers.stress_level, stress_coping:answers.stress_coping, stress_sleep:answers.stress_sleep
    }
  };
}
async function saveToSheet(payload){
  if(!WEB_APP_URL || WEB_APP_URL.startsWith('PASTE_')) return;
  try{
    await fetch(WEB_APP_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  }catch(e){console.error('Saving failed:',e);}
}

// ===== 평균(JSONP) 불러오기 =========================================
function fetchPeerAverage(ageNum){
  return new Promise((resolve,reject)=>{
    if(!WEB_APP_URL || WEB_APP_URL.startsWith('PASTE_')) return resolve(null);
    const cb=`__avg_cb_${Date.now()}`;
    window[cb]=data=>{ try{resolve(data);}finally{delete window[cb]; s.remove();} };
    const params=new URLSearchParams({avg:'1',age:String(ageNum||''),callback:cb});
    const s=document.createElement('script'); s.src=`${WEB_APP_URL}?${params.toString()}`;
    s.onerror=()=>{delete window[cb]; reject(new Error('JSONP load error'));};
    document.body.appendChild(s);
    setTimeout(()=>{ if(window[cb]){delete window[cb]; try{s.remove();}catch{}; resolve(null);} },5000);
  });
}

// ===== 차트 ==========================================================
let radarChart, barChart;
function drawRadar(area){
  const labels=["식습관","신체활동","수면","스트레스"];
  const data=[area.diet||0, area.activity||0, area.sleep||0, area.stress||0];
  radarChart?.destroy();
  const ctx=document.getElementById("radarChart").getContext("2d");
  radarChart=new Chart(ctx,{type:"radar",
    data:{labels,datasets:[{label:"나",data,backgroundColor:hex(BLUE.accent,.30),borderColor:BLUE.primary,borderWidth:2,pointBackgroundColor:BLUE.primary}]},
    options:{responsive:true,scales:{r:{suggestedMin:0,suggestedMax:25,ticks:{stepSize:5}}},plugins:{legend:{display:false}}}
  });
}
function drawBar(me,peer){
  barChart?.destroy();
  const ctx=document.getElementById("barChart").getContext("2d");
  barChart=new Chart(ctx,{type:"bar",
    data:{labels:["나","동연령 평균"],datasets:[{label:"점수",data:[me,peer],backgroundColor:[BLUE.primary,BLUE.accent]}]},
    options:{responsive:true,scales:{y:{suggestedMin:0,suggestedMax:100,ticks:{stepSize:10}}},plugins:{legend:{display:false}}}
  });
}
function hex(hexStr,a=1){const m=hexStr.replace("#","");const b=parseInt(m,16);const r=(b>>16)&255,g=(b>>8)&255,b2=b&255;return `rgba(${r},${g},${b2},${a})`;}

// NEXT 버튼 상태 동기화
document.addEventListener("click", ()=>{ const section=SURVEY[step]; nextFab.disabled=!isSectionAnswered(section); });