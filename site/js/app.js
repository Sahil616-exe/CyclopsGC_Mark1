const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ymd=d=>d.toLocaleDateString('en-CA'),inr=n=>'₹'+n;
const h12=h=>{h%=24;return(h%12||12)+(h<12?'AM':'PM')},rng=h=>h12(h)+'–'+h12(h+1);
const adminView=()=>location.hash=='#admin';
// S = what the server says (scoped to who is logged in). U = what this screen is showing.
let S={me:null,admin:false,now:0,cfg:{},hours:[],prices:{pc:0,ps5:0},stations:[],snacks:[],taken:[],coupons:[],bookings:[],tickets:[],users:[],feedback:[]};
const U={tab:'pc',date:ymd(new Date()),seat:'',hrs:[],cart:{},code:'',codeIn:'',pay:'upi',mode:'in',stars:5,note:'',loc:'',at:'bk',q:''};
const TAG={paid:['ok','Paid'],pending:['wn','Pay at counter'],cancelled:['','Cancelled'],open:['wn','Open'],approved:['ok','Approved'],rejected:['','Rejected']};
const tag=s=>`<span class="tag ${TAG[s][0]}">${TAG[s][1]}</span>`;
const kindOf=c=>S.stations.find(s=>s.code==c)?.kind;
const takenHrs=(c,d)=>new Set(S.taken.filter(t=>t.c==c&&t.d==d).map(t=>t.h));
const started=h=>U.date==ymd(new Date())&&h<=new Date().getHours();

// ---- server calls ----
async function api(path,body){const r=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Something went wrong. Try again.');return j}
async function load(){try{S=await api('/api/state');initFacebook();render()}catch(_){toast('Cannot reach the server')}}
const act=(path,body,msg)=>api(path,body).then(()=>{if(msg)toast(msg);return load()},e=>toast(e.message));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2800)}

// ---- Google and Facebook login ----
function initGoogle(){const d=$('#gbtn');if(!d||!window.google?.accounts||!S.cfg.google)return;if(!initGoogle.done){initGoogle.done=1;google.accounts.id.initialize({client_id:S.cfg.google,callback:r=>act('/api/auth/google',{token:r.credential})})}google.accounts.id.renderButton(d,{theme:'filled_black',size:'large',width:300,text:'continue_with'})}
window.onGoogleLibraryLoad=initGoogle;
function initFacebook(){if(window.FB||initFacebook.done||!S.cfg.facebook)return;initFacebook.done=1;window.fbAsyncInit=()=>FB.init({appId:S.cfg.facebook,version:'v23.0'});const s=document.createElement('script');s.src='https://connect.facebook.net/en_US/sdk.js';s.async=1;document.head.append(s)}

// ---- player level: one level per 5 paid hours ----
const RANKS=['Rookie','Gamer','Pro','Elite','Legend'];
function level(){const h=S.bookings.filter(b=>b.status=='paid'&&b.user_id==S.me.id).reduce((a,b)=>a+b.hours.length,0),l=Math.min(5,1+Math.floor(h/5));return{h,l,name:RANKS[l-1],pct:l==5?100:(h%5)*20}}

// ---- shared ----
const hud=()=>{const L=S.me&&!adminView()?level():null;return `<header class="hud"><a href="#"><img src="/img/logo.svg" alt="Cyclops Gaming Cafe"></a><div class="who">${adminView()?`<a class="chip" href="#">Player site</a>${S.admin?'<button class="btn alt sm" data-a="aout">Sign out</button>':''}`:S.me?`${S.me.avatar?`<img class="avatar" src="${esc(S.me.avatar)}" alt="" referrerpolicy="no-referrer">`:`<span class="avatar">${esc(S.me.name[0].toUpperCase())}</span>`}<div><b>${esc(S.me.name)}</b><br><span class="lvl">LVL ${L.l} ${L.name}</span></div><button class="btn alt sm" data-a="out">Log out</button>`:''}</div></header>`};
const staff=()=>'<p class="mu"><a href="#admin">Staff login</a></p>';

