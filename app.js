
import {AXIAL_TILT,POLAR_CIRCLE_OFFSET,clamp,computeSun} from './src/astro.js';
import {layoutTemplate} from './src/template.js';

const $=id=>document.getElementById(id),rad=Math.PI/180;
let LANG='es',T={},localeCache={};
const f=(x,d=1)=>x.toFixed(d).replace('.',LANG==='es'?',':'.');
const tf=t=>{let h=Math.floor(t),m=Math.round((t-h)*60);if(m==60){h++;m=0}return h+':'+String(m).padStart(2,'0')};
let E=[],S={},sel=0;
let CIUDADES=null; // se carga desde ciudades.json: [{"nombre":..., "lat":...}], ordenadas por fama
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function tr(key,values={},rawValues=[]){
 const message=T[key];
 if(typeof message!=='string')throw new Error(`Missing translation "${key}" for ${LANG}`);
 return message.replace(/\{(\w+)\}/g,(_,name)=>rawValues.includes(name)?String(values[name]??''):escapeHtml(values[name]??''));
}
async function loadLocale(lang){
 if(!['es','en'].includes(lang))throw new Error(`Unsupported language: ${lang}`);
 if(!localeCache[lang]){
  const response=await fetch(`locales/${lang}.json`);
  if(!response.ok)throw new Error(`Could not load locales/${lang}.json (${response.status})`);
  const dictionary=await response.json();
  if(!dictionary||Array.isArray(dictionary)||typeof dictionary!=='object')throw new Error(`Invalid locale file: locales/${lang}.json`);
  localeCache[lang]=dictionary;
 }
 const dictionary=localeCache[lang];
 const keys=[...document.querySelectorAll('[data-i18n]')].map(node=>node.dataset.i18n)
  .concat([...document.querySelectorAll('[data-i18n-aria-label]')].map(node=>node.dataset.i18nAriaLabel))
  .concat([...document.querySelectorAll('[data-i18n-content]')].map(node=>node.dataset.i18nContent))
  .concat([...document.querySelectorAll('[data-i18n-alt]')].map(node=>node.dataset.i18nAlt));
 const missing=keys.filter(key=>typeof dictionary[key]!=='string');
 if(missing.length)throw new Error(`Missing translations in locales/${lang}.json: ${missing.join(', ')}`);
 LANG=lang;T=dictionary;
 document.documentElement.lang=lang;
 document.querySelectorAll('[data-i18n]').forEach(node=>{node.textContent=tr(node.dataset.i18n)});
 document.querySelectorAll('[data-i18n-aria-label]').forEach(node=>{node.setAttribute('aria-label',tr(node.dataset.i18nAriaLabel))});
 document.querySelectorAll('[data-i18n-content]').forEach(node=>{node.setAttribute('content',tr(node.dataset.i18nContent))});
 document.querySelectorAll('[data-i18n-alt]').forEach(node=>{node.setAttribute('alt',tr(node.dataset.i18nAlt))});
 $('language').value=lang;
 $('status').hidden=true;
 try{localStorage.setItem('solar-language',lang)}catch(error){console.warn('Could not save language preference.',error)}
 run(1);
}
function setTheme(theme){
 if(!['light','dark'].includes(theme))throw new Error(`Unsupported theme: ${theme}`);
 document.documentElement.dataset.theme=theme;
 $('theme').value=theme;
 try{localStorage.setItem('solar-theme',theme)}catch(error){console.warn('Could not save theme preference.',error)}
}
function ciudades(lat){
 const n=x=>Math.abs(Math.round(x))+'º '+(x>=0?'N':'S');
 if(CIUDADES===null)return '';
 if(!CIUDADES.length)return tr('cities.unavailable');
 const c=CIUDADES.filter(x=>Math.abs(x.lat-lat)<=1).slice(0,4).map(x=>x.nombre);
 if(c.length)return tr('cities.nearby',{names:c.join(', ')});
 if(lat<=-62)return tr('cities.antarctica');
 if(lat>=84)return tr('cities.arctic');
 const m=CIUDADES.reduce((a,b)=>Math.abs(b.lat-lat)<Math.abs(a.lat-lat)?b:a);
 if(Math.abs(m.lat-lat)<=3)return tr('cities.closest',{name:m.nombre,latitude:n(m.lat)});
 return tr('cities.empty');
}
function updateCities(){
 $('cities').textContent=ciudades(+$('lat').value);
}

