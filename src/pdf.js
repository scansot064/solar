import {layoutTemplate} from './template.js';

function escapeHtml(value) {
 return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

export function renderPdfPreviewSvg(layout) {
 const color=value=>`rgb(${value.join(',')})`;
 let svg=`<svg viewBox="0 0 ${layout.W} ${layout.H}" xmlns="http://www.w3.org/2000/svg"><rect width="${layout.W}" height="${layout.H}" fill="#fff"/>`;
 layout.P.forEach(item=>{
  if(item.k==='t')svg+=`<text x="${item.x}" y="${item.y}" font-size="${item.pt*.3528}" fill="${color(item.c)}" text-anchor="${item.an}" font-family="Helvetica,Arial,sans-serif"${item.b?' font-weight="700"':''}>${escapeHtml(item.s)}</text>`;
  else if(item.k==='r')svg+=`<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="${color(item.c)}"/>`;
  else if(item.k==='l')svg+=`<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${color(item.c)}" stroke-width="${item.w}"/>`;
  else if(item.k==='p')svg+=`<polyline points="${item.pts.map(point=>point.join(',')).join(' ')}" fill="none" stroke="${color(item.c)}" stroke-width="${item.w}"/>`;
  else svg+=`<circle cx="${item.x}" cy="${item.y}" r="${item.r}" ${item.fill?`fill="${color(item.c)}"`:`fill="none" stroke="${color(item.c)}" stroke-width="${item.w}"`}/>`;
 });
 return svg+'</svg>';
}

export function genPDF({open,template,latitude,date,translate}) {
 const layout=layoutTemplate(template);
 if(!layout)return;
 const JsPDF=window.jspdf&&window.jspdf.jsPDF;
 if(!JsPDF){window.alert(translate('pdf.libraryError'));return}
 const pdf=new JsPDF({unit:'mm',format:[layout.W,layout.H],orientation:layout.W>layout.H?'l':'p'});
 const alignment={start:'left',end:'right',middle:'center'};
 layout.P.forEach(item=>{
  if(item.k==='t'){
   pdf.setFont('helvetica',item.b?'bold':'normal');pdf.setFontSize(item.pt);pdf.setTextColor(...item.c);
   pdf.text(item.s,item.x,item.y,{align:alignment[item.an]});
  }else if(item.k==='r'){
   pdf.setFillColor(...item.c);pdf.rect(item.x,item.y,item.w,item.h,'F');
  }else if(item.k==='l'){
   pdf.setDrawColor(...item.c);pdf.setLineWidth(item.w);pdf.line(item.x1,item.y1,item.x2,item.y2);
  }else if(item.k==='p'){
   pdf.setDrawColor(...item.c);pdf.setLineWidth(item.w);
   for(let index=1;index<item.pts.length;index++)pdf.line(item.pts[index-1][0],item.pts[index-1][1],item.pts[index][0],item.pts[index][1]);
  }else{
   pdf.setDrawColor(...item.c);pdf.setFillColor(...item.c);pdf.setLineWidth(item.w||.2);
   pdf.circle(item.x,item.y,item.r,item.fill?'F':'S');
  }
 });
 if(open)window.open(pdf.output('bloburl'),'_blank');
 else pdf.save(`${translate('pdf.filename')}_lat${latitude}_${date}.pdf`);
}
