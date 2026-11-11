import {AXIAL_TILT,POLAR_CIRCLE_OFFSET} from './astro.js';

const DEG_TO_RAD=Math.PI/180;
const TILT_LATITUDES=[AXIAL_TILT,-AXIAL_TILT,POLAR_CIRCLE_OFFSET,-POLAR_CIRCLE_OFFSET];
const GRID_OFFSETS=[-63,-42,-21,0,21,42,63];

function renderLatitudeGrid(lines) {
 return lines.map(([start,end])=>`<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="var(--ac)" stroke-opacity=".6"/>`).join('');
}

function renderSunPath(lines) {
 return lines.map(([start,end])=>`<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="var(--ac)" stroke-width="1.6"/>`).join('');
}

function renderTiltLines(projectLatitude) {
 return TILT_LATITUDES.map(latitude=>{
  const [start,end]=projectLatitude(latitude);
  return`<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="var(--mu)" stroke-dasharray="3 3" stroke-opacity=".8"/>`;
 }).join('');
}

function renderObserverMarker({x,y,latitudeAngle}) {
 const dx=14*Math.sin(latitudeAngle),dy=14*Math.cos(latitudeAngle);
 return`<line x1="${x-dx}" y1="${y-dy}" x2="${x+dx}" y2="${y+dy}" stroke="var(--bl)" stroke-width="1.4"/>`+
  `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--bl)" stroke="var(--bg)" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="6" fill="none" stroke="var(--bl)" stroke-opacity=".5"/>`;
}

function renderBase({latitudeGrid,sunPath,tiltLines,referenceLines,observerMarker}) {
 return renderLatitudeGrid(latitudeGrid)+referenceLines+renderTiltLines(tiltLines)+renderSunPath(sunPath)+observerMarker;
}

function renderSvg(content) {
 return`<svg viewBox="0 0 260 200" font-size="9" fill="currentColor" role="img" aria-label="${content.translate('earth.section')}"><title>${content.translate('earth.section')}</title>${content.markup}</svg>`;
}

function renderElevation(latitude,declination,{translate,formatNumber},kind) {
 const elevation=90-Math.abs(latitude-declination);
 const sunElevation=elevation>0?translate('earth.elevation',{value:formatNumber(elevation,0)}):translate('earth.noSun');
 if(kind==='sol'){
  const tilt=Math.abs(declination)<1?translate('earth.solarAxisStill'):
   translate('earth.axisTilt',{degrees:formatNumber(Math.abs(declination)),direction:translate(declination>0?'earth.axisToward':'earth.axisAway')+' '});
  return translate('earth.solIntro',{tilt,declination:formatNumber(declination),latitude:Math.abs(latitude),hemisphere:latitude>=0?'N':'S',elevation:sunElevation},['elevation']);
 }
 return translate('earth.tierraIntro',{declination:formatNumber(declination),latitude:Math.abs(latitude),hemisphere:latitude>=0?'N':'S',elevation:sunElevation},['elevation']);
}

export function renderEarthSol({latitude,declination,helpers}) {
 const radius=70,cx=95,cy=100,declinationRad=declination*DEG_TO_RAD;
 const project=(angle,scale=radius,side=0)=>{
  const theta=(side?Math.PI-angle*DEG_TO_RAD:angle*DEG_TO_RAD)-declinationRad;
  return[cx+scale*Math.cos(theta),cy-scale*Math.sin(theta)];
 };
 let markup=`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="var(--day)" stroke="var(--mu)"/>`;
 markup+=`<path d="M${cx} ${cy-radius}A${radius} ${radius} 0 0 0 ${cx} ${cy+radius}Z" fill="var(--night)"/>`;
 const latitudeGrid=GRID_OFFSETS.map(offset=>[[225,cy-offset],[cx+Math.sqrt(radius*radius-offset*offset),cy-offset]]);
 const axis=`<line x1="${project(90,radius+10)[0]}" y1="${project(90,radius+10)[1]}" x2="${project(-90,radius+10)[0]}" y2="${project(-90,radius+10)[1]}" stroke="var(--fg)" stroke-width="1.5"/>`;
 const equator=`<line x1="${project(0)[0]}" y1="${project(0)[1]}" x2="${project(0,radius,1)[0]}" y2="${project(0,radius,1)[1]}" stroke="var(--mu)"/>`;
 const referenceLines=axis+equator;
 const tiltLines=angle=>[project(angle),project(angle,radius,1)];
 const latitudeAngle=latitude*DEG_TO_RAD-declinationRad,[observerX,observerY]=project(latitude);
 const sunPath=Math.cos(latitudeAngle)>0?[[[225,observerY],[observerX,observerY]]]:[];
 const observerMarker=renderObserverMarker({x:observerX,y:observerY,latitudeAngle});
 markup+=renderBase({latitudeGrid,sunPath,tiltLines,referenceLines,observerMarker});
 const north=project(90,radius+19),south=project(-90,radius+19);
 markup+=`<text x="${north[0]}" y="${north[1]+3}" text-anchor="middle" font-weight="700">N</text><text x="${south[0]}" y="${south[1]+3}" text-anchor="middle" font-weight="700">S</text>`;
 markup+=`<text x="${cx+30}" y="${cy+radius+22}" text-anchor="middle" fill="var(--mu)">${helpers.translate('svg.day')}</text><text x="${cx-30}" y="${cy+radius+22}" text-anchor="middle" fill="var(--mu)">${helpers.translate('svg.night')}</text>`;
 markup+=`<circle cx="242" cy="${cy+5}" r="8" fill="var(--day)"/><g stroke="var(--day)" stroke-width="1.5"><path d="M242 ${cy-8}v-5m0 36v-5m-13-13h-5m36 0h-5m-22-9-4-4m26 26-4-4m0-18 4-4m-26 26 4-4"/></g><text x="242" y="${cy+24}" text-anchor="middle" fill="var(--mu)">${helpers.translate('svg.fixedSun')}</text>`;
 const svg=renderSvg({markup,translate:helpers.translate});
 return svg+`<div class="mu">${renderElevation(latitude,declination,helpers,'sol')}</div>`;
}