function run(keep){
 const lat=+$('lat').value,R=+$('R').value,mode=$('mode').value,hmax=+$('hmax').value;
 const {dayNumber:N,declination:dec,dayAngle:H0,events}=computeSun(lat,$('date').value);
 const sp=Math.sin(lat*rad),cp=Math.cos(lat*rad),sd=Math.sin(dec*rad),cd=Math.cos(dec*rad);
 E=events;
 E.forEach(o=>{o.e0=o.e;o.A0=o.A;o.e=Math.round(o.e);o.A=Math.round(o.A)%360});
 E.forEach(o=>{const e=o.e*rad;
  if(mode=='cupula'){o.r=R*Math.cos(e);o.h=R*Math.sin(e)}
  else{o.r=R;o.h=R*Math.tan(e);o.cap=o.h>hmax;if(o.cap)o.h=hmax}});
 S={lat,R,mode,N,dec,sp,cp,sd,cd,H0,hmax};
 $('hmax-label').hidden=mode!=='poste';
 $('sum').innerHTML=!E.length?tr('summary.polarNight'):
  (H0==180?tr('summary.polarDay'):'')+tr('summary.declination',{value:f(dec)})+' · '+tr('summary.daylight',{value:f(H0/7.5)});
 earth();
 updateCities();
 if(!keep||sel>=E.length){sel=0;E.forEach((o,i)=>{if(o.e>E[sel].e)sel=i})}
 draw();tplUpdate();
}
function draw(){
 if(!E.length){$('plan').innerHTML='';$('tab').innerHTML='';$('steps').innerHTML='';$('craft').innerHTML='';return}
 const R=S.R,V=R+3;let s=`<svg viewBox="${-V} ${-V} ${2*V} ${2*V}" font-size="${R/12}" text-anchor="middle" role="img" aria-label="${tr('results.label')}"><title>${tr('results.label')}</title>`;
 s+=`<circle r="${R}" fill="none" stroke="var(--ln)"/><circle r="${R/2}" fill="none" stroke="var(--ln)" stroke-dasharray="2 2"/>`;
 s+=`<path d="M${-R} 0H${R}M0 ${-R}V${R}" stroke="var(--ln)"/>`;
 [['N',0,-R-1],['S',0,R+1.8],['E',R+1.2,.4],[tr('pdf.west'),-R-1.2,.4]].forEach(a=>s+=`<text x="${a[1]}" y="${a[2]}" fill="var(--mu)" font-weight="700">${a[0]}</text>`);
 const P=E.map(o=>[o.r*Math.sin(o.A*rad),-o.r*Math.cos(o.A*rad)]);
 s+=`<polyline points="${P.map(p=>p.join(',')).join(' ')}" fill="none" stroke="var(--ac)" stroke-opacity=".5" stroke-dasharray="1 .6"/>`;
 E.forEach((o,i)=>{const [x,y]=P[i],k=o.z?'var(--bl)':'var(--ac)',lx=x*1.0+Math.sin(o.A*rad)*1.3,ly=y-Math.cos(o.A*rad)*1.3+.35;
  s+=`<circle cx="${x}" cy="${y}" r="${i==sel?.6:.4}" fill="${k}" stroke="${i==sel?'var(--fg)':'none'}" stroke-width=".15"/>`;
  s+=`<text x="${lx}" y="${ly}" fill="${k}">${o.z?tr(`event.${o.tag}`):Math.round(o.t)+'h'}</text>`});
 s+=`<circle r=".5" fill="var(--fg)"/><text y="1.6" fill="var(--mu)">${tr('pdf.observer')}</text></svg>`;
 $('plan').innerHTML=s;
 let t='<table class="solar-table"><thead><tr><th>'+tr('table.time')+'</th><th>'+tr('table.elevation')+'</th><th>'+tr('table.azimuth')+'</th>'+(S.mode=='cupula'?'<th>'+tr('table.distance')+'</th>':'')+'<th>'+tr('table.pole')+'</th></tr></thead><tbody>';
 E.forEach((o,i)=>t+=`<tr data-i="${i}" tabindex="0" class="${i==sel?'sel':''}"><td>${tf(o.t)}${o.tag?' '+tr(`event.${o.tag}`):''}</td><td>${f(o.e,0)}º</td><td>${f(o.A,0)}º</td>${S.mode=='cupula'?'<td>'+f(o.r)+'</td>':''}<td>${f(o.h)}${o.cap?' *':''}</td></tr>`);
 $('tab').innerHTML=t+'</tbody></table><p class="mu noprint table-note">'+tr('table.solarTime')+' '+tr('table.rounding')+' '+tr('table.rowHelp')+(E.some(o=>o.cap)?tr('table.trimmed'):'')+'</p>';
 steps();
}
function steps(){
 const o=E[sel],{lat,R,N,dec,sp,cp,sd,cd}=S,cA=Math.cos(o.A0*rad),den=Math.cos(o.e*rad)*cp;
 let h=`<b>${tr('steps.title',{time:tf(o.t)})}</b>
 <p>${tr('steps.declination',{day:N,value:f(dec,2)})}</p>
 <p>${tr('steps.hourAngle',{time:f(o.t,2),value:f(o.H)})}</p>
 <p>${tr('steps.elevation',{latitude:lat,sinLat:f(sp,3),sinDec:f(sd,3),cosLat:f(cp,3),cosDec:f(cd,3),cosHour:f(Math.cos(o.H*rad),3),sine:f(o.se,3),exact:f(o.e0),rounded:f(o.e,0)})}</p>
 <p>${den>1e-6?tr('steps.azimuth',{cosine:f(cA,3),angle:f(Math.acos(clamp(cA,-1,1))/rad),afternoon:o.H>0?tr('steps.afternoon',{angle:f(Math.acos(clamp(cA,-1,1))/rad)}):'',actual:f(o.A0),rounded:f(o.A,0)}):tr('steps.azimuthUndefined')}</p>`;
 if(S.mode=='cupula')h+=`<p>${tr('steps.dome',{radius:R,elevation:f(o.e,0),sin:f(Math.sin(o.e*rad),3),height:f(o.h),cos:f(Math.cos(o.e*rad),3),distance:f(o.r),azimuth:f(o.A,0)})}</p>`;
 else h+=`<p>${tr('steps.pole',{radius:R,elevation:f(o.e,0),tan:f(Math.tan(o.e*rad),3),height:f(R*Math.tan(o.e*rad)),capped:o.cap?tr('steps.capped',{height:S.hmax}):''})}</p>`;
 $('steps').innerHTML=h;craft();
}

