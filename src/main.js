import * as astro from './astro.js';
import * as earthView from './earthView.js';
import * as i18n from './i18n.js';
import * as template from './template.js';
import * as pdf from './pdf.js';

export function createApp({state,modules}) {
 const {clamp,computeSun}=modules.astro;
 const {renderEarthSol,renderEarthTierra}=modules.earthView;
 const {getLanguage,getSavedLanguage,getTranslation,setLanguage,tr}=modules.i18n;
 const {layoutTemplate}=modules.template;
 const {genPDF,renderPdfPreviewSvg}=modules.pdf;
 const $=id=>document.getElementById(id),rad=Math.PI/180;
const formatNumber=(value,digits=1)=>value.toFixed(digits).replace('.',getLanguage()==='es'?',':'.');
const formatTime=time=>{let hour=Math.floor(time),minute=Math.round((time-hour)*60);if(minute==60){hour++;minute=0}return hour+':'+String(minute).padStart(2,'0')};
let events=state.events,solarState=state.solar,selectedIndex=state.selectedIndex;
let CIUDADES=state.cities,EV=state.earthView;
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
 const {dayNumber:N,declination:dec,dayAngle:H0,events:computedEvents}=computeSun(lat,$('date').value);
 const sp=Math.sin(lat*rad),cp=Math.cos(lat*rad),sd=Math.sin(dec*rad),cd=Math.cos(dec*rad);
 events=computedEvents;
 state.events=events;
 events.forEach(event=>{event.e0=event.e;event.A0=event.A;event.e=Math.round(event.e);event.A=Math.round(event.A)%360});
 events.forEach(event=>{const elevation=event.e*rad;
  if(mode=='cupula'){event.r=R*Math.cos(elevation);event.h=R*Math.sin(elevation)}
  else{event.r=R;event.h=R*Math.tan(elevation);event.cap=event.h>hmax;if(event.cap)event.h=hmax}});
 solarState={lat,R,mode,N,dec,sp,cp,sd,cd,H0,hmax};
 state.solar=solarState;
 $('hmax-label').hidden=mode!=='poste';
 $('sum').innerHTML=!events.length?tr('summary.polarNight'):
  (H0==180?tr('summary.polarDay'):'')+tr('summary.declination',{value:formatNumber(dec)})+' · '+tr('summary.daylight',{value:formatNumber(H0/7.5)});
 earth();
 updateCities();
 if(!keep||selectedIndex>=events.length){selectedIndex=0;events.forEach((event,index)=>{if(event.e>events[selectedIndex].e)selectedIndex=index})}
 draw();tplUpdate();
 state.selectedIndex=selectedIndex;
}
function draw(){
 if(!events.length){$('plan').innerHTML='';$('tab').innerHTML='';$('steps').innerHTML='';$('craft').innerHTML='';return}
 const R=solarState.R,V=R+3;let s=`<svg viewBox="${-V} ${-V} ${2*V} ${2*V}" font-size="${R/12}" text-anchor="middle" role="img" aria-label="${tr('results.label')}"><title>${tr('results.label')}</title>`;
 s+=`<circle r="${R}" fill="none" stroke="var(--ln)"/><circle r="${R/2}" fill="none" stroke="var(--ln)" stroke-dasharray="2 2"/>`;
 s+=`<path d="M${-R} 0H${R}M0 ${-R}V${R}" stroke="var(--ln)"/>`;
 [['N',0,-R-1],['S',0,R+1.8],['E',R+1.2,.4],[tr('pdf.west'),-R-1.2,.4]].forEach(a=>s+=`<text x="${a[1]}" y="${a[2]}" fill="var(--mu)" font-weight="700">${a[0]}</text>`);
 const P=events.map(event=>[event.r*Math.sin(event.A*rad),-event.r*Math.cos(event.A*rad)]);
 s+=`<polyline points="${P.map(p=>p.join(',')).join(' ')}" fill="none" stroke="var(--ac)" stroke-opacity=".5" stroke-dasharray="1 .6"/>`;
 events.forEach((event,index)=>{const [x,y]=P[index],color=event.z?'var(--bl)':'var(--ac)',labelX=x*1.0+Math.sin(event.A*rad)*1.3,labelY=y-Math.cos(event.A*rad)*1.3+.35;
  s+=`<circle cx="${x}" cy="${y}" r="${index==selectedIndex?.6:.4}" fill="${color}" stroke="${index==selectedIndex?'var(--fg)':'none'}" stroke-width=".15"/>`;
  s+=`<text x="${labelX}" y="${labelY}" fill="${color}">${event.z?tr(`event.${event.tag}`):Math.round(event.t)+'h'}</text>`});
 s+=`<circle r=".5" fill="var(--fg)"/><text y="1.6" fill="var(--mu)">${tr('pdf.observer')}</text></svg>`;
 $('plan').innerHTML=s;
 let tableHtml='<table class="solar-table"><thead><tr><th>'+tr('table.time')+'</th><th>'+tr('table.elevation')+'</th><th>'+tr('table.azimuth')+'</th>'+(solarState.mode=='cupula'?'<th>'+tr('table.distance')+'</th>':'')+'<th>'+tr('table.pole')+'</th></tr></thead><tbody>';
 events.forEach((event,index)=>tableHtml+=`<tr data-i="${index}" tabindex="0" class="${index==selectedIndex?'sel':''}"><td>${formatTime(event.t)}${event.tag?' '+tr(`event.${event.tag}`):''}</td><td>${formatNumber(event.e,0)}º</td><td>${formatNumber(event.A,0)}º</td>${solarState.mode=='cupula'?'<td>'+formatNumber(event.r)+'</td>':''}<td>${formatNumber(event.h)}${event.cap?' *':''}</td></tr>`);
 $('tab').innerHTML=tableHtml+'</tbody></table><p class="mu noprint table-note">'+tr('table.solarTime')+' '+tr('table.rounding')+' '+tr('table.rowHelp')+(events.some(event=>event.cap)?tr('table.trimmed'):'')+'</p>';
 steps();
}
function steps(){
 const event=events[selectedIndex],{lat,R,N,dec,sp,cp,sd,cd}=solarState,cosineAzimuth=Math.cos(event.A0*rad),denominator=Math.cos(event.e*rad)*cp;
 let html=`<b>${tr('steps.title',{time:formatTime(event.t)})}</b>
 <p>${tr('steps.declination',{day:N,value:formatNumber(dec,2)})}</p>
 <p>${tr('steps.hourAngle',{time:formatNumber(event.t,2),value:formatNumber(event.H)})}</p>
 <p>${tr('steps.elevation',{latitude:lat,sinLat:formatNumber(sp,3),sinDec:formatNumber(sd,3),cosLat:formatNumber(cp,3),cosDec:formatNumber(cd,3),cosHour:formatNumber(Math.cos(event.H*rad),3),sine:formatNumber(event.se,3),exact:formatNumber(event.e0),rounded:formatNumber(event.e,0)})}</p>
 <p>${denominator>1e-6?tr('steps.azimuth',{cosine:formatNumber(cosineAzimuth,3),angle:formatNumber(Math.acos(clamp(cosineAzimuth,-1,1))/rad),afternoon:event.H>0?tr('steps.afternoon',{angle:formatNumber(Math.acos(clamp(cosineAzimuth,-1,1))/rad)}):'',actual:formatNumber(event.A0),rounded:formatNumber(event.A,0)}):tr('steps.azimuthUndefined')}</p>`;
 if(solarState.mode=='cupula')html+=`<p>${tr('steps.dome',{radius:R,elevation:formatNumber(event.e,0),sin:formatNumber(Math.sin(event.e*rad),3),height:formatNumber(event.h),cos:formatNumber(Math.cos(event.e*rad),3),distance:formatNumber(event.r),azimuth:formatNumber(event.A,0)})}</p>`;
 else html+=`<p>${tr('steps.pole',{radius:R,elevation:formatNumber(event.e,0),tan:formatNumber(Math.tan(event.e*rad),3),height:formatNumber(R*Math.tan(event.e*rad)),capped:event.cap?tr('steps.capped',{height:solarState.hmax}):''})}</p>`;
 $('steps').innerHTML=html;craft();
}