// ---- logged out ----
const landing=()=>`<section class="hero"><div><p class="eyebrow">Now open · book a station in 60 seconds</p><h1>Level up<br>at Cyclops</h1><p class="mu lead">High-end gaming PCs and PS5 stations by the hour. Pick your seat, grab your slot, and play.</p>
<div class="loadouts"><div class="load pc"><img src="/img/station-pc.svg" alt="" width="52" height="52"><div><small>PC rig</small><div class="price">${inr(S.prices.pc)}<small>/hr</small></div></div></div><div class="load ps"><img src="/img/station-ps5.svg" alt="" width="52" height="52"><div><small>PlayStation 5</small><div class="price">${inr(S.prices.ps5)}<small>/hr</small></div></div></div></div>
<img class="heroart" src="/img/hero.svg" alt=""></div>
<div class="panel hot login"><h3>Player login</h3>${S.cfg.google?'<div id="gbtn"></div>':'<p class="mu">Google login is not set up yet.</p>'}${S.cfg.facebook?'<button class="btn alt wf" data-a="fb">Continue with Facebook</button>':''}
<div class="or">or use your email</div><div class="tabs"><button class="tab ${U.mode=='in'?'on':''}" data-a="mode" data-v="in">Log in</button><button class="tab ${U.mode=='up'?'on':''}" data-a="mode" data-v="up">New player</button></div>
${U.mode=='up'?'<input id="nm" placeholder="Gamer name" autocomplete="name">':''}<input id="em" type="email" placeholder="Email" autocomplete="email"><input id="pw" type="password" placeholder="Password" autocomplete="${U.mode=='up'?'new-password':'current-password'}">
<button class="btn big wf" data-a="auth">${U.mode=='in'?'Press start':'Create player'}</button></div></section>${staff()}`;

// ---- booking ----
function order(){const st=S.stations.find(s=>s.code==U.seat),base=st?U.hrs.length*S.prices[st.kind]:0,food=S.snacks.reduce((a,s)=>a+s.price*(U.cart[s.id]||0),0),sub=base+food,c=S.coupons.find(x=>x.active&&x.code==U.code),off=c?Math.min(sub,c.kind=='percent'?Math.floor((sub*c.value+50)/100):c.value):0;return{st,base,sub,c,off,total:sub-off}}
const cartV=()=>{const o=order(),offers=S.coupons.filter(c=>c.active);return `<aside class="panel hot"><h3>Your loadout</h3>
<div class="ln"><span>${o.st?esc(o.st.code)+' × '+U.hrs.length+' hr':'No station picked'}</span><b>${inr(o.base)}</b></div>
${S.snacks.filter(s=>U.cart[s.id]).map(s=>`<div class="ln"><span>${esc(s.name)} × ${U.cart[s.id]}</span><b>${inr(s.price*U.cart[s.id])}</b></div>`).join('')}
<div class="row"><input class="grow" data-k="codeIn" placeholder="PROMO CODE" value="${esc(U.codeIn)}"><button class="btn alt" data-a="apply">Apply</button></div>
${offers.length?`<div class="row">${offers.map(c=>`<button class="chip" data-a="offer" data-v="${esc(c.code)}">${esc(c.code)} · ${c.kind=='percent'?c.value+'% off':inr(c.value)+' off'}</button>`).join('')}</div>`:''}
${o.c?`<div class="ln"><span>Promo ${esc(o.c.code)}</span><b class="lm">−${inr(o.off)}</b></div>`:''}
<div class="ln total"><span>Total</span><b>${inr(o.total)}</b></div>
<div class="row">${[['upi','UPI'],['card','Card'],['cash','Pay at counter']].map(([k,l])=>`<button class="chip ${U.pay==k?'on':''}" data-a="pay" data-v="${k}">${l}</button>`).join('')}</div>
<button class="btn big wf" data-a="buy">${U.pay=='cash'?'Confirm booking':'Pay '+inr(o.total)}</button></aside>`};