function earthSol(){
 const lat=+$('lat').value,d=S.dec,r=70,cx=95,cy=100,dr=d*rad;
 const P=(la,k=r,side=0)=>{const t=(side?Math.PI-la*rad:la*rad)-dr;return[cx+k*Math.cos(t),cy-k*Math.sin(t)]};
 let s=`<svg viewBox="0 0 260 200" font-size="9" fill="currentColor" role="img" aria-label="${tr('earth.section')}"><title>${tr('earth.section')}</title><circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--day)" stroke="var(--mu)"/>`;
 s+=`<path d="M${cx} ${cy-r}A${r} ${r} 0 0 0 ${cx} ${cy+r}Z" fill="var(--night)"/>`;
 for(let k=-63;k<=63;k+=21)s+=`<line x1="225" y1="${cy-k}" x2="${cx+Math.sqrt(r*r-k*k)}" y2="${cy-k}" stroke="var(--ac)" stroke-opacity=".6"/>`;
 const L=(a,b,x,w=1)=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${x}" stroke-width="${w}"`;
 s+=L(P(90,r+10),P(-90,r+10),'var(--fg)',1.5)+'/>';
 s+=L(P(0),P(0,r,1),'var(--mu)')+'/>';
 [AXIAL_TILT,-AXIAL_TILT,POLAR_CIRCLE_OFFSET,-POLAR_CIRCLE_OFFSET].forEach(a=>s+=L(P(a),P(a,r,1),'var(--mu)')+' stroke-dasharray="3 3" stroke-opacity=".8"/>');
 const n=P(90,r+19),sp=P(-90,r+19);
 s+=`<text x="${n[0]}" y="${n[1]+3}" text-anchor="middle" font-weight="700">N</text><text x="${sp[0]}" y="${sp[1]+3}" text-anchor="middle" font-weight="700">S</text>`;
 s+=`<text x="${cx+30}" y="${cy+r+22}" text-anchor="middle" fill="var(--mu)">${tr('svg.day')}</text><text x="${cx-30}" y="${cy+r+22}" text-anchor="middle" fill="var(--mu)">${tr('svg.night')}</text>`;
 const th=lat*rad-dr,[ax,ay]=P(lat),[ox,oy]=P(lat,r+12);
 if(Math.cos(th)>0)s+=L([225,ay],[ax,ay],'var(--ac)',1.6)+'/>';
 s+=L([ax-14*Math.sin(th),ay-14*Math.cos(th)],[ax+14*Math.sin(th),ay+14*Math.cos(th)],'var(--bl)',1.4)+'/>';
 s+=`<circle cx="${ax}" cy="${ay}" r="3.5" fill="var(--bl)" stroke="var(--bg)" stroke-width="1.5"/><circle cx="${ax}" cy="${ay}" r="6" fill="none" stroke="var(--bl)" stroke-opacity=".5"/>`;
 s+=`<circle cx="242" cy="${cy+5}" r="8" fill="var(--day)"/><g stroke="var(--day)" stroke-width="1.5"><path d="M242 ${cy-8}v-5m0 36v-5m-13-13h-5m36 0h-5m-22-9-4-4m26 26-4-4m0-18 4-4m-26 26 4-4"/></g><text x="242" y="${cy+24}" text-anchor="middle" fill="var(--mu)">${tr('svg.fixedSun')}</text></svg>`;
 const em=90-Math.abs(lat-d),tilt=Math.abs(d)<1?tr('earth.solarAxisStill'):tr('earth.axisTilt',{degrees:f(Math.abs(d)),direction:tr(d>0?'earth.axisToward':'earth.axisAway')+' '});
 const elevation=em>0?tr('earth.elevation',{value:f(em,0)}):tr('earth.noSun');
 $('earth').innerHTML=s+`<div class="mu">${tr('earth.solIntro',{tilt,declination:f(d),latitude:Math.abs(lat),hemisphere:lat>=0?'N':'S',elevation},['elevation'])}</div>`;
}
let EV='sol';
function earth(){EV=='sol'?earthSol():earthTierra()}
function earthTierra(){
 const lat=+$('lat').value,d=S.dec,r=70,cx=70,cy=100,sx=Math.cos(d*rad),sy=Math.sin(d*rad);
 const P=(a,k=r)=>[cx+k*Math.cos(a*rad),cy-k*Math.sin(a*rad)];
 const dayStart=[cx-r*sy,cy-r*sx],dayEnd=[cx+r*sy,cy+r*sx];
 let s=`<svg viewBox="0 0 260 200" font-size="9" fill="currentColor" role="img" aria-label="${tr('earth.section')}"><title>${tr('earth.section')}</title><path d="M${dayStart[0]} ${dayStart[1]}A${r} ${r} 0 0 1 ${dayEnd[0]} ${dayEnd[1]}Z" fill="var(--day)" stroke="var(--mu)"/>`;
 for(let k=-63;k<=63;k+=21){const m=Math.sqrt(r*r-k*k),px=-sy*k+m*sx,py=sx*k+m*sy;
  s+=`<line x1="${cx+px+140*sx}" y1="${cy-py-140*sy}" x2="${cx+px}" y2="${cy-py}" stroke="var(--ac)" stroke-opacity=".6"/>`}
 s+=`<line x1="${cx}" y1="${cy-r-8}" x2="${cx}" y2="${cy+r+8}" stroke="var(--fg)" stroke-width="1.5"/><line x1="${cx}" y1="${cy}" x2="${cx+r}" y2="${cy}" stroke="var(--mu)"/>`;
 [AXIAL_TILT,-AXIAL_TILT,POLAR_CIRCLE_OFFSET,-POLAR_CIRCLE_OFFSET].forEach(a=>{const q=P(a);s+=`<line x1="${cx}" y1="${q[1]}" x2="${q[0]}" y2="${q[1]}" stroke="var(--mu)" stroke-dasharray="3 3" stroke-opacity=".8"/>`});
 s+=`<text x="${cx}" y="${cy-r-11}" text-anchor="middle" font-weight="700">N</text><text x="${cx}" y="${cy+r+19}" text-anchor="middle" font-weight="700">S</text>`;
 const th=lat*rad,[ax,ay]=P(lat),[ox,oy]=P(lat,r+12);
 if(Math.cos(th-d*rad)>0)s+=`<line x1="${ax}" y1="${ay}" x2="${ax+140*sx}" y2="${ay-140*sy}" stroke="var(--ac)" stroke-width="1.6"/>`;
 s+=`<line x1="${ax-14*Math.sin(th)}" y1="${ay-14*Math.cos(th)}" x2="${ax+14*Math.sin(th)}" y2="${ay+14*Math.cos(th)}" stroke="var(--bl)" stroke-width="1.4"/>`;
 s+=`<circle cx="${ax}" cy="${ay}" r="3.5" fill="var(--bl)" stroke="var(--bg)" stroke-width="1.5"/><circle cx="${ax}" cy="${ay}" r="6" fill="none" stroke="var(--bl)" stroke-opacity=".5"/>`;
 s+=`<circle cx="${cx+160*sx}" cy="${cy-160*sy}" r="8" fill="var(--day)"/><g stroke="var(--day)" stroke-width="1.5"><path d="M${cx+160*sx} ${cy-160*sy-13}v-5m0 36v-5m-13-13h-5m36 0h-5m-22-9-4-4m26 26-4-4m0-18 4-4m-26 26 4-4"/></g></svg>`;
 const em=90-Math.abs(lat-d);
 const elevation=em>0?tr('earth.elevation',{value:f(em,0)}):tr('earth.noSun');
 $('earth').innerHTML=s+`<div class="mu">${tr('earth.tierraIntro',{declination:f(d),latitude:Math.abs(lat),hemisphere:lat>=0?'N':'S',elevation},['elevation'])}</div>`;
}
let drag=0;const eb=$('earth');
const pick=e=>{const so=EV=='sol',cx=so?95:70,b=eb.querySelector('svg').getBoundingClientRect(),x=(e.clientX-b.left)*260/b.width-cx,y=100-(e.clientY-b.top)*200/b.height;
 const a=Math.atan2(y,so?x:Math.max(x,0))/rad+(so?S.dec:0);
 $('lat').value=Math.max(-90,Math.min(90,Math.round(a)));run(0)};
