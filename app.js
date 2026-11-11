
import {AXIAL_TILT,POLAR_CIRCLE_OFFSET,clamp,computeSun} from './src/astro.js';

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

const PAPEL={A4:[210,297],A3:[297,420]};
function lines(o,k){return [tf(o.t)].concat(o.z?[tr(`event.${o.tag}`)]:[],[f(o.h*k)+' cm'+(o.cap?'*':'')])}
function lbl(o,x,y,k,v=0){const L=lines(o,k),w=Math.max(...L.map(t=>t.length))*1.5+1,h=L.length*3.3,u0=Math.sin(o.A*rad),v0=-Math.cos(o.A*rad),[ux,uy]=[[u0,v0],[-u0,-v0],[-v0,u0],[v0,-u0]][v],lx=x+ux*2.8,ly=y+uy*2.8,an=ux>.35?'start':ux<-.35?'end':'middle',bx=an=='start'?lx:an=='end'?lx-w:lx-w/2,by=uy<-.5?ly-h:uy>.5?ly:ly-h/2;return{L,an,tx:lx,ty:by+2.4,box:[bx,by,bx+w,by+h]}}
function mk(){
 if(!E.length)return null;
 const pk=$('paper').value,[pa,pb]=PAPEL[pk],R0=S.R,cup=S.mode=='cupula',cropCircle=cup&&$('crop-circle').checked,n=E.length,m=10,cw=78;
 const an=E.map(o=>o.A).sort((x,y)=>x-y);let mi=0,G=-1;
 an.forEach((x,i)=>{const g=i<an.length-1?an[i+1]-x:an[0]+360-x;if(g>G){G=g;mi=i}});
 const full=G<70,a0=full?0:an[(mi+1)%an.length]-12,len=full?360:360-G+24,ia=a=>full||((a-a0+720)%360)<=len,gc=full?Math.PI:(an[mi]+G/2)*rad;
 const CARD=[['N',0],['E',90],['S',180],[tr('pdf.west'),270]];
 const dateTxt=new Date($('date').value+'T12:00:00Z').toLocaleDateString(LANG,{day:'numeric',month:'long',timeZone:'UTC'});
 const wrap=(text,chars)=>{const out=[];let line='';text.split(/\s+/).forEach(word=>{if(!line)line=word;else if(`${line} ${word}`.length>chars){out.push(line);line=word}else line+=' '+word});if(line)out.push(line);return out};
 const headerFor=(W,H,diagramBoxes,tableBoxes,Rm)=>{
  const radius=f(Rm/10),scaling=Rm/10<R0?tr('pdf.scaledDown',{radius:f(R0)}):Rm/10>R0?tr('pdf.scaledUp',{radius:f(R0)}):'';
  const texts=[
   {text:tr('pdf.titleLine',{latitude:Math.abs(S.lat),hemisphere:S.lat>=0?'N':'S',date:dateTxt}),pt:10.5,bold:1,step:3.7},
   {text:tr('pdf.subtitle',{declination:f(S.dec),radius,scaling,model:tr(cup?'pdf.modelDome':'pdf.modelPole'),paper:pk}),pt:8,step:3.2},
   {text:tr('pdf.daylight',{hours:f(S.H0/7.5)}),pt:7.5,step:2.8},
   {text:Array.isArray(CIUDADES)&&CIUDADES.length?ciudades(S.lat):tr('pdf.citiesUnavailable'),pt:7.5,step:2.8},
   {text:tr('pdf.instructions',{trimmed:E.some(o=>o.cap)?tr('pdf.trimmed'):''}),pt:8,step:3.2},
   {text:tr('pdf.solarTime'),pt:8,bold:1,step:3.2}
  ];
  const obstacles=[...diagramBoxes,...tableBoxes.map(b=>[b[0]-2,b[1]-2,b[2]+2,b[3]+2])];
  const xs=[m,W-m],ys=[m,H-m-14];
  obstacles.forEach(b=>{xs.push(Math.max(m,Math.min(W-m,b[0])),Math.max(m,Math.min(W-m,b[2])));ys.push(Math.max(m,Math.min(H-m-14,b[1])),Math.max(m,Math.min(H-m-14,b[3])))});
  const candidates=[];
  for(const x0 of xs)for(const x1 of xs)if(x1-x0>=52)for(const y0 of ys)for(const y1 of ys)if(y1-y0>=25&&
   !obstacles.some(b=>x0<b[2]&&x1>b[0]&&y0<b[3]&&y1>b[1]))candidates.push({x:x0,y:y0,w:x1-x0,h:y1-y0});
  candidates.sort((a,b)=>a.x-b.x||b.h*a.w-a.h*b.w);
  for(const box of candidates){
   const maxChars=pt=>Math.max(cropCircle?8:14,Math.floor(box.w/(pt*.18)));
   const lines=texts.map(item=>({...item,lines:wrap(item.text,maxChars(item.pt))}));
   lines[0].lines.slice(0,-1).forEach((line,i)=>{if(line.endsWith(' -'))lines[0].lines[i]=line.slice(0,-2)});
   const height=lines.reduce((sum,item)=>sum+item.lines.length*item.step+2,0)+10;
   if(height>box.h)continue;
   const items=[];let y=box.y+3;
   lines.forEach(item=>{item.lines.forEach((line,i)=>{items.push({x:box.x+2,y:y+i*item.step,s:line,pt:item.pt,b:item.bold||0})});y+=item.lines.length*item.step+2});
   return{items,scale:{x1:box.x+2,y1:y,x2:box.x+52,y2:y,c:[140,140,140],label:tr('pdf.scaleCheck'),labelY:y+4,box}};
  }
  return null
 };
 // Evita que la tabla cubra el arco, las marcas, los rótulos o el observador.
 const occ=(Rm,k)=>{const pts=[],bx=[];let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,px0=1e9,py0=1e9,px1=-1e9,py1=-1e9;
  const ad=(x,y)=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)};
  const ab=b=>{bx.push(b);ad(b[0],b[1]);ad(b[2],b[3])};
  const ap=b=>{px0=Math.min(px0,b[0]);py0=Math.min(py0,b[1]);px1=Math.max(px1,b[2]);py1=Math.max(py1,b[3])};
  for(let q=0;q<=len;q+=2){const t=(a0+q)*rad,x=Rm*Math.sin(t),y=-Rm*Math.cos(t);pts.push([x,y]);ad(x,y)}
  const positions=E.map(o=>[o.r/R0*Rm*Math.sin(o.A*rad),-o.r/R0*Rm*Math.cos(o.A*rad)]);
  const placed=positions.map(([x,y])=>[x-2.2,y-2.2,x+2.2,y+2.2]),overlaps=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
  positions.forEach(([x,y])=>{ad(x,y);const marker=[x-2.2,y-2.2,x+2.2,y+2.2];ab(marker);ap(marker)});
  ab([-5,-5,5,5]);ap([-5,-5,5,5]);const observerBox=[8*Math.sin(gc)-8,-8*Math.cos(gc)-4,8*Math.sin(gc)+8,-8*Math.cos(gc)+2];ab(observerBox);ap(observerBox);
  const observerX=8*Math.sin(gc),observerY=-8*Math.cos(gc)+1.2;
  const observerLabel=[observerX-12,observerY-3,observerX+12,observerY+3];ab(observerLabel);ap(observerLabel);
  placed.push([-5,-5,5,5]);
  CARD.forEach(([nm,a])=>{if(ia(a)){const x=(Rm+6)*Math.sin(a*rad),y=-(Rm+6)*Math.cos(a*rad),box=[x-3.5,y-3.5,x+3.5,y+3.5];ab(box);placed.push(box)}});
  E.forEach((o,i)=>{const [x,y]=positions[i];let box;
   for(let v=0;v<4;v++){const l=lbl(o,x,y,k,v);box=[l.box[0],l.box[1],l.box[2],l.box[3]];if(!placed.some(other=>overlaps(other,box)))break;if(v===3){const l0=lbl(o,x,y,k,0);box=[l0.box[0],l0.box[1],l0.box[2],l0.box[3]]}}
   placed.push(box);ab(box);ap(box)});
  return{pts,bx,bb:[x0-3,y0-3,x1+3,y1+3],pointBB:[px0-3,py0-3,px1+3,py1+3]}};
 const hit=(r,O,ox,oy)=>{for(const q of O.pts){const x=q[0]+ox,y=q[1]+oy;if(x>r[0]&&x<r[2]&&y>r[1]&&y<r[3])return 1}
  for(const b of O.bx)if(b[0]+ox<r[2]&&b[2]+ox>r[0]&&b[1]+oy<r[3]&&b[3]+oy>r[1])return 1;return 0};
 // Coloca dibujo y tabla (en una esquina libre) para un radio dado
 const place=(W,H,cols,Rm,k,force)=>{const O=occ(Rm,k),bb=O.bb,placementBounds=cropCircle?O.pointBB:bb,bw=placementBounds[2]-placementBounds[0],bh=placementBounds[3]-placementBounds[1],aw=W-2*m,ay=m,contentBottom=H-m-(cropCircle?14:0),ah=contentBottom-ay;
  if((!cropCircle&&(bb[2]-bb[0]>aw||bb[3]-bb[1]>H-m-ay))||bw>aw||bh>ah)return null;
  const groupW=cols>1?64:cw,groupGap=cols>1?4:6,rowH=cols>1?3:4.2,rc=Math.ceil(n/cols),tw=cols*groupW+(cols-1)*groupGap,th=(rc+1)*rowH;
 const offsets=[];
 for(const fy of[0,.5,1])for(const fx of[0,.25,.5,.75,1])offsets.push([m+fx*(aw-bw)-placementBounds[0],ay+fy*(ah-bh)-placementBounds[1]]);
 let bestLayout=null;
 for(const [ox,oy] of offsets){
  const northBox=ia(0)?[ox-3.5,oy-Rm-6-3.5,ox+3.5,oy-Rm-6+3.5]:null;
  const northVisible=northBox&&northBox[0]>=m&&northBox[1]>=(cropCircle?m:0)&&northBox[2]<=W-m&&northBox[3]<=(cropCircle?contentBottom:H-m);
  const north=northVisible?northBox:null;
  if(!cropCircle&&northBox&&!northVisible)continue;
  const slots=[[W-m-tw,oy+bb[1]+9],[m,oy+bb[1]+9],[W-m-tw,H-m-th],[m,H-m-th]];
 const nightSlots=[];
 if(!full)for(const distance of[.47,.45,.43,.5])for(const cross of[0,-.08,.08]){
  const nightX=ox+Math.sin(gc)*Rm*distance+Math.cos(gc)*Rm*cross;
  const nightY=oy-Math.cos(gc)*Rm*distance+Math.sin(gc)*Rm*cross;
  nightSlots.push([nightX-tw/2,nightY-th/2])
 }
 slots.unshift(...nightSlots);
 const xs=[m,W/2-tw/2,W-m-tw,ox+bb[0],ox+(bb[0]+bb[2]-tw)/2,ox+bb[2]-tw];
  const ys=[ay,(ay+H-m-th)/2,H-m-th,oy+bb[1],oy+(bb[1]+bb[3]-th)/2,oy+bb[3]-th];
  xs.forEach(tx=>ys.forEach(ty=>slots.push([tx,ty])));
  for(const [slotIndex,[tx,ty]] of slots.entries()){
   if(tx<m||tx+tw>W-m||ty<ay||ty+th>contentBottom)continue;
   if(force||!hit([tx-3,ty-3,tx+tw+3,ty+th+3],O,ox,oy)){
    const headerBox=cropCircle?O.pointBB:bb,tableBoxes=Array.from({length:cols},(_,c)=>[tx+c*(groupW+groupGap)-1,ty,tx+c*(groupW+groupGap)+groupW+1,ty+th]),header=headerFor(W,H,[[headerBox[0]+ox,headerBox[1]+oy,headerBox[2]+ox,headerBox[3]+oy]],north?[...tableBoxes,north]:tableBoxes,Rm);
    if(header){
     const candidate={ox,oy,tx,ty,cols,rc,tw,th,groupW,groupGap,rowH,night:slotIndex<nightSlots.length,header};
     if(!bestLayout||header.items[0].x<bestLayout.header.items[0].x||(header.items[0].x===bestLayout.header.items[0].x&&candidate.night&&!bestLayout.night))bestLayout=candidate
    }
   }
  }
 }
 return bestLayout};
 let best=null;
 [0,1].forEach(land=>[1,2,3].forEach(cols=>{const W=land?pb:pa,H=land?pa:pb;
  const fe=Rm=>place(W,H,cols,Rm,1);let Rm=0;
  const maxRadius=cropCircle?500:pk=='A3'?400:R0*10;
  for(let r=Math.floor(maxRadius/5)*5;r>=15;r-=5){if(fe(r)){Rm=r;break}}
  if(!Rm)return;
  const Rc=Math.max(3,Math.floor(Rm/10*2)/2),layout=fe(Rc*10);
  if(!best||Rc>best.Rc||(Rc===best.Rc&&layout.night&&!best.night))best={W,H,land,cols,Rc,night:layout.night}}));
 if(!best)best={W:pa,H:pb,land:0,cols:2,Rc:3};
 let {W,H,land,cols,Rc}=best,pl;
 while(Rc>3&&!(pl=place(W,H,cols,Rc*10,Rc/R0)))Rc-=.5;
 if(!pl)pl=place(W,H,cols,Rc*10,Rc/R0,1);
 if(!pl){Rc=3;pl=place(W,H,cols,30,3/R0,1)}
 if(!pl)return null;
 const k=Rc/R0,Rm=Rc*10,{ox,oy,rc}=pl;
 const P=[],tableItems=[],BK=[0,0,0],G1=[140,140,140],G2=[165,165,165];
 const T=(x,y,s,pt,c,al='start',b=0)=>P.push({k:'t',x,y,s,pt,c,an:al,b});
 const TT=(x,y,s,pt,c,al='start',b=0)=>tableItems.push({k:'t',x,y,s,pt,c,an:al,b});
 pl.header.items.forEach(item=>T(item.x,item.y,item.s,item.pt,G1,'start',item.b));
 P.push({k:'l',x1:pl.header.scale.x1,y1:pl.header.scale.y1,x2:pl.header.scale.x2,y2:pl.header.scale.y2,c:G1,w:.4});
 T(pl.header.scale.x2,pl.header.scale.labelY,pl.header.scale.label,6.5,G1,'end');
 const rowsT=(x0,y0,list)=>{const X=(cup?[0,33,49,63,78]:[0,33,49,0,63]).map(x=>x*pl.groupW/cw),tableFont=pl.cols>1?6.5:7.5;
  TT(x0+X[0],y0,tr('table.time'),tableFont,G1,'start',1);TT(x0+X[1],y0,tr('pdf.elevation'),tableFont,G1,'end',1);TT(x0+X[2],y0,tr('pdf.azimuth'),tableFont,G1,'end',1);if(cup)TT(x0+X[3],y0,tr('pdf.distance'),tableFont,G1,'end',1);TT(x0+X[4],y0,tr('pdf.height'),tableFont,G1,'end',1);
  list.forEach((o,j)=>{const y=y0+(j+1)*pl.rowH;TT(x0+X[0],y,tf(o.t)+(o.z?' '+tr(`event.${o.tag}`):''),tableFont,G2);TT(x0+X[1],y,f(o.e,0)+'º',tableFont,G2,'end');TT(x0+X[2],y,f(o.A,0)+'º',tableFont,G2,'end');if(cup)TT(x0+X[3],y,f(o.r*k),tableFont,G2,'end');TT(x0+X[4],y,f(o.h*k)+(o.cap?'*':''),tableFont,G2,'end')})};
 for(let c=0;c<pl.cols;c++)rowsT(pl.tx+c*(pl.groupW+pl.groupGap),pl.ty+3,E.slice(c*rc,(c+1)*rc));
 const arc=[];for(let q=0;q<=len;q++){const t=(a0+q)*rad;arc.push([ox+Rm*Math.sin(t),oy-Rm*Math.cos(t)])}
 P.push({k:'p',pts:arc,c:BK,w:.4});
 const contentBottom=H-m-(cropCircle?14:0);
 CARD.forEach(([nm,a])=>{if(ia(a)){const s_=Math.sin(a*rad),c_=-Math.cos(a*rad),x=ox+(Rm+6)*s_,y=oy+(Rm+6)*c_;
  if(!cropCircle||(x>=m+6&&x<=W-m-6&&y>=m+6&&y<=contentBottom-6)){P.push({k:'l',x1:ox+(Rm-2)*s_,y1:oy+(Rm-2)*c_,x2:ox+(Rm+2)*s_,y2:oy+(Rm+2)*c_,c:BK,w:.4});T(x,y+1.3,nm,10,BK,'middle',1)}}});
 const hit2=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
 const pos=E.map(o=>{const rr=o.r*k*10;return[ox+rr*Math.sin(o.A*rad),oy-rr*Math.cos(o.A*rad)]});
 const placed=pos.map(q=>[q[0]-1.8,q[1]-1.8,q[0]+1.8,q[1]+1.8]);placed.push([ox-5,oy-5,ox+5,oy+5]);
 CARD.forEach(([nm,a])=>{if(ia(a)){const x=ox+(Rm+6)*Math.sin(a*rad),y=oy-(Rm+6)*Math.cos(a*rad);if(!cropCircle||(x>=m+6&&x<=W-m-6&&y>=m+6&&y<=contentBottom-6))placed.push([x-3.5,y-3.5,x+3.5,y+3.5])}});
 const LB=[];
 E.forEach((o,i)=>{const [x,y]=pos[i];
  P.push({k:'l',x1:ox,y1:oy,x2:x,y2:y,c:BK,w:.12});P.push({k:'c',x,y,r:1.1,c:BK,fill:1});
  let l,bx;for(let v=0;v<4;v++){l=lbl(o,x-ox,y-oy,k,v);bx=[l.box[0]+ox,l.box[1]+oy,l.box[2]+ox,l.box[3]+oy];if(!placed.some(q=>hit2(q,bx)))break;if(v==3){l=lbl(o,x-ox,y-oy,k,0);bx=[l.box[0]+ox,l.box[1]+oy,l.box[2]+ox,l.box[3]+oy]}}
  placed.push(bx);LB.push({k:'r',x:bx[0]-.3,y:bx[1]-.2,w:bx[2]-bx[0]+.6,h:bx[3]-bx[1]+.4,c:[255,255,255]});
  l.L.forEach((t,j)=>LB.push({k:'t',x:ox+l.tx,y:oy+l.ty+j*3.3,s:t,pt:8,c:BK,an:l.an,b:j==l.L.length-1?1:0}))});
 P.push(...LB);
 P.push({k:'c',x:ox,y:oy,r:2.5,c:BK,w:.5});P.push({k:'l',x1:ox-4,y1:oy,x2:ox+4,y2:oy,c:BK,w:.3});P.push({k:'l',x1:ox,y1:oy-4,x2:ox,y2:oy+4,c:BK,w:.3});
 T(ox+8*Math.sin(gc),oy-8*Math.cos(gc)+1.2,tr('pdf.observer'),7,BK,'middle');
 for(let c=0;c<pl.cols;c++)P.push({k:'r',x:pl.tx+c*(pl.groupW+pl.groupGap)-1,y:pl.ty,w:pl.groupW+2,h:pl.th,c:[255,255,255]});
 P.push(...tableItems);
 T(m,H-7,tr('pdf.attribution'),6.5,G1);
 T(m,H-3,tr('pdf.license'),6.5,G1);
 const lineHitsBox=(x1,y1,x2,y2,b)=>{
  let t0=0,t1=1;const dx=x2-x1,dy=y2-y1;
  for(const [p,q] of[[-dx,x1-b[0]],[dx,b[2]-x1],[-dy,y1-b[1]],[dy,b[3]-y1]]){
   if(p===0){if(q<0)return false}
   else{const t=q/p;if(p<0){if(t>t1)return false;t0=Math.max(t0,t)}else{if(t<t0)return false;t1=Math.min(t1,t)}}
  }
  return true
 };
 const touches=(b,p)=>{
  if(p.k==='t'){
   const w=p.s.length*p.pt*.19,left=p.an==='end'?p.x-w:p.an==='middle'?p.x-w/2:p.x;
   return left<b[2]&&left+w>b[0]&&p.y-p.pt*.4<b[3]&&p.y+p.pt*.08>b[1]
  }
  if(p.k==='r')return p.x<b[2]&&p.x+p.w>b[0]&&p.y<b[3]&&p.y+p.h>b[1];
  if(p.k==='c'){
   const x=Math.max(b[0],Math.min(p.x,b[2])),y=Math.max(b[1],Math.min(p.y,b[3]));
   return (p.x-x)**2+(p.y-y)**2<=(p.r+(p.w||0)/2)**2
  }
  if(p.k==='l')return lineHitsBox(p.x1,p.y1,p.x2,p.y2,b);
  for(let i=1;i<p.pts.length;i++)if(lineHitsBox(...p.pts[i-1],...p.pts[i],b))return true;
  return false
 };
 const addGlobe=()=>{
  for(let diameter=40;diameter>=28;diameter-=2){
   const r=diameter*.32,w=2*r+12,h=2*r+16;
   for(let y=H-20-h;y>=8;y-=4)for(let x=8;x<=W-w-8;x+=4){
    const b=[x,y,x+w,y+h];
    if(P.some(p=>touches(b,p)))continue;
    const cx=x+r+2,cy=y+r+4,decAngle=S.dec*rad,latAngle=(S.lat-S.dec)*rad,latitudeY=cy-r*Math.sin(latAngle);
    const stroke=[75,91,105],equator=[177,185,192],blue=[32,121,174],sun=[220,151,47];
    P.push({k:'c',x:cx,y:cy,r,c:[247,250,252],fill:1});
    P.push({k:'c',x:cx,y:cy,r,c:stroke,w:.45});
    const eastX=Math.cos(decAngle),eastY=Math.sin(decAngle),northX=Math.sin(decAngle),northY=-Math.cos(decAngle);
    if(Math.abs(S.lat)>1e-6)P.push({k:'l',x1:cx-r*eastX,y1:cy-r*eastY,x2:cx+r*eastX,y2:cy+r*eastY,c:equator,w:.25});
    P.push({k:'l',x1:cx-(r+2)*northX,y1:cy-(r+2)*northY,x2:cx+(r+2)*northX,y2:cy+(r+2)*northY,c:equator,w:.2});
    const latitudeOffset=r*Math.sin(S.lat*rad),latitudeHalf=r*Math.cos(S.lat*rad);
    P.push({k:'l',x1:cx+latitudeOffset*northX-latitudeHalf*eastX,y1:cy+latitudeOffset*northY-latitudeHalf*eastY,x2:cx+latitudeOffset*northX+latitudeHalf*eastX,y2:cy+latitudeOffset*northY+latitudeHalf*eastY,c:blue,w:.85});
    const surfaceX=cx+r*Math.cos(latAngle);
    P.push({k:'c',x:surfaceX,y:latitudeY,r:1.35,c:[255,255,255],fill:1});
    P.push({k:'c',x:surfaceX,y:latitudeY,r:.85,c:blue,fill:1});
    if(Math.cos(latAngle)>0){
     const sunX=x+w-3.4;
     for(const offset of[-3.2,0,3.2]){
      const rayY=Math.max(cy-r*.88,Math.min(cy+r*.88,latitudeY+offset));
      const rayEdge=cx+Math.sqrt(Math.max(0,r*r-(rayY-cy)**2));
      P.push({k:'l',x1:rayEdge,y1:rayY,x2:sunX-1.8,y2:rayY,c:sun,w:.3})
     }
     P.push({k:'c',x:sunX,y:latitudeY,r:1.6,c:sun,fill:1});
     for(let angle=0;angle<360;angle+=45){
      const a=angle*rad;
      P.push({k:'l',x1:sunX+2.1*Math.sin(a),y1:latitudeY-2.1*Math.cos(a),x2:sunX+3.1*Math.sin(a),y2:latitudeY-3.1*Math.cos(a),c:sun,w:.35})
     }
    }
    T(cx,cy+r+6,f(Math.abs(S.lat),0)+'º '+(S.lat>=0?'N':'S'),7.5,blue,'middle');
    return
   }
  }
 };
 addGlobe();
 return{P,W,H,land,Rc,k,R0,pk}}
