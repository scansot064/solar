import { layoutTemplate } from './template.js';

function escapeHtml(value) {
  const escapedCharacters = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return String(value).replace(/[&<>"']/g, character => escapedCharacters[character]);
}

function getColor(color) {
  return `rgb(${color.join(',')})`;
}

function renderText(item) {
  const bold = item.b ? ' font-weight="700"' : '';
  return `
    <text
      x="${item.x}"
      y="${item.y}"
      font-size="${item.pt * 0.3528}"
      fill="${getColor(item.c)}"
      text-anchor="${item.an}"
      font-family="Helvetica,Arial,sans-serif"${bold}
    >${escapeHtml(item.s)}</text>
  `;
}

function renderItem(item) {
  if (item.k === 't') {
    return renderText(item);
  }
  if (item.k === 'r') {
    return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="${getColor(item.c)}"/>`;
  }
  if (item.k === 'l') {
    return `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${getColor(item.c)}" stroke-width="${item.w}"/>`;
  }
  if (item.k === 'p') {
    const points = item.pts.map(point => point.join(',')).join(' ');
    return `<polyline points="${points}" fill="none" stroke="${getColor(item.c)}" stroke-width="${item.w}"/>`;
  }
  if (item.fill) {
    return `<circle cx="${item.x}" cy="${item.y}" r="${item.r}" fill="${getColor(item.c)}"/>`;
  }

  return `<circle cx="${item.x}" cy="${item.y}" r="${item.r}" fill="none" stroke="${getColor(item.c)}" stroke-width="${item.w}"/>`;
}

export function renderPdfPreviewSvg(layout) {
  const items = layout.P.map(renderItem).join('');
  const page = `<rect width="${layout.W}" height="${layout.H}" fill="#fff"/>`;
  return `<svg viewBox="0 0 ${layout.W} ${layout.H}" xmlns="http://www.w3.org/2000/svg">${page}${items}</svg>`;
}

function drawPdfItem(pdf, item, alignment) {
  if (item.k === 't') {
    pdf.setFont('helvetica', item.b ? 'bold' : 'normal');
    pdf.setFontSize(item.pt);
    pdf.setTextColor(...item.c);
    pdf.text(item.s, item.x, item.y, { align: alignment[item.an] });
    return;
  }

  if (item.k === 'r') {
    pdf.setFillColor(...item.c);
    pdf.rect(item.x, item.y, item.w, item.h, 'F');
    return;
  }

  if (item.k === 'l') {
    pdf.setDrawColor(...item.c);
    pdf.setLineWidth(item.w);
    pdf.line(item.x1, item.y1, item.x2, item.y2);
    return;
  }

  if (item.k === 'p') {
    pdf.setDrawColor(...item.c);
    pdf.setLineWidth(item.w);
    for (let index = 1; index < item.pts.length; index++) {
      const [startX, startY] = item.pts[index - 1];
      const [endX, endY] = item.pts[index];
      pdf.line(startX, startY, endX, endY);
    }
    return;
  }

  pdf.setDrawColor(...item.c);
  pdf.setFillColor(...item.c);
  pdf.setLineWidth(item.w || 0.2);
  pdf.circle(item.x, item.y, item.r, item.fill ? 'F' : 'S');
}

export function genPDF({ open, template, layout: preparedLayout, latitude, date, translate }) {
  const layout =
    preparedLayout === undefined ? layoutTemplate(template) : preparedLayout;
  if (!layout) {
    return;
  }

  const JsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!JsPDF) {
    window.alert(translate('pdf.libraryError'));
    return;
  }

  const pdf = new JsPDF({
    unit: 'mm',
    format: [layout.W, layout.H],
    orientation: layout.W > layout.H ? 'l' : 'p'
  });
  const alignment = { start: 'left', end: 'right', middle: 'center' };

  layout.P.forEach(item => drawPdfItem(pdf, item, alignment));

  if (open) {
    window.open(pdf.output('bloburl'), '_blank');
  } else {
    pdf.save(`${translate('pdf.filename')}_lat${latitude}_${date}.pdf`);
  }
}