const bookV=k=>{const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return d}),tk=U.seat?takenHrs(U.seat,U.date):new Set();
return `<section class="panel"><div class="head"><h3>${k=='pc'?'Gaming PCs':'PlayStation 5'}</h3><span class="price">${inr(S.prices[k])}<small>/hr</small></span></div>
<p class="step">1 · Pick your day</p><div class="days">${days.map(d=>`<button class="day ${U.date==ymd(d)?'on':''}" data-a="day" data-v="${ymd(d)}"><small>${d.toLocaleDateString('en-IN',{weekday:'short'})}</small><b>${d.getDate()}</b></button>`).join('')}</div>
<p class="step">2 · Choose your station</p><div class="seats">${S.stations.filter(s=>s.kind==k).map(s=>{const t=takenHrs(s.code,U.date),full=S.hours.every(h=>started(h)||t.has(h));return `<button class="seat ${U.seat==s.code?'on':''}" ${full?'disabled':''} data-a="seat" data-v="${esc(s.code)}"><img src="${esc(s.image||'')}" alt="" width="64" height="64"><b>${esc(s.code)}</b><small>${full?'FULL':esc(s.specs||'READY')}</small></button>`}).join('')}</div>
<p class="step">3 · Pick your hours</p><div class="hours">${S.hours.map(h=>{const t=tk.has(h);return `<button class="hour ${U.hrs.includes(h)?'on':''}" ${!U.seat||t||started(h)?'disabled':''} data-a="hour" data-v="${h}"><b>${h12(h)}</b><small>${t?'TAKEN':'to '+h12(h+1)}</small></button>`}).join('')}</div>
${U.seat?'':'<p class="mu">Choose a station to see its open hours.</p>'}</section>`};

const snackV=()=>`<section class="panel"><h3>Fuel up</h3><p class="mu">Snacks and drinks, served at your seat.</p><div class="snacks">${S.snacks.map(s=>`<div class="snack"><img src="${esc(s.image||'')}" alt="" width="72" height="72"><b>${esc(s.name)}</b><span class="mu">${inr(s.price)}</span><div class="qty"><button class="chip" data-a="qty" data-v="${s.id}:-1" aria-label="Remove one">−</button><b>${U.cart[s.id]||0}</b><button class="chip" data-a="qty" data-v="${s.id}:1" aria-label="Add one">+</button></div></div>`).join('')}</div>
<div class="form"><input data-k="loc" placeholder="Your seat for a snack-only order, e.g. PC-03" value="${esc(U.loc)}"></div></section>`;

const zoneV=()=>`<section class="panel"><div class="head"><h3>Squad up: the whole PC zone</h3><img src="/img/zone.svg" alt="" width="56" height="56"></div><p class="mu">Tournament, birthday or team night? Raise a ticket and we will confirm the slot and price.</p>
<div class="form"><input id="zd" type="date" min="${ymd(new Date())}" value="${ymd(new Date())}"><select id="zt">${S.hours.map(h=>`<option value="${h}">Start at ${h12(h)}</option>`).join('')}</select><select id="zh">${[1,2,3,4,5,6].map(n=>`<option value="${n}">${n} hr</option>`).join('')}</select><input id="zp" type="number" min="1" placeholder="How many players?"><textarea id="zn" placeholder="Event details"></textarea></div>
<button class="btn big" data-a="ticket">Raise ticket</button></section>`;