function svgOf(L){const g=c=>`rgb(${c.join(',')})`;let s=`<svg viewBox="0 0 ${L.W} ${L.H}" xmlns="http://www.w3.org/2000/svg"><rect width="${L.W}" height="${L.H}" fill="#fff"/>`;
 L.P.forEach(p=>{if(p.k=='t')s+=`<text x="${p.x}" y="${p.y}" font-size="${p.pt*.3528}" fill="${g(p.c)}" text-anchor="${p.an}" font-family="Helvetica,Arial,sans-serif"${p.b?' font-weight="700"':''}>${escapeHtml(p.s)}</text>`;
  else if(p.k=='r')s+=`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${g(p.c)}"/>`;
  else if(p.k=='l')s+=`<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${g(p.c)}" stroke-width="${p.w}"/>`;
  else if(p.k=='p')s+=`<polyline points="${p.pts.map(q=>q.join(',')).join(' ')}" fill="none" stroke="${g(p.c)}" stroke-width="${p.w}"/>`;
  else s+=`<circle cx="${p.x}" cy="${p.y}" r="${p.r}" ${p.fill?`fill="${g(p.c)}"`:`fill="none" stroke="${g(p.c)}" stroke-width="${p.w}"`}/>`});
 return s+'</svg>'}
function tplUpdate(){const L=mk();
 $('crop-circle').disabled=S.mode!=='cupula';
 if(!L){$('tinfo').innerHTML=tr('pdf.noSun');$('tprev').innerHTML='';return}
 $('tinfo').innerHTML=tr('pdf.preview',{paper:L.pk,orientation:tr(L.land?'pdf.landscape':'pdf.portrait'),radius:f(L.Rc)})+(L.Rc<L.R0?tr('pdf.reduced',{radius:f(L.R0),factor:f(L.k,2)}):L.Rc>L.R0?tr('pdf.enlarged',{radius:f(L.R0),factor:f(L.k,2)}):tr('pdf.unchanged'))+($('crop-circle').checked&&S.mode==='cupula'?' · '+tr('pdf.cropNotice'):'')+tr('pdf.points');
 $('tprev').innerHTML=svgOf(L)}
function genPDF(open){const L=mk();if(!L)return;const J=window.jspdf&&window.jspdf.jsPDF;
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