function earthSol(){
 $('earth').innerHTML=renderEarthSol({latitude:+$('lat').value,declination:solarState.dec,helpers:{translate:tr,formatNumber}});
}
function earth(){EV=='sol'?earthSol():earthTierra()}
function earthTierra(){
 $('earth').innerHTML=renderEarthTierra({latitude:+$('lat').value,declination:solarState.dec,helpers:{translate:tr,formatNumber}});
}
let drag=0;const eb=$('earth');
let latitudeUpdateTimer;
function scheduleLatitudeUpdate(){
 clearTimeout(latitudeUpdateTimer);
 latitudeUpdateTimer=setTimeout(()=>{run(0);latitudeUpdateTimer=null},120);
}
const pick=pointerEvent=>{const fixedSun=EV=='sol',centerX=fixedSun?95:70,bounds=eb.querySelector('svg').getBoundingClientRect(),x=(pointerEvent.clientX-bounds.left)*260/bounds.width-centerX,y=100-(pointerEvent.clientY-bounds.top)*200/bounds.height;
 const latitudeAngle=Math.atan2(y,fixedSun?x:Math.max(x,0))/rad+(fixedSun?solarState.dec:0);
 $('lat').value=Math.max(-90,Math.min(90,Math.round(latitudeAngle)));scheduleLatitudeUpdate()};
