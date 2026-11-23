const KEY="brb2-proto",$=s=>document.querySelector(s);
const tz=d=>(d||new Date()).toLocaleDateString("en-CA",{timeZone:"Asia/Ho_Chi_Minh"});
const D=n=>tz(new Date(Date.now()+n*864e5));
const CATS=["Ủng hộ","Cảm ơn","Chúc mừng"];
const seed={role:"guest",tab:"station",lang:"en",cat:"all",cur:null,recent:[],
 caps:[],
 subs:[{id:101,l:"en",c:"Ủng hộ",t:"Orange waves of love for Eom Seonghyeon today and always!",by:"fan_nho"}],
 me:{xp:0,streak:0,best:0,last:null,uses:[],favs:[],hist:[],ledger:[],badges:[],done:{},prog:{}},
 comm:{copies:1284,members:96,en:760,ko:524},
 anns:[],
 admlog:[]};
let S=JSON.parse(JSON.stringify(seed));
try{const r=localStorage.getItem(KEY);if(r)S=Object.assign(S,JSON.parse(r))}catch(e){}
S.role="member";S.caps=[];S.anns=[];S.cc=S.cc||{ig:0,x:0,ytb:0};S.cp=S.cp||"ig";S.ci=S.ci||{ig:0,x:0,ytb:0};if(S.an===undefined)S.an=true;S.tc=S.tc||0;S.ts=S.ts||0;
const gv=k=>k==="tc"?S.tc:k==="ts"?S.ts:S.cc[k];
const cntHTML=()=>`<div><b>${gv("tc")}</b>lượt copy ${profile ? "của tài khoản" : "trên máy này"}</div><div><b>${gv("ts")}</b>caption đã gửi đóng góp</div>`;
const profileKeys=["me","tc","ts","cc","lang","cat","an","cp"];
const defaults={...seed,tc:0,ts:0,cc:{ig:0,x:0,ytb:0},an:true,cp:"ig"};
const capture=()=>structuredClone(Object.fromEntries(profileKeys.map(key=>[key,S[key]])));
let guest=capture();
let profile=null;

function applyProfile(data) {
 for (const key of profileKeys) S[key]=structuredClone(data?.[key]??defaults[key]);
 const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
 S.tc=count(S.tc);
 S.ts=count(S.ts);
 S.cc=Object.fromEntries(["ig","x","ytb"].map(key=>[key,count(S.cc?.[key])]));
 const me={...structuredClone(seed.me),...S.me};
 for (const key of ["xp","streak","best"]) me[key]=count(me[key]);
 for (const key of ["uses","favs","badges"]) if (!Array.isArray(me[key])) me[key]=[];
 me.hist=Array.isArray(me.hist)?me.hist.filter(item=>item&&Number.isFinite(Date.parse(item.at))):[];
 me.ledger=Array.isArray(me.ledger)?me.ledger.filter(item=>item&&typeof item.ref==="string"):[];
 if (!me.prog || typeof me.prog!=="object" || Array.isArray(me.prog)) me.prog={};
 S.me=me;
 S.cur=null;
 S.recent=[];
 S.ci={ig:0,x:0,ytb:0};
 pick();
}

function profileStatus(message="",label="",action=null) {
 const status=$("#profile-status"),button=$("#profile-action");
 status.textContent=message;
 status.hidden=!message;
 button.textContent=label;
 button.hidden=!action;
 button.onclick=action;
}

function storeDraft(session, pending) {
 try {
  if (pending) localStorage.setItem(session.key,JSON.stringify({revision:session.revision,data:pending}));
  else localStorage.removeItem(session.key);
 } catch {
  // The active session still has the pending data in memory.
 }
}