const mineV=()=>{const L=level();return `<section class="panel hot level"><div><small>PLAYER LEVEL</small><h2>LVL ${L.l} · ${L.name}</h2><span class="mu">${L.h} paid hours played${L.l<5?' · '+(5-L.h%5)+' hrs to the next level':''}</span></div><div class="xp"><i style="width:${L.pct}%"></i></div></section>
<section class="panel"><h3>Match history</h3>${S.bookings.length?S.bookings.map(b=>`<div class="ln"><span><b>${esc(b.station||'Snacks '+(b.seat_note||''))}</b>${b.hours.length?'<br>'+b.booking_date+' · '+b.hours.map(rng).join(', '):''}${b.items?'<br><small>'+esc(b.items)+'</small>':''}</span><span>${inr(b.total)} ${tag(b.status)}</span></div>`).join(''):'<p class="mu">No matches yet. Book a station.</p>'}</section>
${S.tickets.length?`<section class="panel"><h3>My tickets</h3>${S.tickets.map(t=>`<div class="ln"><span>#${t.id} · whole PC zone · ${t.event_date} · ${h12(t.start_hour)} for ${t.hours} hr</span>${tag(t.status)}</div>`).join('')}</section>`:''}
<section class="panel"><h3>Rate your session</h3><div class="row">${[1,2,3,4,5].map(n=>`<button class="chip ${U.stars==n?'on':''}" data-a="star" data-v="${n}">${n}★</button>`).join('')}</div><div class="form"><textarea data-k="note" placeholder="Tell us what we can do better">${esc(U.note)}</textarea></div><button class="btn" data-a="sendfb">Send feedback</button></section>`};

function player(){const T=U.tab,tabs=[['pc','PC · '+inr(S.prices.pc)+'/hr'],['ps5','PS5 · '+inr(S.prices.ps5)+'/hr'],['snacks','Snacks'],['zone','Whole PC zone'],['mine','My matches']],
body=T=='pc'||T=='ps5'?bookV(T):T=='snacks'?snackV():T=='zone'?zoneV():mineV(),side=T=='pc'||T=='ps5'||T=='snacks';
return `<div class="tabs">${tabs.map(([k,l])=>`<button class="tab ${T==k?'on':''}" data-a="tab" data-v="${k}">${l}</button>`).join('')}</div>${side?`<div class="cols"><div>${body}</div>${cartV()}</div>`:body}${staff()}`}