eb.addEventListener('pointerdown',e=>{drag=1;eb.setPointerCapture(e.pointerId);pick(e)});
eb.addEventListener('pointermove',e=>{if(drag)pick(e)});
addEventListener('pointerup',()=>drag=0);
function craft(){
 if(!E.length){$('craft').innerHTML='';return}
 const o=E[sel],R=S.R,cup=S.mode=='cupula',A=o.A,mx=Math.max(...E.map(x=>x.h)),L=Math.ceil(mx)+3;
 const ang=A<=180?`${f(A,0)}º ${tr('craft.right')}`:tr('craft.left',{azimuth:f(A,0),remainder:f(360-A,0)});
 const list=keys=>keys.map(key=>`<li>${tr(key)}</li>`).join('');
 $('craft').innerHTML=`<h2>${tr('craft.title')}</h2>
 <p class="mu">${tr('craft.materials',{size:2*R+6,length:L})}</p>
 <h3>${tr('craft.baseTitle')}</h3>
 <ol>${list(['craft.base1','craft.base2','craft.base3'])}</ol>
 <h3>${tr('craft.azimuthTitle')}</h3>
 <p>${tr('craft.azimuthIntro')}</p>
 <ol><li>${tr('craft.azimuth1')}</li><li>${tr('craft.azimuth2',{time:tf(o.t),azimuth:f(A,0),direction:ang})}</li>${list(['craft.azimuth3','craft.azimuth4'])}</ol>
 <h3>${tr('craft.distanceTitle')}</h3>
 <ol><li>${cup?tr('craft.distanceDome',{distance:f(o.r)}):tr('craft.distancePole',{radius:R})}</li><li>${tr('craft.distance2')}</li></ol>
 <h3>${tr('craft.heightTitle')}</h3>
 <ol><li>${tr('craft.height1',{height:f(o.h),horizon:o.h<0.05?tr('craft.horizon'):''})}</li><li>${tr('craft.height2')}</li><li>${tr('craft.height3',{elevation:f(o.e,0)})}</li></ol>
 <h2 class="reflection-title">${tr('craft.questionsTitle')}</h2>
 <ol>${list(['craft.question1','craft.question2','craft.question3','craft.question4','craft.question5','craft.question6'])}</ol>`;
}