async function flushProfile(session) {
 if (session !== profile || session.writing || !session.pending || session.conflict) return;
 session.writing=true;
 profileStatus("Đang đồng bộ hồ sơ…");
 const data=session.pending;
 try {
  const {writeProfile}=await import("./profile.js");
  const revision=await writeProfile(session.uid,session.revision,data);
  if (revision===null) {
   session.conflict=true;
   if (session===profile) {
    profileStatus("Hồ sơ đã thay đổi trên thiết bị khác. Bản chờ đồng bộ vẫn được giữ trên máy này.",
     "Dùng bản Firebase",()=>{
       try { localStorage.setItem(session.key+":backup",JSON.stringify(session.pending)); }
       catch { profileStatus("Không thể tạo bản sao trên máy này. Bản chờ đồng bộ vẫn được giữ."); return; }
       void loadProfile(session,true);
     });
   }
   return;
  }
  session.revision=revision;
  if (session.pending===data) session.pending=null;
  if (session===profile) storeDraft(session,session.pending);
  if (session===profile && !session.pending) profileStatus("Hồ sơ đã đồng bộ.");
 } catch (error) {
  console.error(error);
  if (session===profile) profileStatus("Chưa đồng bộ được hồ sơ. Dữ liệu đang chờ gửi.",
   "Thử lại",()=>void flushProfile(session));
  return;
 } finally {
  session.writing=false;
 }
 if (session.pending) void flushProfile(session);
}

async function loadProfile(session, useServer=false) {
 session.ready=false;
 profileStatus("Đang tải hồ sơ Firebase…");
 try {
  const {readProfile}=await import("./profile.js");
  const remote=await readProfile(session.uid);
  if (session!==profile) return;
  if (useServer) {
   session.pending=null;
   session.conflict=false;
   storeDraft(session,null);
  }
  const revision=session.pending ? session.revision : remote.revision;
  session.revision=revision;
  session.ready=true;
  applyProfile(session.pending??remote.data);
  render();
  if (session.pending) {
   void flushProfile(session);
  } else if (!remote.data && (guest.me.xp || guest.me.favs.length || guest.tc || guest.ts)) {
   profileStatus("Tài khoản chưa có hồ sơ. Bạn có thể đưa dữ liệu trên máy này lên Firebase.",
    "Nhập dữ liệu trên máy",()=>{
      applyProfile(guest);
      save(true);
      render();
    });
  } else {
   profileStatus(remote.data ? "Hồ sơ đã đồng bộ." : "Hồ sơ sẽ được lưu khi bạn bắt đầu sử dụng.");
  }
 } catch (error) {
  console.error(error);
  if (session===profile) profileStatus("Không tải được hồ sơ Firebase.","Thử lại",()=>void loadProfile(session,useServer));
 }
}

export function setProfileUser(uid) {
 if (uid===(profile?.uid??null)) return;
 if (!profile) guest=capture();
 profile=null;
 if (!uid) {
  applyProfile(guest);
  profileStatus();
  render();
  return;
 }
 const key=KEY+":pending:"+uid;
 let draft;
 try { draft=JSON.parse(localStorage.getItem(key)); } catch {}
 profile={uid,key,revision:draft?.revision??0,pending:draft?.data??null};
 applyProfile(null);
 render();
 void loadProfile(profile);
}

function save(personal=false) {
 if (!profile) {
  try {localStorage.setItem(KEY,JSON.stringify({...S,events:undefined,caps:undefined,anns:undefined}))}catch{}
  return;
 }
 if (!personal || !profile.ready || profile.conflict) return;
 profile.pending=capture();
 storeDraft(profile,profile.pending);
 void flushProfile(profile);
}

const canEditProfile=()=>!profile||(profile.ready&&!profile.conflict);
const toast=m=>{const t=$("#t");t.textContent=m;t.classList.add("s");setTimeout(()=>t.classList.remove("s"),1600)};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let missions=[];
let PL={};
let CM={};
const catalogState={};

function loadCatalog(key, load, apply) {
 if (catalogState[key]) return;
 catalogState[key]="loading";
 import("./catalog.js").then(module=>module[load]()).then(data=>{
  apply(data);
  catalogState[key]="ready";
  render();
 }).catch(error=>{
  console.error(error);
  catalogState[key]="error";
  render();
 });
}