// ---- admin command center ----
const adminLogin=()=>`<div class="panel hot login" style="max-width:380px;margin:30px auto"><h3>Staff sign in</h3><input id="an" placeholder="Username" autocomplete="username"><input id="ap" type="password" placeholder="Password" autocomplete="current-password"><button class="btn big wf" data-a="alog">Sign in</button></div>`;
function admin(){const td=ymd(new Date()),nh=new Date().getHours(),rev=S.bookings.filter(b=>b.status=='paid').reduce((a,b)=>a+b.total,0),
avg=S.feedback.length?(S.feedback.reduce((a,f)=>a+f.rating,0)/S.feedback.length).toFixed(1):'–',stat=(l,v)=>`<div class="stat"><b>${v}</b><small>${l}</small></div>`,
q=U.q.trim().toLowerCase(),rows=S.bookings.filter(b=>!q||[b.id,b.user_name,b.station].join(' ').toLowerCase().includes(q)),
P={bk:()=>`<div class="row"><input class="grow" data-k="q" data-r="1" placeholder="Search player, station or booking number" value="${esc(U.q)}"></div><div class="ov"><table><tr><th>#<th>Player<th>Station<th>When<th>Amount<th>Status<th></tr>${rows.map(b=>`<tr><td>${b.id}<td>${esc(b.user_name)}<td>${esc(b.station||'Snacks '+(b.seat_note||''))}<td>${b.hours.length?b.booking_date+'<br>'+b.hours.map(rng).join(', '):'–'}${b.items?'<br><small>'+esc(b.items)+'</small>':''}<td>${inr(b.total)}<br><small>${b.payment_method}${b.coupon_code?' · '+esc(b.coupon_code):''}</small><td>${tag(b.status)}<td>${b.status=='pending'?`<button class="btn sm" data-a="accept" data-v="${b.id}">Accept payment</button> `:''}${b.status!='cancelled'?`<button class="btn alt sm" data-a="cancel" data-v="${b.id}">Cancel</button>`:''}`).join('')||'<tr><td colspan="7">No bookings found</tr>'}</table></div>`,
us:()=>`<div class="ov"><table><tr><th>Player<th>Email<th>Joined via<th>Joined<th>Status<th>Bookings</tr>${S.users.map(u=>`<tr><td>${esc(u.name)}<td>${esc(u.email)}<td>${esc(u.provider)}<td>${new Date(u.created_at).toLocaleDateString()}<td><span class="dot ${u.active_now?'on':''}"></span>${u.active_now?'Active now':'Inactive'}<br><small>Last seen ${new Date(u.last_seen_at).toLocaleString()}</small><td>${u.bookings}`).join('')||'<tr><td colspan="6">No players yet</tr>'}</table></div>`,
tk:()=>S.tickets.length?S.tickets.map(t=>`<div class="ln"><span><b>#${t.id}</b> ${esc(t.user_name)} · ${t.event_date} · ${h12(t.start_hour)} for ${t.hours} hr · ${t.players} players<br><small>${esc(t.note||'')}</small></span><span>${tag(t.status)} ${t.status=='open'?`<button class="btn sm" data-a="tstate" data-v="${t.id}:approved">Approve</button> <button class="btn alt sm" data-a="tstate" data-v="${t.id}:rejected">Reject</button>`:''}</span></div>`).join(''):'<p class="mu">No tickets yet.</p>',
cp:()=>`<div class="row"><input id="cc" class="grow" style="flex:2" placeholder="Code, e.g. FRIDAY20"><select id="ck" class="grow"><option value="percent">% off</option><option value="flat">₹ off</option></select><input id="cv" class="grow" type="number" min="1" placeholder="Value"><button class="btn" data-a="addcoupon">Add coupon</button></div>${S.coupons.map(c=>`<div class="ln"><span><b>${esc(c.code)}</b> · ${c.kind=='percent'?c.value+'% off':inr(c.value)+' off'}</span><span><span class="tag ${c.active?'ok':''}">${c.active?'Visible to players':'Hidden'}</span> <button class="btn alt sm" data-a="togglecoupon" data-v="${esc(c.code)}">${c.active?'Hide':'Show'}</button> <button class="btn alt sm" data-a="delcoupon" data-v="${esc(c.code)}">Delete</button></span></div>`).join('')}`,
fb:()=>S.feedback.length?S.feedback.map(f=>`<div class="ln"><span><b>${esc(f.user_name)}</b> ${'★'.repeat(f.rating)}<br>${esc(f.comment||'No comment')}</span><small>${new Date(f.created_at).toLocaleDateString()}</small></div>`).join(''):'<p class="mu">No feedback yet.</p>',
pr:()=>`<div class="form" style="max-width:320px"><label>PC price per hour (₹)<input id="ppc" type="number" min="1" value="${S.prices.pc}"></label><label>PS5 price per hour (₹)<input id="pps" type="number" min="1" value="${S.prices.ps5}"></label><button class="btn" data-a="saveprices">Save prices</button></div>`};
return `<h2>Command center</h2><div class="stats">${stat('Revenue (paid)',inr(rev))}${stat('Bookings',S.bookings.length)}${stat('Awaiting payment',S.bookings.filter(b=>b.status=='pending').length)}${stat('Players active now',S.users.filter(u=>u.active_now).length+' / '+S.users.length)}${stat('Open tickets',S.tickets.filter(t=>t.status=='open').length)}${stat('Average rating',avg)}</div>
<section class="panel" style="margin-top:14px"><h3>Live floor</h3><div class="floor">${S.stations.map(s=>{const o=S.taken.some(t=>t.c==s.code&&t.d==td&&t.h==nh);return `<div class="tile ${o?'live':''}"><span>${esc(s.code)}</span><small><span class="dot ${o?'live':'on'}"></span>${o?'In use now':'Free now'}</small></div>`}).join('')}</div></section>
<div class="tabs">${[['bk','Bookings'],['us','Players'],['tk','Tickets'],['cp','Coupons'],['fb','Feedback'],['pr','Pricing']].map(([k,l])=>`<button class="tab ${U.at==k?'on':''}" data-a="at" data-v="${k}">${l}</button>`).join('')}</div><section class="panel">${P[U.at]()}</section>`}

function render(){$('#app').innerHTML=hud()+(adminView()?(S.admin?admin():adminLogin()):(S.me?player():landing()));initGoogle()}