eb.addEventListener('pointerdown',pointerEvent=>{drag=1;eb.setPointerCapture(pointerEvent.pointerId);pick(pointerEvent)});
eb.addEventListener('pointermove',pointerEvent=>{if(drag)pick(pointerEvent)});
addEventListener('pointerup',()=>drag=0);
function craft(){
 if(!events.length){$('craft').innerHTML='';return}
 const event=events[selectedIndex],R=solarState.R,cup=solarState.mode=='cupula',azimuth=event.A,maxHeight=Math.max(...events.map(item=>item.h)),length=Math.ceil(maxHeight)+3;
 const direction=azimuth<=180?`${formatNumber(azimuth,0)}º ${tr('craft.right')}`:tr('craft.left',{azimuth:formatNumber(azimuth,0),remainder:formatNumber(360-azimuth,0)});
 const list=keys=>keys.map(key=>`<li>${tr(key)}</li>`).join('');
 $('craft').innerHTML=`<h2>${tr('craft.title')}</h2>
 <p class="mu">${tr('craft.materials',{size:2*R+6,length})}</p>
 <h3>${tr('craft.baseTitle')}</h3>
 <ol>${list(['craft.base1','craft.base2','craft.base3'])}</ol>
 <h3>${tr('craft.azimuthTitle')}</h3>
 <p>${tr('craft.azimuthIntro')}</p>
 <ol><li>${tr('craft.azimuth1')}</li><li>${tr('craft.azimuth2',{time:formatTime(event.t),azimuth:formatNumber(azimuth,0),direction})}</li>${list(['craft.azimuth3','craft.azimuth4'])}</ol>
 <h3>${tr('craft.distanceTitle')}</h3>
 <ol><li>${cup?tr('craft.distanceDome',{distance:formatNumber(event.r)}):tr('craft.distancePole',{radius:R})}</li><li>${tr('craft.distance2')}</li></ol>
 <h3>${tr('craft.heightTitle')}</h3>
 <ol><li>${tr('craft.height1',{height:formatNumber(event.h),horizon:event.h<0.05?tr('craft.horizon'):''})}</li><li>${tr('craft.height2')}</li><li>${tr('craft.height3',{elevation:formatNumber(event.e,0)})}</li></ol>
 <h2 class="reflection-title">${tr('craft.questionsTitle')}</h2>
 <ol>${list(['craft.question1','craft.question2','craft.question3','craft.question4','craft.question5','craft.question6'])}</ol>`;
}

function templateInput(){return{
 state:{events,radius:solarState.R,model:solarState.mode,latitude:solarState.lat,declination:solarState.dec,daylightAngle:solarState.H0,date:$('date').value},
 options:{paper:$('paper').value,cropCircle:$('crop-circle').checked,language:getLanguage()},
 helpers:{translate:tr,formatNumber,formatTime,citySummary:Array.isArray(CIUDADES)&&CIUDADES.length?ciudades(solarState.lat):tr('pdf.citiesUnavailable')}
}}
function tplUpdate(){const L=layoutTemplate(templateInput());
 $('crop-circle').disabled=solarState.mode!=='cupula';
 if(!L){$('tinfo').innerHTML=tr('pdf.noSun');$('tprev').innerHTML='';return}
 $('tinfo').innerHTML=tr('pdf.preview',{paper:L.pk,orientation:tr(L.land?'pdf.landscape':'pdf.portrait'),radius:formatNumber(L.Rc)})+(L.Rc<L.R0?tr('pdf.reduced',{radius:formatNumber(L.R0),factor:formatNumber(L.k,2)}):L.Rc>L.R0?tr('pdf.enlarged',{radius:formatNumber(L.R0),factor:formatNumber(L.k,2)}):tr('pdf.unchanged'))+($('crop-circle').checked&&solarState.mode==='cupula'?' · '+tr('pdf.cropNotice'):'')+tr('pdf.points');
 $('tprev').innerHTML=renderPdfPreviewSvg(L)}