function catalogMessage(key) {
 if (catalogState[key]==="error") return "Không tải được dữ liệu từ Firebase. Hãy tải lại trang để thử lại.";
 if (catalogState[key]==="ready") return "Chưa có dữ liệu được xuất bản.";
 return "Đang tải dữ liệu…";
}
const BADGES=[["🌱 Lần đầu copy",m=>m.uses.length>=1],["🔥 Streak 3 ngày",m=>m.best>=3],["📚 10 caption",m=>m.uses.length>=10]];
const lvl=x=>Math.floor(x/100)+1;

// Mô phỏng "server": mọi thay đổi XP đi qua một hàm duy nhất, có ledger + ref duy nhất
function award(src,ref,xp){const m=S.me;if(m.ledger.some(x=>x.ref===ref))return false;m.xp+=xp;m.ledger.unshift({ref,src,xp,at:new Date().toISOString()});
 BADGES.forEach(([n,f])=>{if(!m.badges.includes(n)&&f(m)){m.badges.push(n);toast("Mở khóa: "+n)}});return true}
function dayKey(){return tz()}
function missionPeriod(mission) {
 if (mission.period==="daily") return dayKey();
 const date=new Date(dayKey()+"T00:00:00Z");
 const daysAfterMonday=(date.getUTCDay()+6)%7;
 date.setUTCDate(date.getUTCDate()-daysAfterMonday);
 return date.toISOString().slice(0,10);
}
function bumpMission(action, language) {
 for (const mission of missions) {
  const matches=mission.k===action || (mission.k==="ko"&&action==="caption"&&language==="ko")
    || (mission.k==="copy"&&["caption","comment"].includes(action));
  if (!matches) continue;
  const key=missionPeriod(mission)+":"+mission.id;
  S.me.prog[key]=(S.me.prog[key]||0)+1;
  if (S.me.prog[key]===mission.goal&&award("mission",key,mission.xp)) toast("+"+mission.xp+" XP");
 }
}
function activity(){const m=S.me,t=dayKey();if(m.last===t)return;
 if(m.last===D(-1)||!m.last)m.streak++;else{if(m.streak>0)toast("💔 Chuỗi đã bị đứt, bắt đầu lại nhé");m.streak=1}
 m.last=t;m.best=Math.max(m.best,m.streak)}

function pick(){let p=S.caps.filter(c=>c.l===S.lang&&(S.cat==="all"||c.c===S.cat));
 let f=p.filter(c=>!S.recent.includes(c.id));if(!f.length){f=p;S.recent=[]}
 S.cur=f.length?f[Math.floor(Math.random()*f.length)].id:null}
function curCap(){return S.caps.find(c=>c.id===S.cur)}
async function copy(){const c=curCap();if(!c)return;const txt=c.t+"\n\n#EomSeonghyeon #엄성현";
 const session=profile;
 if(!await clip(txt))return;
 if(session!==profile||!canEditProfile()){toast("Đã sao chép. Hồ sơ chưa sẵn sàng để ghi tiến độ.");return;}
 S.recent.push(c.id);if(S.recent.length>3)S.recent.shift();
 if(S.role==="guest"){toast("Đã copy (Guest không lưu XP)")}
 else{const m=S.me,id=Date.now();m.uses.push(id);m.hist.unshift({id,cid:c.id,at:new Date().toISOString()});activity();
  award("copy","copy:"+id,5);bumpMission("caption",c.l);S.comm.copies++;S.comm[c.l]++;S.tc++;
  toast("🧡 Đã copy! +5 XP")}
 pick();save(true);render()}
function fav(){const c=curCap();if(!c||S.role==="guest"||!canEditProfile())return;const f=S.me.favs,i=f.indexOf(c.id);
 if(i<0){f.push(c.id);activity();bumpMission("fav");toast("Đã lưu yêu thích")}else f.splice(i,1);save(true);render()}