function svgOf(L){const g=c=>`rgb(${c.join(',')})`;let s=`<svg viewBox="0 0 ${L.W} ${L.H}" xmlns="http://www.w3.org/2000/svg"><rect width="${L.W}" height="${L.H}" fill="#fff"/>`;
 L.P.forEach(p=>{if(p.k=='t')s+=`<text x="${p.x}" y="${p.y}" font-size="${p.pt*.3528}" fill="${g(p.c)}" text-anchor="${p.an}" font-family="Helvetica,Arial,sans-serif"${p.b?' font-weight="700"':''}>${escapeHtml(p.s)}</text>`;
  else if(p.k=='r')s+=`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${g(p.c)}"/>`;
  else if(p.k=='l')s+=`<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${g(p.c)}" stroke-width="${p.w}"/>`;
  else if(p.k=='p')s+=`<polyline points="${p.pts.map(q=>q.join(',')).join(' ')}" fill="none" stroke="${g(p.c)}" stroke-width="${p.w}"/>`;
  else s+=`<circle cx="${p.x}" cy="${p.y}" r="${p.r}" ${p.fill?`fill="${g(p.c)}"`:`fill="none" stroke="${g(p.c)}" stroke-width="${p.w}"`}/>`});
 return s+'</svg>'}
function templateLayout(){return layoutTemplate({
 state:{events:E,radius:S.R,model:S.mode,latitude:S.lat,declination:S.dec,daylightAngle:S.H0,date:$('date').value},
 options:{paper:$('paper').value,cropCircle:$('crop-circle').checked,language:LANG},
 helpers:{translate:tr,formatNumber:f,formatTime:tf,citySummary:Array.isArray(CIUDADES)&&CIUDADES.length?ciudades(S.lat):tr('pdf.citiesUnavailable')}
})}
function tplUpdate(){const L=templateLayout();
 $('crop-circle').disabled=S.mode!=='cupula';
 if(!L){$('tinfo').innerHTML=tr('pdf.noSun');$('tprev').innerHTML='';return}
 $('tinfo').innerHTML=tr('pdf.preview',{paper:L.pk,orientation:tr(L.land?'pdf.landscape':'pdf.portrait'),radius:f(L.Rc)})+(L.Rc<L.R0?tr('pdf.reduced',{radius:f(L.R0),factor:f(L.k,2)}):L.Rc>L.R0?tr('pdf.enlarged',{radius:f(L.R0),factor:f(L.k,2)}):tr('pdf.unchanged'))+($('crop-circle').checked&&S.mode==='cupula'?' · '+tr('pdf.cropNotice'):'')+tr('pdf.points');
 $('tprev').innerHTML=svgOf(L)}