$('paper').addEventListener('input',tplUpdate);
$('crop-circle').addEventListener('change',tplUpdate);
$('bpdf').addEventListener('click',()=>generatePDF(false));
$('bpdfo').addEventListener('click',()=>generatePDF(true));
function generatePDF(open){
 genPDF({open,template:templateInput(),latitude:solarState.lat,date:$('date').value,translate:tr});
}
$('tab').addEventListener('click',domEvent=>{const row=domEvent.target.closest('tr[data-i]');if(row){selectedIndex=+row.dataset.i;state.selectedIndex=selectedIndex;draw()}});
$('tab').addEventListener('keydown',domEvent=>{
 if((domEvent.key==='Enter'||domEvent.key===' ')&&domEvent.target.matches('tr[data-i]')){domEvent.preventDefault();domEvent.target.click()}
});
$('language').addEventListener('change',async domEvent=>{
 try{await switchLanguage(domEvent.target.value)}
 catch(error){
  console.error(error);
  $('language').value=getLanguage();
  $('status').textContent=getTranslation('language.loadError')||error.message;
  $('status').hidden=false;
 }
});
async function switchLanguage(language){
 await setLanguage(language);
 run(1);
}
$('theme').addEventListener('change',domEvent=>setTheme(domEvent.target.value));
$('rnd').addEventListener('click',()=>{
 clearTimeout(latitudeUpdateTimer);
 latitudeUpdateTimer=null;
 const year=new Date().getFullYear(),start=Date.UTC(year,0,1),days=(Date.UTC(year+1,0,1)-start)/864e5;
 $('lat').value=Math.floor(Math.random()*181)-90;
 $('date').value=new Date(start+Math.floor(Math.random()*days)*864e5).toISOString().slice(0,10);
 run(0);
});
$('lat').addEventListener('input',scheduleLatitudeUpdate);
$('lat').addEventListener('change',()=>{
 clearTimeout(latitudeUpdateTimer);
 latitudeUpdateTimer=null;
 run(0);
});
['date','R','mode','hmax'].forEach(i=>$(i).addEventListener('input',()=>run(0)));
document.querySelectorAll('#etg button').forEach((b,_,all)=>b.addEventListener('click',()=>{
 EV=b.dataset.v;
 state.earthView=EV;
 all.forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b))});
 earth();
}));
try{
 const savedTheme=localStorage.getItem('solar-theme');
 if(savedTheme==='light'||savedTheme==='dark')setTheme(savedTheme);
}catch(error){console.warn('Could not read saved theme preference.',error)}
setLanguage(getSavedLanguage()).then(()=>{
 run(1);
 fetch('ciudades.json').then(response=>{
  if(!response.ok)throw new Error(`Could not load ciudades.json (${response.status})`);
  return response.json();
 }).then(data=>{
  if(!Array.isArray(data))throw new Error('ciudades.json must contain an array');
  CIUDADES=data;state.cities=CIUDADES;updateCities();earth();
 }).catch(error=>{console.error(error);CIUDADES=[];state.cities=CIUDADES;updateCities();earth()});
}).catch(error=>{
 console.error(error);
 $('status').textContent=error.message;
 $('status').hidden=false;
});
 return{run,switchLanguage,generatePDF,state};
}

const state={
 events:[],
 solar:{},
 selectedIndex:0,
 cities:null,
 earthView:'sol'
};

const solarApp=createApp({state,modules:{astro,earthView,i18n,template,pdf}});

window.solarApp=solarApp;
window.runSolar=solarApp.run;
window.setSolarLanguage=solarApp.switchLanguage;
window.generateSolarPdf=solarApp.generatePDF;