async function cmCopy(){const session=profile,p=S.cp,L=CM[p],t=L[S.ci[p]%L.length];if(!await clip(t))return;
 if(session!==profile||!canEditProfile()){toast("Đã sao chép. Hồ sơ chưa sẵn sàng để ghi tiến độ.");return;}
 S.cc[p]++;S.tc++;S.comm.copies++;activity();award("comment","cm:"+Date.now(),3);bumpMission("comment");
 if(S.an)S.ci[p]=(S.ci[p]+1)%L.length;toast("🧡 Đã copy! +3 XP"+(S.an?" · tự chuyển câu tiếp":""));save(true);render()}
function vComment(){
 loadCatalog("comments","loadComments",data=>{PL=data.platforms;CM=data.comments});
 if (!Object.keys(PL).length) return `<p class="c">${catalogMessage("comments")}</p>`;
 if (!PL[S.cp]) S.cp=Object.keys(PL)[0];
 const p=S.cp,m=PL[p],L=CM[p],t=L[S.ci[p]%L.length];
 const body=t?.length>120?`<details><summary>${esc(t.slice(0,120))}… <span class="mu">(chạm để xem đầy đủ)</span></summary>${esc(t)}</details>`:esc(t??"Chưa có mẫu bình luận.");
 return `<div class="row" style="margin-bottom:10px">${Object.keys(PL).map(k=>`<button class="b ${k===p?"":"g"}" data-p="${k}">${esc(PL[k].n)}</button>`).join("")}</div>
 <div class="c"><h3>${esc(m.n)}</h3><div class="mu">${esc(m.d)}</div>${m.u?`<p><a href="${esc(m.u)}" target="_blank" rel="noopener" style="color:var(--or);font-weight:700">${esc(m.b)}</a></p>`:`<p class="mu">Chưa có link bài đăng cho X.</p>`}
 <div class="cap">${body}</div><div class="mu" style="margin:6px 0">Câu ${S.ci[p]%L.length+1}/${L.length}</div>
 <div class="row"><button class="b" id="mc" ${L.length?"":"disabled"}>Copy comment</button><button class="b g" id="mn" ${L.length?"":"disabled"}>Câu tiếp ›</button><button class="b g" id="mr" ${L.length?"":"disabled"}>Random</button></div>
 <label class="mu" style="display:block;margin-top:8px"><input type="checkbox" id="ma" ${S.an?"checked":""}> Tự chuyển câu sau khi copy</label></div>
 <div class="c"><div class="stat">${Object.keys(PL).map(k=>`<div><b>${gv(k)}</b>${esc(PL[k].n)}</div>`).join("")}</div><p class="mu" style="text-align:center;margin:8px 0 0">TỔNG LƯỢT COPY ${esc(m.n)}: <b style="color:var(--or)">${gv(p)}</b></p></div>
 <p class="mu">Công cụ chỉ copy bình luận, không tự đăng. Hãy đăng thong thả, tránh lặp lại quá nhanh.</p>`}
function bindComment(){document.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{S.cp=b.dataset.p;save(true);render()});
 if (!$("#mc")) return;
 $("#mc").onclick=cmCopy;$("#mn").onclick=()=>{const p=S.cp;S.ci[p]=(S.ci[p]+1)%CM[p].length;save();render()};
 $("#mr").onclick=()=>{const p=S.cp;S.ci[p]=Math.floor(Math.random()*CM[p].length);save();render()};$("#ma").onchange=e=>{S.an=e.target.checked;save(true)}}
const TABS={station:"Caption",comment:"Bình luận",mission:"Nhiệm vụ",event:"Sự kiện",comm:"Cộng đồng",profile:"Hồ sơ"};
function nav(){const t=Object.keys(TABS).filter(k=>k!=="admin"||S.role==="admin"),n=$("#nav");
 if(!t.includes(S.tab))S.tab="station";
 n.innerHTML=t.map(k=>`<button class="${S.tab===k?"on":""}" data-t="${k}">${TABS[k]}</button>`).join("");
 n.querySelectorAll("button").forEach(b=>b.onclick=()=>{S.tab=b.dataset.t;save();render()})}
