
const $=id=>document.getElementById(id),rad=Math.PI/180;
const f=(x,d=1)=>x.toFixed(d).replace('.',',');
const tf=t=>{let h=Math.floor(t),m=Math.round((t-h)*60);if(m==60){h++;m=0}return h+':'+String(m).padStart(2,'0')};
let E=[],S={},sel=0;
let CIUDADES=null; // se carga desde ciudades.json: [{"nombre":..., "lat":...}], ordenadas por fama
function ciudades(lat){
 const n=x=>Math.abs(Math.round(x))+'º '+(x>=0?'N':'S');
 if(CIUDADES===null)return '';
 if(!CIUDADES.length)return '(Lista de ciudades no disponible: abre la web desde GitHub Pages o un servidor local.)';
 const c=CIUDADES.filter(x=>Math.abs(x.lat-lat)<=1).slice(0,4).map(x=>x.nombre);
 if(c.length)return '🏙️ Ciudades a esta latitud (±1º): '+c.join(', ');
 if(lat<=-62)return '🧊 Deshabitado: Antártida y mares helados, solo hay bases científicas.';
 if(lat>=84)return '🧊 Deshabitado: océano Ártico helado.';
 const m=CIUDADES.reduce((a,b)=>Math.abs(b.lat-lat)<Math.abs(a.lat-lat)?b:a);
 if(Math.abs(m.lat-lat)<=3)return `🏙️ Sin ciudades a esta latitud exacta; la más cercana es ${m.nombre} (${n(m.lat)}).`;
 return '🌊 Deshabitado: no hay ciudades importantes a esta latitud (casi todo océano).';
}