// ---- actions (every button carries data-a="name") ----
const A={
mode:v=>{U.mode=v;render()},
auth:()=>act('/api/auth/email',{up:U.mode=='up',name:$('#nm')?.value.trim()||'',email:$('#em').value.trim(),password:$('#pw').value}),
fb:()=>window.FB?FB.login(r=>r.authResponse&&act('/api/auth/facebook',{token:r.authResponse.accessToken}),{scope:'email,public_profile'}):toast('Facebook is still loading. Try again in a moment.'),
out:()=>act('/api/logout',{}),
tab:v=>{U.tab=v;if((v=='pc'||v=='ps5')&&U.seat&&kindOf(U.seat)!=v){U.seat='';U.hrs=[]}render()},
day:v=>{U.date=v;U.hrs=[];render()},
seat:v=>{U.seat=v;U.hrs=U.hrs.filter(h=>!takenHrs(v,U.date).has(h));render()},
hour:v=>{v=+v;U.hrs=U.hrs.includes(v)?U.hrs.filter(h=>h!=v):[...U.hrs,v];render()},
qty:v=>{const[i,d]=v.split(':');U.cart[i]=Math.max(0,(U.cart[i]||0)+Number(d));render()},
apply:()=>{const c=U.codeIn.trim().toUpperCase();U.codeIn=c;U.code=S.coupons.some(x=>x.active&&x.code==c)?c:'';toast(U.code?'Promo applied':'That promo code is not valid');render()},
offer:v=>{U.code=v;U.codeIn=v;render()},pay:v=>{U.pay=v;render()},
buy:()=>{const o=order();if(U.seat&&!U.hrs.length)return toast('Pick at least one hour');if(!U.seat&&U.hrs.length)return toast('Pick a station');if(!o.sub)return toast('Your order is empty');
api('/api/book',{station:U.seat||null,date:U.date,hours:U.hrs,snacks:U.cart,coupon:U.code,method:U.pay,note:U.loc}).then(()=>{toast(U.pay=='cash'?'Booked! Pay at the counter.':'Payment received. You are in!');U.hrs=[];U.seat='';U.cart={};U.code='';U.codeIn='';U.tab='mine';return load()},e=>{toast(e.message);load()})},
star:v=>{U.stars=+v;render()},
sendfb:()=>api('/api/feedback',{rating:U.stars,comment:U.note.trim()}).then(()=>{U.note='';toast('Thanks for your feedback');return load()},e=>toast(e.message)),
ticket:()=>act('/api/ticket',{date:$('#zd').value,hour:+$('#zt').value,hours:+$('#zh').value,players:+$('#zp').value||0,note:$('#zn').value.trim()},'Ticket sent. We will confirm shortly.'),
alog:()=>act('/api/admin/login',{username:$('#an').value,password:$('#ap').value}),
aout:()=>act('/api/admin/logout',{}),at:v=>{U.at=v;render()},
accept:v=>act('/api/admin/booking',{id:+v,status:'paid'},'Payment accepted'),
cancel:v=>act('/api/admin/booking',{id:+v,status:'cancelled'}),
tstate:v=>{const[i,s]=v.split(':');act('/api/admin/ticket',{id:+i,status:s})},
addcoupon:()=>act('/api/admin/coupon',{code:$('#cc').value,kind:$('#ck').value,value:+$('#cv').value},'Coupon added and visible to players'),
togglecoupon:v=>act('/api/admin/coupon',{code:v,toggle:1}),delcoupon:v=>act('/api/admin/coupon',{code:v,del:1}),
saveprices:()=>act('/api/admin/prices',{pc:+$('#ppc').value,ps5:+$('#pps').value},'Prices saved')
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(b&&A[b.dataset.a])A[b.dataset.a](b.dataset.v)});
document.addEventListener('input',e=>{const k=e.target.dataset.k;if(k)U[k]=e.target.value});
document.addEventListener('change',e=>{if(e.target.dataset.r)render()});
addEventListener('hashchange',render);
setInterval(()=>{const t=document.activeElement?.tagName||'';if((S.me||S.admin)&&!/INPUT|TEXTAREA|SELECT/.test(t))load()},20000);
load();