function need(){return `<div class="c">Hãy đăng nhập (chọn vai trò <b>Thành viên</b> ở góc trên) để dùng tính năng này. <span class="mu">Bản thật: Google hoặc Email.</span></div>`}

function vStation(){const c=curCap(),g=S.role==="guest";
 return `<div class="c"><div class="row" style="margin-bottom:10px">
 <select id="lg"><option value="en">🇬🇧 English</option><option value="ko">🇰🇷 한국어</option></select>
 <select id="ct"><option value="all">Mọi danh mục</option>${CATS.map(x=>`<option>${x}</option>`).join("")}</select></div>
 <div class="cap">${c?esc(c.t):S.caps.length?"Không có caption phù hợp.":catalogMessage("station")}</div>
 <div class="mu" style="margin:6px 0"><b style="color:var(--or)">#EomSeonghyeon #엄성현</b></div>
 <div class="row"><button class="b" id="cp" ${c?"":"disabled"}>Copy</button><button class="b g" id="rn">Random</button>
 <button class="b g" id="fv" ${g||!c||!canEditProfile()?"disabled":""}>${c&&S.me.favs.includes(c.id)?"💛 Đã lưu":"🤍 Yêu thích"}</button></div>
 <div class="mu" style="margin-top:8px">${g?"Guest: copy được nhưng không lưu XP, streak, lịch sử.":"Hôm nay: "+(S.me.hist.filter(h=>tz(new Date(h.at))===tz()).length)+" caption · Streak "+S.me.streak+" 🔥"}</div></div>
 ${g?"":`<div class="c"><h3>Gửi caption đóng góp</h3><div class="row"><select id="sl"><option value="en">EN</option><option value="ko">KO</option></select><select id="sc">${CATS.map(x=>`<option>${x}</option>`).join("")}</select></div>
 <textarea id="st" rows="2" maxlength="2000" style="width:100%;margin:8px 0" placeholder="Caption của bạn"></textarea><button class="b" id="sb">Gửi duyệt</button></div>`}`}
function bindStation(){$("#lg").value=S.lang;$("#ct").value=S.cat;
 $("#lg").onchange=e=>{S.lang=e.target.value;pick();save(true);render()};$("#ct").onchange=e=>{S.cat=e.target.value;pick();save(true);render()};
 $("#cp").onclick=copy;$("#rn").onclick=()=>{pick();render()};$("#fv").onclick=fav;
 const button=$("#sb");
 if (!button) return;
 button.onclick=async()=>{
  const text=$("#st").value.trim();
  if (!text) return;
  if (!canEditProfile()) {toast("Hãy chờ hồ sơ đồng bộ rồi gửi caption.");return;}
  const session=profile;
  const submission={text,language:$("#sl").value,category:$("#sc").value};
  button.disabled=true;
  try {
   const {submitCaption}=await import("./catalog.js");
   await submitCaption(submission);
   if (session!==profile) return;
   S.ts++;
   save(true);
   if ($("#st") && $("#st").value.trim()===text) $("#st").value="";
   $("#cnt").innerHTML=cntHTML();
   toast("Đã gửi đóng góp, cảm ơn bạn!");
  } catch (error) {
   toast(error.message==="SIGN_IN_REQUIRED"?"Hãy đăng nhập Google để gửi caption.":"Không gửi được caption. Hãy thử lại.");
  } finally {
   button.disabled=false;
  }
 };
}

function vMission(){
 if (S.role==="guest") return need();
 if (!missions.length) return `<p class="c">${catalogMessage("missions")}</p>`;
 return `<div class="c"><h3>Nhiệm vụ</h3>${missions.map(mission=>{
  const progress=Math.min(S.me.prog[missionPeriod(mission)+":"+mission.id]||0,mission.goal);
  return `<div class="li"><b>${esc(mission.n)}</b> <span class="tag">+${mission.xp} XP</span>
   <div class="bar"><i style="width:${progress/mission.goal*100}%"></i></div>
   <span class="mu">${progress}/${mission.goal} · ${mission.period==="daily"?"Hằng ngày":"Hằng tuần"}</span></div>`;
 }).join("")}</div>`;
}