function run(keep){
 const lat=+$('lat').value,R=+$('R').value,mode=$('mode').value,hmax=+$('hmax').value;
 const dt=new Date($('date').value+'T12:00:00Z');
 const N=Math.floor((dt-Date.UTC(dt.getUTCFullYear(),0,0))/864e5);
 const dec=23.44*Math.sin(360/365*(N-81)*rad);
 const sp=Math.sin(lat*rad),cp=Math.cos(lat*rad),sd=Math.sin(dec*rad),cd=Math.cos(dec*rad),td=Math.tan(dec*rad);
 const c=-Math.tan(lat*rad)*td;
 const H0=c>=1?0:c<=-1?180:Math.acos(c)/rad;
 const at=(t,z)=>{const H=15*(t-12),sH=Math.sin(H*rad),cH=Math.cos(H*rad);
  const se=z?0:Math.max(-1,Math.min(1,sp*sd+cp*cd*cH)),e=Math.asin(se)/rad;
  const A=(Math.atan2(sH,cH*sp-td*cp)/rad+540)%360;
  return{t,H,se,e,A,z}};
 E=[];
 for(let t=0;t<24;t++){const o=at(t);if(o.e>0.05)E.push(o)}
 if(H0>0&&H0<180){E.push(Object.assign(at(12-H0/15,1),{tag:'🌅 amanecer'}),Object.assign(at(12+H0/15,1),{tag:'🌇 atardecer'}))}
 E.sort((a,b)=>a.t-b.t);
 E.forEach(o=>{o.e0=o.e;o.A0=o.A;o.e=Math.round(o.e);o.A=Math.round(o.A)%360});
 E.forEach(o=>{const e=o.e*rad;
  if(mode=='cupula'){o.r=R*Math.cos(e);o.h=R*Math.sin(e)}
  else{o.r=R;o.h=R*Math.tan(e);o.cap=o.h>hmax;if(o.cap)o.h=hmax}});
 S={lat,R,mode,N,dec,sp,cp,sd,cd,H0,hmax};
 $('hmax').parentNode.style.display=mode=='poste'?'':'none';
 $('sum').innerHTML=!E.length?'🌑 Noche polar: el Sol no sale este día.':
  (H0==180?'☀️ Día polar: el Sol no se pone. ':'')+'Declinación solar: <b>'+f(dec)+'º</b> · Horas de luz: <b>'+f(H0/7.5)+' h</b>';
 earth();
 if(!keep||sel>=E.length){sel=0;E.forEach((o,i)=>{if(o.e>E[sel].e)sel=i})}
 draw();tplUpdate();
}
function draw(){
 if(!E.length){$('plan').innerHTML='';$('tab').innerHTML='';$('steps').innerHTML='';$('craft').innerHTML='';return}
 const R=S.R,V=R+3;let s=`<svg viewBox="${-V} ${-V} ${2*V} ${2*V}" font-size="${R/12}" text-anchor="middle">`;
 s+=`<circle r="${R}" fill="none" stroke="var(--ln)"/><circle r="${R/2}" fill="none" stroke="var(--ln)" stroke-dasharray="2 2"/>`;
 s+=`<path d="M${-R} 0H${R}M0 ${-R}V${R}" stroke="var(--ln)"/>`;
 [['N',0,-R-1],['S',0,R+1.8],['E',R+1.2,.4],['O',-R-1.2,.4]].forEach(a=>s+=`<text x="${a[1]}" y="${a[2]}" fill="var(--mu)" font-weight="700">${a[0]}</text>`);
 const P=E.map(o=>[o.r*Math.sin(o.A*rad),-o.r*Math.cos(o.A*rad)]);
 s+=`<polyline points="${P.map(p=>p.join(',')).join(' ')}" fill="none" stroke="var(--ac)" stroke-opacity=".5" stroke-dasharray="1 .6"/>`;
 E.forEach((o,i)=>{const [x,y]=P[i],k=o.z?'var(--bl)':'var(--ac)',lx=x*1.0+Math.sin(o.A*rad)*1.3,ly=y-Math.cos(o.A*rad)*1.3+.35;
  s+=`<circle cx="${x}" cy="${y}" r="${i==sel?.6:.4}" fill="${k}" stroke="${i==sel?'var(--fg)':'none'}" stroke-width=".15"/>`;
  s+=`<text x="${lx}" y="${ly}" fill="${k}">${o.z?(o.tag.slice(0,2)):Math.round(o.t)+'h'}</text>`});
 s+=`<circle r=".5" fill="var(--fg)"/><text y="1.6" fill="var(--mu)">👁 observador</text></svg>`;
 $('plan').innerHTML=s;
 let t='<table><tr><th style="text-align:left">Hora</th><th>Elev.</th><th>Azimut</th>'+(S.mode=='cupula'?'<th>Dist. (cm)</th>':'')+'<th>Palo (cm)</th></tr>';
 E.forEach((o,i)=>t+=`<tr data-i="${i}" class="${i==sel?'sel':''}"><td style="text-align:left">${tf(o.t)}${o.tag?' '+o.tag.slice(0,2):''}</td><td>${f(o.e,0)}º</td><td>${f(o.A,0)}º</td>${S.mode=='cupula'?'<td>'+f(o.r)+'</td>':''}<td>${f(o.h)}${o.cap?' ⚠️':''}</td></tr>`);
 $('tab').innerHTML=t+'</table><p class="mu noprint"><b>Horas solares, no del reloj.</b> <b>Ángulos redondeados al grado entero más cercano</b> (no se pueden dibujar décimas de grado); la altura y la distancia se calculan con esos ángulos redondeados y se dan en cm con un decimal. Pulsa una fila para ver el cálculo paso a paso.'+(E.some(o=>o.cap)?' ⚠️ = altura recortada: el ángulo real sería mayor.':'')+'</p>';
 steps();
}
function steps(){
 const o=E[sel],{lat,R,N,dec,sp,cp,sd,cd}=S,cA=Math.cos(o.A0*rad),den=Math.cos(o.e*rad)*cp;
 let h=`<b>Cálculo para las ${tf(o.t)} (hora solar)</b>
 <p><span class="k">1. Declinación</span> (cuánto se inclina la Tierra hoy). Hoy es el día ${N} del año:<br>δ = 23,44 · sen(360/365 · (${N} − 81)) = <b>${f(dec,2)}º</b></p>
 <p><span class="k">2. Ángulo horario.</span> La Tierra gira 15º cada hora y a las 12:00 el Sol está en el sur/norte:<br>H = 15 · (${f(o.t,2)} − 12) = <b>${f(o.H)}º</b></p>
 <p><span class="k">3. Elevación</span> (ángulo del Sol sobre el horizonte), con el teorema del coseno en la esfera:<br>sen(e) = sen(${lat}º)·sen(δ) + cos(${lat}º)·cos(δ)·cos(H) = ${f(sp,3)}·${f(sd,3)} + ${f(cp,3)}·${f(cd,3)}·${f(Math.cos(o.H*rad),3)} = ${f(o.se,3)}<br>e = ${f(o.e0)}º → redondeado al grado: <b>${f(o.e,0)}º</b></p>
 <p><span class="k">4. Azimut</span> (hacia dónde miras, desde el norte, en el sentido del reloj):<br>`+(den>1e-6?`cos(A) = (sen δ − sen e·sen φ) / (cos e·cos φ) = <b>${f(cA,3)}</b> → A = ${f(Math.acos(Math.max(-1,Math.min(1,cA)))/rad)}º${o.H>0?`; como ya es por la tarde, A = 360º − ${f(Math.acos(Math.max(-1,Math.min(1,cA)))/rad)}º`:''} = ${f(o.A0)}º → redondeado al grado: <b>${f(o.A,0)}º</b>`:`azimut no definido (el Sol está en el cénit o estás en un polo).`)+`</p>`;
 if(S.mode=='cupula')h+=`<p><span class="k">5. Posición del pompón.</span> Imagina una cúpula de radio R = ${R} cm. Usamos la elevación redondeada (${f(o.e,0)}º). El triángulo rectángulo tiene hipotenusa R:<br>altura del palo = R·sen(e) = ${R}·${f(Math.sin(o.e*rad),3)} = <b>${f(o.h)} cm</b><br>distancia al observador = R·cos(e) = ${R}·${f(Math.cos(o.e*rad),3)} = <b>${f(o.r)} cm</b>, en la dirección del azimut ${f(o.A,0)}º.</p>`;
 else h+=`<p><span class="k">5. Altura del palo.</span> Palo en el círculo (a R = ${R} cm), con la elevación redondeada (${f(o.e,0)}º). Triángulo rectángulo: tan(e) = altura / R<br>altura = R·tan(e) = ${R}·${f(Math.tan(o.e*rad),3)} = <b>${f(R*Math.tan(o.e*rad))} cm</b>${o.cap?` → supera el máximo, se usa ${S.hmax} cm ⚠️`:''}</p>`;
 $('steps').innerHTML=h;craft();
}