export function renderEarthTierra({latitude,declination,helpers}) {
 const radius=70,cx=70,cy=100,declinationRad=declination*DEG_TO_RAD;
 const sinDeclination=Math.sin(declinationRad),cosDeclination=Math.cos(declinationRad);
 const project=(angle,scale=radius)=>[cx+scale*Math.cos(angle*DEG_TO_RAD),cy-scale*Math.sin(angle*DEG_TO_RAD)];
 const dayStart=[cx-radius*sinDeclination,cy-radius*cosDeclination],dayEnd=[cx+radius*sinDeclination,cy+radius*cosDeclination];
 let markup=`<path d="M${dayStart[0]} ${dayStart[1]}A${radius} ${radius} 0 0 1 ${dayEnd[0]} ${dayEnd[1]}Z" fill="var(--day)" stroke="var(--mu)"/>`;
 const latitudeGrid=GRID_OFFSETS.map(offset=>{
  const halfChord=Math.sqrt(radius*radius-offset*offset),px=-sinDeclination*offset+halfChord*cosDeclination,py=cosDeclination*offset+halfChord*sinDeclination;
  return[[cx+px+140*cosDeclination,cy-py-140*sinDeclination],[cx+px,cy-py]];
 });
 const referenceLines=`<line x1="${cx}" y1="${cy-radius-8}" x2="${cx}" y2="${cy+radius+8}" stroke="var(--fg)" stroke-width="1.5"/><line x1="${cx}" y1="${cy}" x2="${cx+radius}" y2="${cy}" stroke="var(--mu)"/>`;
 const tiltLines=angle=>[[cx,cy],project(angle)];
 const latitudeAngle=latitude*DEG_TO_RAD,[observerX,observerY]=project(latitude);
 const sunPath=Math.cos(latitudeAngle-declinationRad)>0?[[[observerX,observerY],[observerX+140*cosDeclination,observerY-140*sinDeclination]]]:[];
 const observerMarker=renderObserverMarker({x:observerX,y:observerY,latitudeAngle});
 markup+=renderBase({latitudeGrid,sunPath,tiltLines,referenceLines,observerMarker});
 markup+=`<text x="${cx}" y="${cy-radius-11}" text-anchor="middle" font-weight="700">N</text><text x="${cx}" y="${cy+radius+19}" text-anchor="middle" font-weight="700">S</text>`;
 const sunX=cx+160*cosDeclination,sunY=cy-160*sinDeclination;
 markup+=`<circle cx="${sunX}" cy="${sunY}" r="8" fill="var(--day)"/><g stroke="var(--day)" stroke-width="1.5"><path d="M${sunX} ${sunY-13}v-5m0 36v-5m-13-13h-5m36 0h-5m-22-9-4-4m26 26-4-4m0-18 4-4m-26 26 4-4"/></g>`;
 const svg=renderSvg({markup,translate:helpers.translate});
 return svg+`<div class="mu">${renderElevation(latitude,declination,helpers,'tierra')}</div>`;
}