async function clip(text) {
 try { await navigator.clipboard.writeText(text); return true; }
 catch { toast("Không thể sao chép."); return false; }
}

function vComm(){const c=S.comm,max=Math.max(1,c.en,c.ko);
 const ms=[1000,2500,5000].map(m=>`<span class="tag">${c.copies>=m?"✅":"⬜"} ${m} lượt copy</span>`).join(" ");
 const lb=[["fan_nho",220],["cam_cam",180],["seong_lover",140]].concat(S.role==="guest"?[]:[["bạn",S.me.xp]]).sort((a,b)=>b[1]-a[1]);
 return `<div class="c"><p class="mu">Màn hình minh họa. Số liệu cộng đồng chưa đồng bộ.</p><div class="stat"><div><b>${c.copies}</b>lượt copy</div><div><b>${c.members}</b>thành viên</div></div>
 <p class="mu">Lượt copy chỉ là số lần copy caption từ tài khoản hợp lệ, không phải số bài đăng thực tế trên X.</p></div>
 <div class="c"><h3>Theo ngôn ngữ</h3>${["en","ko"].map(l=>`<div>${l.toUpperCase()} ${c[l]}<div class="bar"><i style="width:${c[l]/max*100}%"></i></div></div>`).join("")}</div>
 <div class="c"><h3>Mốc cộng đồng</h3>${ms}</div>
 <div class="c"><h3>Leaderboard XP tuần</h3>${lb.map((x,i)=>`<div class="li">${i+1}. ${esc(x[0])} <b style="float:right">${x[1]} XP</b></div>`).join("")}</div>`}

function vProfile(){if(S.role==="guest")return need();const m=S.me,x=m.xp%100;
 return `<div class="c"><h3>Level ${lvl(m.xp)} · ${m.xp} XP</h3><div class="bar"><i style="width:${x}%"></i></div><span class="mu">${100-x} XP nữa lên level</span></div>
 <div class="c"><div class="stat"><div><b>${m.streak}</b>streak</div><div><b>${m.best}</b>dài nhất</div><div><b>${m.uses.length}</b>caption</div></div></div>
 <div class="c"><h3>Badge</h3>${m.badges.length?m.badges.map(b=>`<span class="tag">${esc(b)}</span>`).join(" "):'<span class="mu">Chưa có badge</span>'}</div>
 <div class="c"><h3>Yêu thích</h3>${m.favs.map(id=>{const c=S.caps.find(k=>k.id===id);return c?`<div class="li">${esc(c.t)}</div>`:""}).join("")||'<span class="mu">Trống</span>'}</div>
 <div class="c"><h3>Lịch sử caption</h3>${m.hist.slice(0,8).map(h=>{const c=S.caps.find(k=>k.id===h.cid);return c?`<div class="li">${esc(c.t)}</div>`:""}).join("")||'<span class="mu">Trống</span>'}</div>
 <div class="c"><h3>Lịch sử XP</h3>${m.ledger.slice(0,8).map(l=>`<div class="li">${esc(l.src)} <span class="mu">${esc(l.ref)}</span> <b style="float:right">+${esc(l.xp)}</b></div>`).join("")||'<span class="mu">Trống</span>'}</div>`}