function earthSol(){
 const lat=+$('lat').value,d=S.dec,r=70,cx=95,cy=100,dr=d*rad;
 const P=(la,k=r,side=0)=>{const t=(side?Math.PI-la*rad:la*rad)-dr;return[cx+k*Math.cos(t),cy-k*Math.sin(t)]};
 let s=`<svg viewBox="0 0 260 200" font-size="9" fill="currentColor"><circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--day)" stroke="var(--mu)"/>`;
 s+=`<path d="M${cx} ${cy-r}A${r} ${r} 0 0 0 ${cx} ${cy+r}Z" fill="var(--night)"/>`;
 for(let k=-63;k<=63;k+=21)s+=`<line x1="225" y1="${cy-k}" x2="${cx+Math.sqrt(r*r-k*k)}" y2="${cy-k}" stroke="var(--ac)" stroke-opacity=".6"/>`;
 const L=(a,b,x,w=1)=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${x}" stroke-width="${w}"`;
 s+=L(P(90,r+10),P(-90,r+10),'var(--fg)',1.5)+'/>';
 s+=L(P(0),P(0,r,1),'var(--mu)')+'/>';
 [23.44,-23.44,66.56,-66.56].forEach(a=>s+=L(P(a),P(a,r,1),'var(--mu)')+' stroke-dasharray="3 3" stroke-opacity=".8"/>');
 const n=P(90,r+19),sp=P(-90,r+19);
 s+=`<text x="${n[0]}" y="${n[1]+3}" text-anchor="middle" font-weight="700">N</text><text x="${sp[0]}" y="${sp[1]+3}" text-anchor="middle" font-weight="700">S</text>`;
 s+=`<text x="${cx+30}" y="${cy+r+22}" text-anchor="middle" fill="var(--mu)">día</text><text x="${cx-30}" y="${cy+r+22}" text-anchor="middle" fill="var(--mu)">noche</text>`;
 const th=lat*rad-dr,[ax,ay]=P(lat),[ox,oy]=P(lat,r+12);
 if(Math.cos(th)>0)s+=L([225,ay],[ax,ay],'var(--ac)',1.6)+'/>';
 s+=L([ax-14*Math.sin(th),ay-14*Math.cos(th)],[ax+14*Math.sin(th),ay+14*Math.cos(th)],'var(--bl)',1.4)+'/>';
 s+=`<circle cx="${ax}" cy="${ay}" r="2.5" fill="var(--bl)"/><text x="${ox}" y="${oy+5}" font-size="15" text-anchor="middle">🧍</text>`;
 s+=`<text x="242" y="${cy+8}" font-size="24" text-anchor="middle">☀️</text><text x="242" y="${cy+24}" text-anchor="middle" fill="var(--mu)">Sol (fijo)</text></svg>`;
 const em=90-Math.abs(lat-d),tilt=Math.abs(d)<1?'El eje no se inclina ni hacia el Sol ni en contra (equinoccio).':`El polo norte está inclinado ${f(Math.abs(d))}º ${d>0?'hacia el':'en sentido contrario al'} Sol.`;
 $('earth').innerHTML=s+`<div class="mu"><b>El Sol y sus rayos no se mueven.</b> Lo que cambia a lo largo del año es la inclinación del eje de la Tierra respecto al Sol, por el movimiento de traslación. ${tilt} Hoy el Sol está en la vertical en la latitud <b>${f(d)}º</b>. Línea discontinua: trópicos y círculos polares. Arrastra al 🧍 para elegir la latitud: <b>${Math.abs(lat)}º ${lat>=0?'N':'S'}</b> · ${em>0?`elevación del Sol al mediodía: <b>${f(em,0)}º</b>`:'el Sol no sale (noche polar)'}.</div><div class="mu">${ciudades(lat)}</div>`;
}
let EV='sol';
function earth(){EV=='sol'?earthSol():earthTierra()}
function earthTierra(){
 const lat=+$('lat').value,d=S.dec,r=70,cx=70,cy=100,sx=Math.cos(d*rad),sy=Math.sin(d*rad);
 const P=(a,k=r)=>[cx+k*Math.cos(a*rad),cy-k*Math.sin(a*rad)];
 let s=`<svg viewBox="0 0 260 200" font-size="9" fill="currentColor"><path d="M${cx} ${cy-r}A${r} ${r} 0 0 1 ${cx} ${cy+r}Z" fill="var(--day)" stroke="var(--mu)"/>`;
 for(let k=-63;k<=63;k+=21){const m=Math.sqrt(r*r-k*k),px=-sy*k+m*sx,py=sx*k+m*sy;
  s+=`<line x1="${cx+px+140*sx}" y1="${cy-py-140*sy}" x2="${cx+px}" y2="${cy-py}" stroke="var(--ac)" stroke-opacity=".6"/>`}
 s+=`<line x1="${cx}" y1="${cy-r-8}" x2="${cx}" y2="${cy+r+8}" stroke="var(--fg)" stroke-width="1.5"/><line x1="${cx}" y1="${cy}" x2="${cx+r}" y2="${cy}" stroke="var(--mu)"/>`;
 [23.44,-23.44,66.56,-66.56].forEach(a=>{const q=P(a);s+=`<line x1="${cx}" y1="${q[1]}" x2="${q[0]}" y2="${q[1]}" stroke="var(--mu)" stroke-dasharray="3 3" stroke-opacity=".8"/>`});
 s+=`<text x="${cx}" y="${cy-r-11}" text-anchor="middle" font-weight="700">N</text><text x="${cx}" y="${cy+r+19}" text-anchor="middle" font-weight="700">S</text>`;
 const th=lat*rad,[ax,ay]=P(lat),[ox,oy]=P(lat,r+12);
 if(Math.cos(th-d*rad)>0)s+=`<line x1="${ax}" y1="${ay}" x2="${ax+140*sx}" y2="${ay-140*sy}" stroke="var(--ac)" stroke-width="1.6"/>`;
 s+=`<line x1="${ax-14*Math.sin(th)}" y1="${ay-14*Math.cos(th)}" x2="${ax+14*Math.sin(th)}" y2="${ay+14*Math.cos(th)}" stroke="var(--bl)" stroke-width="1.4"/>`;
 s+=`<circle cx="${ax}" cy="${ay}" r="2.5" fill="var(--bl)"/><text x="${ox}" y="${oy+5}" font-size="15" text-anchor="middle">🧍</text>`;
 s+=`<text x="${cx+160*sx}" y="${cy-160*sy+8}" font-size="24" text-anchor="middle">☀️</text></svg>`;
 const em=90-Math.abs(lat-d);
 $('earth').innerHTML=s+`<div class="mu"><b>Vista desde la Tierra:</b> aquí la Tierra se dibuja con el eje vertical, así que parece que el Sol sube o baja a lo largo del año (hoy está en la vertical en la latitud <b>${f(d)}º</b>, la declinación). En realidad el Sol no se mueve: es la inclinación del eje de la Tierra respecto al Sol, por la traslación, la que cambia (mira la otra vista). Línea discontinua: trópicos y círculos polares. Arrastra al 🧍 para elegir la latitud: <b>${Math.abs(lat)}º ${lat>=0?'N':'S'}</b> · ${em>0?`elevación del Sol al mediodía: <b>${f(em,0)}º</b>`:'el Sol no sale (noche polar)'}.</div><div class="mu">${ciudades(lat)}</div>`;
}
document.querySelectorAll('#etg button').forEach((b,_,all)=>b.addEventListener('click',()=>{EV=b.dataset.v;all.forEach(x=>x.classList.toggle('on',x===b));earth()}));
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
 const ang=A<=180?`${f(A,0)}º hacia la <b>derecha</b> (hacia el Este)`:`${f(360-A,0)}º hacia la <b>izquierda</b> (hacia el Oeste), porque el transportador solo llega a 180º y ${f(A,0)}º = 360º − ${f(360-A,0)}º`;
 $('craft').innerHTML=`<h2>🛠️ Paso a paso: construye tu maqueta</h2>
 <p class="mu"><b>Materiales:</b> base de cartón o madera (mínimo ${2*R+6} cm de lado), regla, compás, transportador, escuadra, lápiz, palillos o brochetas finas (de al menos ${L} cm), plastilina o pegamento, pompones amarillos, una figurita de observador y papel para etiquetas.</p>
 <h3>1. Dibuja la base</h3>
 <ol><li>Marca el centro de la base: ahí va el observador.</li>
 <li>Con el compás traza un círculo de <b>radio ${R} cm</b>.</li>
 <li>Dibuja una línea vertical que pase por el centro y márcala <b>N</b> arriba y <b>S</b> abajo. Cruza otra horizontal: <b>E</b> a la derecha y <b>O</b> a la izquierda (como en un mapa).</li></ol>
 <h3>2. Dibuja el azimut de cada hora con el transportador</h3>
 <p>El azimut se cuenta desde el <b>Norte (0º)</b> girando como las agujas del reloj: Este = 90º, Sur = 180º, Oeste = 270º.</p>
 <ol><li>Pon el centro del transportador sobre el observador y su 0º sobre la línea del Norte.</li>
 <li>Mira en la tabla el azimut de la hora. <i>Ejemplo con la fila seleccionada (${tf(o.t)}): azimut ${f(A,0)}º → cuenta ${ang}.</i></li>
 <li>Haz una marca y traza una línea fina desde el centro hacia ella. Escribe la hora junto a la línea.</li>
 <li>Repite con todas las filas de la tabla. El amanecer y el atardecer quedan entre dos horas enteras.</li></ol>
 <h3>3. Mide la distancia y coloca el palo</h3>
 <ol>${cup?`<li>Sobre cada línea, mide con la regla desde el centro la <b>distancia</b> de la tabla (en la fila seleccionada: <b>${f(o.r)} cm</b>) y marca un punto. Así los palos no estarán en el borde, sino formando la trayectoria del Sol.</li>`:`<li>Todos los palos van sobre el borde del círculo, a ${R} cm del centro, donde la línea de cada hora corta el círculo.</li>`}
 <li>Clava el palo en ese punto con plastilina y colócalo bien vertical con la escuadra.</li></ol>
 <h3>4. Mide la altura y coloca el Sol</h3>
 <ol><li>Mide con la regla la <b>altura</b> desde la base hasta la punta (fila seleccionada: <b>${f(o.h)} cm</b>${o.h<0.05?': el Sol está justo en el horizonte, el pompón se apoya en el suelo':''}).</li>
 <li>Marca esa altura en el palo, córtalo y pega en la punta un pompón amarillo.</li>
 <li><b>Comprueba:</b> tensa un hilo desde la base del observador hasta el pompón. El ángulo que forma con la base debe ser la elevación de la tabla (${f(o.e,0)}º): mídelo con el transportador.</li></ol>
 <h2 style="margin-top:18px">🤔 Para pensar</h2>
 <ol><li>Pon la latitud en 0º y compara con 60º N en la misma fecha. ¿Cuánto dura el día y qué altura alcanza el Sol al mediodía en cada caso?</li>
 <li>Con 40º N, compara el 21 de junio y el 21 de diciembre: ¿qué cambia en las horas de luz, en el punto por donde sale el Sol y en su altura máxima? ¿Por qué el verano es más cálido?</li>
 <li>Prueba 80º N en junio y en diciembre. ¿Qué ocurre? ¿Por qué hay días y noches de varios meses en los polos?</li>
 <li>Cuando el Sol está bajo, los rayos llegan inclinados. Imagina una linterna sobre una mesa: ¿qué pasa con la misma luz si la inclinas? ¿Qué relación tiene con el frío cerca de los polos?</li>
 <li>¿En qué latitudes puede el Sol estar justo sobre nuestra cabeza? ¿Y por qué nunca ocurre en España?</li>
 <li>¿Hacia dónde queda el Sol al mediodía en el hemisferio norte? ¿Y en el hemisferio sur? ¿Y entre los trópicos?</li></ol>`;
}