function genPDF(open){const L=templateLayout();if(!L)return;const J=window.jspdf&&window.jspdf.jsPDF;
 if(!J){alert(tr('pdf.libraryError'));return}
 const d=new J({unit:'mm',format:[L.W,L.H],orientation:L.W>L.H?'l':'p'}),AL={start:'left',end:'right',middle:'center'};
 L.P.forEach(p=>{if(p.k=='t'){d.setFont('helvetica',p.b?'bold':'normal');d.setFontSize(p.pt);d.setTextColor(...p.c);d.text(p.s,p.x,p.y,{align:AL[p.an]})}
  else if(p.k=='r'){d.setFillColor(...p.c);d.rect(p.x,p.y,p.w,p.h,'F')}
  else if(p.k=='l'){d.setDrawColor(...p.c);d.setLineWidth(p.w);d.line(p.x1,p.y1,p.x2,p.y2)}
  else if(p.k=='p'){d.setDrawColor(...p.c);d.setLineWidth(p.w);for(let i=1;i<p.pts.length;i++)d.line(p.pts[i-1][0],p.pts[i-1][1],p.pts[i][0],p.pts[i][1])}
  else{d.setDrawColor(...p.c);d.setFillColor(...p.c);d.setLineWidth(p.w||.2);d.circle(p.x,p.y,p.r,p.fill?'F':'S')}});
 if(open)window.open(d.output('bloburl'),'_blank');else d.save(`${tr('pdf.filename')}_lat${S.lat}_${$('date').value}.pdf`)}