function vAdmin(){const pend=S.subs;
 return `<div class="c"><h3>Duyệt caption đóng góp (${pend.length})</h3>${pend.map(s=>`<div class="li">${esc(s.t)} <span class="mu">${s.l.toUpperCase()} · ${s.c} · ${esc(s.by)}</span><div class="row" style="margin-top:6px"><button class="b" data-a="${s.id}">Duyệt</button><button class="b g" data-r="${s.id}">Từ chối</button></div></div>`).join("")||'<span class="mu">Không có caption chờ duyệt</span>'}</div>
 <div class="c"><h3>Thêm caption</h3><div class="row"><select id="al"><option value="en">EN</option><option value="ko">KO</option></select><select id="ac">${CATS.map(x=>`<option>${x}</option>`).join("")}</select></div>
 <textarea id="at" rows="2" style="width:100%;margin:8px 0"></textarea><button class="b" id="ab">Thêm</button></div>
 <div class="c"><h3>Đăng thông báo</h3><div class="row"><input id="an" style="flex:1" placeholder="Nội dung"><button class="b" id="ap">Đăng</button></div></div>
 <div class="c"><h3>Thống kê</h3><div class="mu">${S.caps.length} caption công khai · ${S.comm.members} thành viên · ${S.comm.copies} lượt copy</div></div>
 <div class="c"><h3>Nhật ký thao tác Admin</h3>${S.admlog.slice(0,6).map(l=>`<div class="li mu">${l}</div>`).join("")||'<span class="mu">Chưa có</span>'}</div>`}
function bindAdmin(){const lg=m=>{S.admlog.unshift(new Date().toLocaleTimeString("vi-VN")+" · "+m)};
 document.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{const i=S.subs.findIndex(s=>s.id==b.dataset.a),s=S.subs.splice(i,1)[0];S.caps.push({id:Date.now(),l:s.l,c:s.c,t:s.t});lg("Duyệt caption");save();render()});
 document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{S.subs=S.subs.filter(s=>s.id!=b.dataset.r);lg("Từ chối caption");save();render()});
 $("#ab").onclick=()=>{const t=$("#at").value.trim();if(!t)return;S.caps.push({id:Date.now(),l:$("#al").value,c:$("#ac").value,t});lg("Thêm caption");save();render()};
 $("#ap").onclick=()=>{const t=$("#an").value.trim();if(!t)return;S.anns.unshift(t);lg("Đăng thông báo");save();render()}}

function render(){$("#cnt").innerHTML=cntHTML();nav();
 const a=$("#ann");a.hidden=!S.anns.length;a.innerHTML="📣 "+esc(S.anns[0]||"");
 const V={station:vStation,comment:vComment,mission:vMission,comm:vComm,profile:vProfile,admin:vAdmin};$("#v").innerHTML=S.tab==="event"?"":V[S.tab]();
 window.dispatchEvent(new CustomEvent("station-tab",{detail:S.tab}));
 if(S.tab==="station")bindStation();if(S.tab==="comment")bindComment();if(S.tab==="admin")bindAdmin();
}
const fx=$("#fx"),im=fx.firstElementChild,RM=matchMedia("(prefers-reduced-motion:reduce)").matches;
let tx=-99,ty=-99,x=-99,y=-99,on=0,down=0,last=0;
addEventListener("mousemove",e=>{tx=e.clientX;ty=e.clientY;if(!on){x=tx;y=ty;on=1}fx.style.opacity=1;
 const n=performance.now();if(!RM&&n-last>55){last=n;const s=document.createElement("span");s.className="sp";s.textContent=["🧡","✨","🍊"][Math.random()*3|0];
  s.style.setProperty("--x",(tx+Math.random()*18-9)+"px");s.style.setProperty("--y",(ty+Math.random()*14)+"px");document.body.appendChild(s);s.onanimationend=()=>s.remove()}});
addEventListener("mousedown",()=>down=1);addEventListener("mouseup",()=>down=0);
document.documentElement.addEventListener("mouseleave",()=>{fx.style.opacity=0});
(function f(){const dx=tx-x,dy=ty-y;x+=dx*.28;y+=dy*.28;
 const rot=RM?0:Math.max(-28,Math.min(28,dx*1.2)),sq=RM?1:1+Math.min(.25,Math.hypot(dx,dy)/120);
 fx.style.transform="translate("+(x-22)+"px,"+(y-24)+"px)";im.style.transform="rotate("+rot+"deg) scale("+sq*(down?.8:1)+")";requestAnimationFrame(f)})();
render();
loadCatalog("station","loadStation",data=>{
 S.caps=data.captions;
 S.anns=data.announcements;
 if(!curCap())pick();
});
loadCatalog("missions","loadMissions",data=>{missions=data});