const PAPEL={A4:[210,297],A3:[297,420]};
function lines(o,k){return [tf(o.t)].concat(o.z?[o.tag.split(' ')[1]]:[],[f(o.h*k)+' cm'+(o.cap?'*':'')])}
function lbl(o,x,y,k,v=0){const L=lines(o,k),w=Math.max(...L.map(t=>t.length))*1.5+1,h=L.length*3.3,u0=Math.sin(o.A*rad),v0=-Math.cos(o.A*rad),[ux,uy]=[[u0,v0],[-u0,-v0],[-v0,u0],[v0,-u0]][v],lx=x+ux*2.8,ly=y+uy*2.8,an=ux>.35?'start':ux<-.35?'end':'middle',bx=an=='start'?lx:an=='end'?lx-w:lx-w/2,by=uy<-.5?ly-h:uy>.5?ly:ly-h/2;return{L,an,tx:lx,ty:by+2.4,box:[bx,by,bx+w,by+h]}}
function mk(){
 if(!E.length)return null;
 const pk=$('paper').value,[pa,pb]=PAPEL[pk],R0=S.R,cup=S.mode=='cupula',n=E.length,m=10,hh=24,rh=4.2,cw=78;
 const an=E.map(o=>o.A).sort((x,y)=>x-y);let mi=0,G=-1;
 an.forEach((x,i)=>{const g=i<an.length-1?an[i+1]-x:an[0]+360-x;if(g>G){G=g;mi=i}});
 const full=G<70,a0=full?0:an[(mi+1)%an.length]-12,len=full?360:360-G+24,ia=a=>full||((a-a0+720)%360)<=len,gc=full?Math.PI:(an[mi]+G/2)*rad;
 const CARD=[['N',0],['E',90],['S',180],['O',270]];
 // Ocupación del dibujo (relativa al observador): puntos de muestra, cajas y caja envolvente
 const occ=(Rm,k)=>{const pts=[],bx=[];let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  const ad=(x,y)=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)};
  const ab=b=>{bx.push(b);ad(b[0],b[1]);ad(b[2],b[3])};
  for(let q=0;q<=len;q+=2){const t=(a0+q)*rad,x=Rm*Math.sin(t),y=-Rm*Math.cos(t);pts.push([x,y]);ad(x,y)}
  E.forEach(o=>{const rr=o.r/R0*Rm,sx=Math.sin(o.A*rad),sy=-Math.cos(o.A*rad),x=rr*sx,y=rr*sy;
   for(let d=0;d<=rr;d+=4)pts.push([d*sx,d*sy]);ad(x,y);ab(lbl(o,x,y,k).box)});
  ab([-5,-5,5,5]);ab([8*Math.sin(gc)-8,-8*Math.cos(gc)-4,8*Math.sin(gc)+8,-8*Math.cos(gc)+2]);
  CARD.forEach(([nm,a])=>{if(ia(a)){const x=(Rm+6)*Math.sin(a*rad),y=-(Rm+6)*Math.cos(a*rad);ab([x-3.5,y-3.5,x+3.5,y+3.5])}});
  return{pts,bx,bb:[x0-3,y0-3,x1+3,y1+3]}};
 const hit=(r,O,ox,oy)=>{for(const q of O.pts){const x=q[0]+ox,y=q[1]+oy;if(x>r[0]&&x<r[2]&&y>r[1]&&y<r[3])return 1}
  for(const b of O.bx)if(b[0]+ox<r[2]&&b[2]+ox>r[0]&&b[1]+oy<r[3]&&b[3]+oy>r[1])return 1;return 0};
 // Coloca dibujo y tabla (en una esquina libre) para un radio dado
 const place=(W,H,cols,Rm,k,force)=>{const O=occ(Rm,k),bb=O.bb,bw=bb[2]-bb[0],bh=bb[3]-bb[1],aw=W-2*m,ay=m+hh,ah=H-m-ay;
  if(bw>aw||bh>ah)return null;
  const rc=Math.ceil(n/cols),tw=cols*cw+(cols-1)*6,th=(rc+1)*rh;
  for(const fy of[1,.5,0])for(const fx of[.5,0,1]){const ox=m+fx*(aw-bw)-bb[0],oy=ay+fy*(ah-bh)-bb[1];
   for(const [rt,bt] of[[1,0],[0,0],[1,1],[0,1]]){const tx=rt?W-m-tw:m,ty=bt?H-m-th:((rt&&tx>=m+150)?m+9:ay);
    if(force||!hit([tx-3,ty-3,tx+tw+3,ty+th+3],O,ox,oy))return{ox,oy,tx,ty,cols,rc}}}
  return null};
 let best=null;
 [0,1].forEach(land=>[1,2,3].forEach(cols=>{const W=land?pb:pa,H=land?pa:pb;
  const fe=Rm=>place(W,H,cols,Rm,1);let lo=15,hi=pk=='A3'?400:R0*10,Rm;
  if(fe(hi))Rm=hi;else if(!fe(lo))return;else{for(let i=0;i<28;i++){const mid=(lo+hi)/2;fe(mid)?lo=mid:hi=mid}Rm=lo}
  const Rc=Math.max(3,Math.floor(Rm/10*2)/2);if(!best||Rc>best.Rc)best={W,H,land,cols,Rc}}));
 if(!best)best={W:pa,H:pb,land:0,cols:2,Rc:3};
 let {W,H,land,cols,Rc}=best,pl;
 while(Rc>3&&!(pl=place(W,H,cols,Rc*10,Rc/R0)))Rc-=.5;
 if(!pl)pl=place(W,H,cols,Rc*10,Rc/R0,1);
 if(!pl){Rc=3;pl=place(W,H,cols,30,3/R0,1)}
 const k=Rc/R0,Rm=Rc*10,{ox,oy,rc}=pl;
 const P=[],BK=[0,0,0],G1=[140,140,140],G2=[165,165,165];
 const T=(x,y,s,pt,c,al='start',b=0)=>P.push({k:'t',x,y,s,pt,c,an:al,b});
 const dateTxt=new Date($('date').value+'T12:00:00Z').toLocaleDateString('es-ES',{day:'numeric',month:'long',timeZone:'UTC'});
 T(m,m+5,`Maqueta solar - Latitud ${Math.abs(S.lat)}º ${S.lat>=0?'N':'S'} - ${dateTxt}`,13,G1,'start',1);
 T(m,m+11,`Declinación ${f(S.dec)}º | Radio de la plantilla R = ${f(Rc)} cm${Rc<R0?` (reducido desde ${f(R0)} cm)`:Rc>R0?` (ampliado desde ${f(R0)} cm)`:''} | Modelo ${cup?'cúpula':'poste'} | Papel ${pk}`,8,G1);
 T(m,m+21,'Horas SOLARES, no del reloj: en España el reloj va adelantado ~1 h en invierno y ~2 h en verano.',8,G1,'start',1);
 T(m,m+16,`Pega en cada punto un palo vertical con la altura (cm) escrita junto a él y un pompón amarillo en la punta.${E.some(o=>o.cap)?' * Altura recortada.':''}`,8,G1);
 P.push({k:'l',x1:W-m-50,y1:m+3,x2:W-m,y2:m+3,c:G1,w:.4});T(W-m,m+7,'Comprobación: esta línea mide 5 cm',6.5,G1,'end');
 const rowsT=(x0,y0,list)=>{const X=cup?[0,33,49,63,78]:[0,33,49,0,63];
  T(x0+X[0],y0,'Hora',7.5,G1,'start',1);T(x0+X[1],y0,'Elev.',7.5,G1,'end',1);T(x0+X[2],y0,'Azim.',7.5,G1,'end',1);if(cup)T(x0+X[3],y0,'Dist. cm',7.5,G1,'end',1);T(x0+X[4],y0,'Altura cm',7.5,G1,'end',1);
  list.forEach((o,j)=>{const y=y0+(j+1)*rh;T(x0+X[0],y,tf(o.t)+(o.z?' '+o.tag.split(' ')[1]:''),7.5,G2);T(x0+X[1],y,f(o.e,0)+'º',7.5,G2,'end');T(x0+X[2],y,f(o.A,0)+'º',7.5,G2,'end');if(cup)T(x0+X[3],y,f(o.r*k),7.5,G2,'end');T(x0+X[4],y,f(o.h*k)+(o.cap?'*':''),7.5,G2,'end')})};
 for(let c=0;c<pl.cols;c++)rowsT(pl.tx+c*(cw+6),pl.ty+3,E.slice(c*rc,(c+1)*rc));
 const arc=[];for(let q=0;q<=len;q++){const t=(a0+q)*rad;arc.push([ox+Rm*Math.sin(t),oy-Rm*Math.cos(t)])}
 P.push({k:'p',pts:arc,c:BK,w:.4});
 CARD.forEach(([nm,a])=>{if(ia(a)){const s_=Math.sin(a*rad),c_=-Math.cos(a*rad);
  P.push({k:'l',x1:ox+(Rm-2)*s_,y1:oy+(Rm-2)*c_,x2:ox+(Rm+2)*s_,y2:oy+(Rm+2)*c_,c:BK,w:.4});T(ox+(Rm+6)*s_,oy+(Rm+6)*c_+1.3,nm,10,BK,'middle',1)}});
 const hit2=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
 const pos=E.map(o=>{const rr=o.r*k*10;return[ox+rr*Math.sin(o.A*rad),oy-rr*Math.cos(o.A*rad)]});
 const placed=pos.map(q=>[q[0]-1.8,q[1]-1.8,q[0]+1.8,q[1]+1.8]);placed.push([ox-5,oy-5,ox+5,oy+5]);
 CARD.forEach(([nm,a])=>{if(ia(a)){const x=ox+(Rm+6)*Math.sin(a*rad),y=oy-(Rm+6)*Math.cos(a*rad);placed.push([x-3.5,y-3.5,x+3.5,y+3.5])}});
 const LB=[];
 E.forEach((o,i)=>{const [x,y]=pos[i];
  P.push({k:'l',x1:ox,y1:oy,x2:x,y2:y,c:BK,w:.12});P.push({k:'c',x,y,r:1.1,c:BK,fill:1});
  let l,bx;for(let v=0;v<4;v++){l=lbl(o,x-ox,y-oy,k,v);bx=[l.box[0]+ox,l.box[1]+oy,l.box[2]+ox,l.box[3]+oy];if(!placed.some(q=>hit2(q,bx)))break;if(v==3){l=lbl(o,x-ox,y-oy,k,0);bx=[l.box[0]+ox,l.box[1]+oy,l.box[2]+ox,l.box[3]+oy]}}
  placed.push(bx);LB.push({k:'r',x:bx[0]-.3,y:bx[1]-.2,w:bx[2]-bx[0]+.6,h:bx[3]-bx[1]+.4,c:[255,255,255]});
  l.L.forEach((t,j)=>LB.push({k:'t',x:ox+l.tx,y:oy+l.ty+j*3.3,s:t,pt:8,c:BK,an:l.an,b:j==l.L.length-1?1:0}))});
 P.push(...LB);
 P.push({k:'c',x:ox,y:oy,r:2.5,c:BK,w:.5});P.push({k:'l',x1:ox-4,y1:oy,x2:ox+4,y2:oy,c:BK,w:.3});P.push({k:'l',x1:ox,y1:oy-4,x2:ox,y2:oy+4,c:BK,w:.3});
 T(ox+8*Math.sin(gc),oy-8*Math.cos(gc)+1.2,'Observador',7,BK,'middle');
 return{P,W,H,land,Rc,k,R0,pk}}