$('paper').addEventListener('input',tplUpdate);
$('crop-circle').addEventListener('change',tplUpdate);
$('bpdf').addEventListener('click',()=>genPDF(0));$('bpdfo').addEventListener('click',()=>genPDF(1));
$('tab').addEventListener('click',e=>{const r=e.target.closest('tr[data-i]');if(r){sel=+r.dataset.i;draw()}});
$('tab').addEventListener('keydown',e=>{
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[data-i]')){e.preventDefault();e.target.click()}
});
$('language').addEventListener('change',async e=>{
 try{await loadLocale(e.target.value)}
 catch(error){
  console.error(error);
  $('language').value=LANG;
  $('status').textContent=T['language.loadError']||error.message;
  $('status').hidden=false;
 }
});
$('theme').addEventListener('change',e=>setTheme(e.target.value));
$('rnd').addEventListener('click',()=>{
 const year=new Date().getFullYear(),start=Date.UTC(year,0,1),days=(Date.UTC(year+1,0,1)-start)/864e5;
 $('lat').value=Math.floor(Math.random()*181)-90;
 $('date').value=new Date(start+Math.floor(Math.random()*days)*864e5).toISOString().slice(0,10);
 run(0);
});
['lat','date','R','mode','hmax'].forEach(i=>$(i).addEventListener('input',()=>run(0)));
document.querySelectorAll('#etg button').forEach((b,_,all)=>b.addEventListener('click',()=>{
 EV=b.dataset.v;
 all.forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b))});
 earth();
}));
try{
 const savedLanguage=localStorage.getItem('solar-language');
 if(savedLanguage==='es'||savedLanguage==='en')LANG=savedLanguage;
}catch(error){console.warn('Could not read saved language preference.',error)}
try{
 const savedTheme=localStorage.getItem('solar-theme');
 if(savedTheme==='light'||savedTheme==='dark')setTheme(savedTheme);
}catch(error){console.warn('Could not read saved theme preference.',error)}
loadLocale(LANG).then(()=>{
 fetch('ciudades.json').then(response=>{
  if(!response.ok)throw new Error(`Could not load ciudades.json (${response.status})`);
  return response.json();
 }).then(data=>{
  if(!Array.isArray(data))throw new Error('ciudades.json must contain an array');
  CIUDADES=data;updateCities();earth();
 }).catch(error=>{console.error(error);CIUDADES=[];updateCities();earth()});
}).catch(error=>{
 console.error(error);
 $('status').textContent=error.message;
 $('status').hidden=false;
});