function svgOf(L){const g=c=>`rgb(${c.join(',')})`;let s=`<svg viewBox="0 0 ${L.W} ${L.H}" xmlns="http://www.w3.org/2000/svg"><rect width="${L.W}" height="${L.H}" fill="#fff"/>`;
 L.P.forEach(p=>{if(p.k=='t')s+=`<text x="${p.x}" y="${p.y}" font-size="${p.pt*.3528}" fill="${g(p.c)}" text-anchor="${p.an}" font-family="Helvetica,Arial,sans-serif"${p.b?' font-weight="700"':''}>${p.s}</text>`;
  else if(p.k=='r')s+=`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${g(p.c)}"/>`;
  else if(p.k=='l')s+=`<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${g(p.c)}" stroke-width="${p.w}"/>`;
  else if(p.k=='p')s+=`<polyline points="${p.pts.map(q=>q.join(',')).join(' ')}" fill="none" stroke="${g(p.c)}" stroke-width="${p.w}"/>`;
  else s+=`<circle cx="${p.x}" cy="${p.y}" r="${p.r}" ${p.fill?`fill="${g(p.c)}"`:`fill="none" stroke="${g(p.c)}" stroke-width="${p.w}"`}/>`});
 return s+'</svg>'}
function tplUpdate(){const L=mk();
 if(!L){$('tinfo').innerHTML='☁️ Este día no hay Sol: no hay plantilla que generar.';$('tprev').innerHTML='';return}
 $('tinfo').innerHTML=`Papel ${L.pk} ${L.land?'horizontal':'vertical'} · radio de la plantilla <b>${f(L.Rc)} cm</b>`+(L.Rc<L.R0?` (reducido desde ${f(L.R0)} cm para que quepa; distancias y alturas de la tabla recalculadas con factor ${f(L.k,2)})`:L.Rc>L.R0?` (ampliado desde ${f(L.R0)} cm para aprovechar el A3; distancias y alturas recalculadas con factor ${f(L.k,2)})`:' (sin cambios)')+'. Los puntos ya están en su posición: solo hay que pegar los palos.';
 $('tprev').innerHTML=svgOf(L)}
function genPDF(open){const L=mk();if(!L)return;const J=window.jspdf&&window.jspdf.jsPDF;
 if(!J){alert('No se pudo cargar la librería jsPDF (¿sin conexión?).');return}
 const d=new J({unit:'mm',format:[L.W,L.H],orientation:L.W>L.H?'l':'p'}),AL={start:'left',end:'right',middle:'center'};
 L.P.forEach(p=>{if(p.k=='t'){d.setFont('helvetica',p.b?'bold':'normal');d.setFontSize(p.pt);d.setTextColor(...p.c);d.text(p.s,p.x,p.y,{align:AL[p.an]})}
  else if(p.k=='r'){d.setFillColor(...p.c);d.rect(p.x,p.y,p.w,p.h,'F')}
  else if(p.k=='l'){d.setDrawColor(...p.c);d.setLineWidth(p.w);d.line(p.x1,p.y1,p.x2,p.y2)}
  else if(p.k=='p'){d.setDrawColor(...p.c);d.setLineWidth(p.w);for(let i=1;i<p.pts.length;i++)d.line(p.pts[i-1][0],p.pts[i-1][1],p.pts[i][0],p.pts[i][1])}
  else{d.setDrawColor(...p.c);d.setFillColor(...p.c);d.setLineWidth(p.w||.2);d.circle(p.x,p.y,p.r,p.fill?'F':'S')}});
 if(open)window.open(d.output('bloburl'),'_blank');else d.save(`plantilla-solar_lat${S.lat}_${$('date').value}.pdf`)}
$('paper').addEventListener('input',tplUpdate);
$('bpdf').addEventListener('click',()=>genPDF(0));$('bpdfo').addEventListener('click',()=>genPDF(1));
$('tab').addEventListener('click',e=>{const r=e.target.closest('tr[data-i]');if(r){sel=+r.dataset.i;draw()}});
$('rnd').addEventListener('click',()=>{
 const year=new Date().getFullYear(),start=Date.UTC(year,0,1),days=(Date.UTC(year+1,0,1)-start)/864e5;
 $('lat').value=Math.floor(Math.random()*181)-90;
 $('date').value=new Date(start+Math.floor(Math.random()*days)*864e5).toISOString().slice(0,10);
 run(0);
});
['lat','date','R','mode','hmax'].forEach(i=>$(i).addEventListener('input',()=>run(0)));
run(0);
fetch('ciudades.json').then(r=>r.json()).then(d=>{CIUDADES=d;earth()}).catch(()=>{CIUDADES=[];earth()});
