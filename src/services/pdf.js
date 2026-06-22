// ============================================================
//  Gerador de PDF premium — Oráculo da Alma
//  pdfkit (100% JavaScript, sem compilação nativa).
//  Fundo azul estrelado, ouro, emblema, medalhão do signo,
//  mapa visual e páginas temáticas.
// ============================================================
const PDFDocument = require('pdfkit');

// Paleta
const NAVY1 = '#0a1430', NAVY2 = '#0c1535', NAVY3 = '#060b1c';
const GOLD = '#c9a24b', GOLD2 = '#e0c478', CREAM = '#f1e9d6', CREAMDIM = '#cfc6b2', VIOLET = '#8a72b5';

const ELEMENTO_COR = { Fogo: '#e07a4b', Terra: '#9bbf7a', Ar: '#7ec7e0', 'Água': '#7e9be0' };

// ---------- Helpers de desenho ----------
function fundo(doc) {
  const W = doc.page.width, H = doc.page.height;
  const g = doc.linearGradient(0, 0, 0, H);
  g.stop(0, NAVY1).stop(0.55, NAVY2).stop(1, NAVY3);
  doc.rect(0, 0, W, H).fill(g);

  // estrelas
  doc.save();
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = Math.random() * 1.2 + 0.2;
    doc.circle(x, y, r).fillColor(Math.random() > 0.85 ? CREAM : GOLD2).fillOpacity(Math.random() * 0.55 + 0.2).fill();
  }
  doc.restore();
  doc.fillOpacity(1);

  // moldura dourada dupla
  doc.lineWidth(2).strokeColor(GOLD).rect(26, 26, W - 52, H - 52).stroke();
  doc.lineWidth(0.7).strokeColor('#9c7d3a').rect(34, 34, W - 68, H - 68).stroke();
  // cantos decorativos
  [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]].forEach(([x, y]) => {
    doc.circle(x, y, 3).fillColor(GOLD2).fill();
  });
}

// Emblema (lua, olho, raios, lótus) — vetorial, inspirado na logo
function emblema(doc, cx, cy, R) {
  doc.save();
  doc.lineWidth(1.6).strokeColor(GOLD);
  doc.circle(cx, cy, R).stroke();
  doc.lineWidth(0.8).circle(cx, cy, R - 6).stroke();
  // lua crescente
  doc.save();
  doc.fillColor(GOLD2);
  doc.circle(cx, cy - R * 0.34, R * 0.28).fill();
  doc.fillColor(NAVY2);
  doc.circle(cx + R * 0.10, cy - R * 0.40, R * 0.26).fill();
  doc.restore();
  // olho
  doc.lineWidth(1.2).strokeColor(GOLD2);
  doc.ellipse(cx, cy - R * 0.30, R * 0.16, R * 0.09).stroke();
  doc.circle(cx, cy - R * 0.30, R * 0.04).fillColor(GOLD2).fill();
  // raios
  doc.lineWidth(1).strokeColor(GOLD);
  for (let a = -60; a <= 60; a += 30) {
    const rad = (a - 90) * Math.PI / 180;
    doc.moveTo(cx + Math.cos(rad) * (R * 0.16), cy - R * 0.30 + Math.sin(rad) * (R * 0.16))
      .lineTo(cx + Math.cos(rad) * (R * 0.30), cy - R * 0.30 + Math.sin(rad) * (R * 0.30)).stroke();
  }
  // lótus / figura em meditação (estilizada)
  doc.lineWidth(1.3).strokeColor(GOLD);
  doc.circle(cx, cy + R * 0.18, R * 0.12).stroke();
  doc.moveTo(cx - R * 0.34, cy + R * 0.46)
    .quadraticCurveTo(cx, cy + R * 0.30, cx + R * 0.34, cy + R * 0.46)
    .quadraticCurveTo(cx, cy + R * 0.62, cx - R * 0.34, cy + R * 0.46).stroke();
  doc.restore();
}

// Glifo do signo (vetorial, estilizado) dentro de um medalhão
function medalhaoSigno(doc, signo, cx, cy, R) {
  doc.save();
  // medalhão
  const g = doc.radialGradient ? null : null;
  doc.circle(cx, cy, R).fillColor(NAVY1).fillOpacity(0.6).fill();
  doc.fillOpacity(1);
  doc.lineWidth(1.8).strokeColor(GOLD).circle(cx, cy, R).stroke();
  doc.lineWidth(0.7).strokeColor(GOLD2).circle(cx, cy, R - 7).stroke();
  // ticks radiais
  doc.lineWidth(0.8).strokeColor(GOLD);
  for (let a = 0; a < 360; a += 30) {
    const rad = a * Math.PI / 180;
    doc.moveTo(cx + Math.cos(rad) * (R - 5), cy + Math.sin(rad) * (R - 5))
      .lineTo(cx + Math.cos(rad) * (R - 1), cy + Math.sin(rad) * (R - 1)).stroke();
  }
  // glifo
  doc.lineWidth(2.4).strokeColor(GOLD2);
  desenharGlifo(doc, signo, cx, cy, R * 0.5);
  doc.restore();
}

// Desenho aproximado de cada glifo zodiacal
function desenharGlifo(doc, signo, cx, cy, s) {
  const M = (x, y) => doc.moveTo(cx + x * s, cy + y * s);
  const L = (x, y) => doc.lineTo(cx + x * s, cy + y * s);
  const arc = (x, y, r, a0, a1) => doc.path(arcPath(cx + x * s, cy + y * s, r * s, a0, a1));
  switch (signo) {
    case 'Áries':
      M(-0.6, 0.5); doc.quadraticCurveTo(cx - 0.6 * s, cy - 0.6 * s, cx, cy - 0.1 * s);
      doc.quadraticCurveTo(cx + 0.6 * s, cy - 0.6 * s, cx + 0.6 * s, cy + 0.5 * s); doc.stroke(); break;
    case 'Touro':
      doc.circle(cx, cy + 0.25 * s, 0.4 * s).stroke();
      M(-0.5, -0.5); doc.quadraticCurveTo(cx, cy - 0.9 * s, cx + 0.5 * s, cy - 0.5 * s); doc.stroke(); break;
    case 'Gêmeos':
      M(-0.4, -0.6); L(-0.4, 0.6); M(0.4, -0.6); L(0.4, 0.6);
      M(-0.55, -0.55); L(0.55, -0.55); M(-0.55, 0.55); L(0.55, 0.55); doc.stroke(); break;
    case 'Câncer':
      doc.circle(cx - 0.25 * s, cy - 0.2 * s, 0.18 * s).stroke();
      doc.circle(cx + 0.25 * s, cy + 0.2 * s, 0.18 * s).stroke();
      M(-0.6, -0.2); doc.quadraticCurveTo(cx - 0.6 * s, cy - 0.6 * s, cx + 0.2 * s, cy - 0.4 * s); doc.stroke();
      M(0.6, 0.2); doc.quadraticCurveTo(cx + 0.6 * s, cy + 0.6 * s, cx - 0.2 * s, cy + 0.4 * s); doc.stroke(); break;
    case 'Leão':
      doc.circle(cx - 0.25 * s, cy + 0.3 * s, 0.25 * s).stroke();
      M(0.0, 0.3); doc.quadraticCurveTo(cx + 0.5 * s, cy - 0.1 * s, cx + 0.1 * s, cy - 0.5 * s);
      doc.quadraticCurveTo(cx - 0.2 * s, cy - 0.7 * s, cx + 0.2 * s, cy - 0.6 * s); doc.stroke(); break;
    case 'Virgem':
      M(-0.6, -0.4); L(-0.6, 0.5); M(-0.6, -0.4); doc.quadraticCurveTo(cx - 0.3 * s, cy - 0.5 * s, cx - 0.2 * s, cy + 0.3 * s);
      M(-0.2, -0.3); doc.quadraticCurveTo(cx + 0.1 * s, cy - 0.5 * s, cx + 0.2 * s, cy + 0.3 * s);
      M(0.2, -0.3); doc.quadraticCurveTo(cx + 0.5 * s, cy - 0.4 * s, cx + 0.5 * s, cy + 0.2 * s);
      doc.quadraticCurveTo(cx + 0.5 * s, cy + 0.6 * s, cx + 0.2 * s, cy + 0.5 * s); doc.stroke(); break;
    case 'Libra':
      M(-0.6, 0.4); L(0.6, 0.4); M(-0.6, 0.15); L(0.6, 0.15);
      arc(0, 0.15, 0.35, Math.PI, 2 * Math.PI); doc.stroke(); break;
    case 'Escorpião':
      M(-0.6, -0.4); L(-0.6, 0.5); M(-0.6, -0.4); doc.quadraticCurveTo(cx - 0.3 * s, cy - 0.5 * s, cx - 0.2 * s, cy + 0.3 * s);
      M(-0.2, -0.3); doc.quadraticCurveTo(cx + 0.1 * s, cy - 0.5 * s, cx + 0.2 * s, cy + 0.4 * s);
      M(0.2, -0.3); L(0.2, 0.45); L(0.55, 0.45); M(0.5, 0.3); L(0.6, 0.45); L(0.45, 0.55); doc.stroke(); break;
    case 'Sagitário':
      M(-0.5, 0.5); L(0.5, -0.5); M(0.5, -0.5); L(0.15, -0.5); M(0.5, -0.5); L(0.5, -0.15);
      M(-0.25, 0.05); L(0.05, 0.35); doc.stroke(); break;
    case 'Capricórnio':
      M(-0.5, -0.4); doc.quadraticCurveTo(cx - 0.2 * s, cy - 0.6 * s, cx - 0.1 * s, cy + 0.2 * s);
      M(-0.1, -0.1); doc.quadraticCurveTo(cx + 0.2 * s, cy - 0.5 * s, cx + 0.25 * s, cy + 0.2 * s);
      doc.circle(cx + 0.35 * s, cy + 0.35 * s, 0.2 * s).stroke(); doc.stroke(); break;
    case 'Aquário':
      M(-0.6, -0.2); L(-0.3, -0.35); L(0.0, -0.2); L(0.3, -0.35); L(0.6, -0.2);
      M(-0.6, 0.2); L(-0.3, 0.05); L(0.0, 0.2); L(0.3, 0.05); L(0.6, 0.2); doc.stroke(); break;
    case 'Peixes':
      arc(-0.4, 0, 0.45, Math.PI / 2, 1.5 * Math.PI);
      arc(0.4, 0, 0.45, -Math.PI / 2, Math.PI / 2);
      M(-0.4, 0); L(0.4, 0); doc.stroke(); break;
    default:
      doc.circle(cx, cy, 0.3 * s).stroke();
  }
}

function arcPath(cx, cy, r, a0, a1) {
  const steps = 24; let d = '';
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
  }
  return d;
}

function divisor(doc, x, y, w) {
  doc.save();
  doc.lineWidth(0.8).strokeColor(GOLD);
  doc.moveTo(x, y).lineTo(x + w / 2 - 8, y).stroke();
  doc.moveTo(x + w / 2 + 8, y).lineTo(x + w, y).stroke();
  doc.circle(x + w / 2, y, 2.5).fillColor(GOLD2).fill();
  doc.restore();
}

// Ícones para o mapa visual
function iconeSol(doc, cx, cy, r) {
  doc.save().lineWidth(1.4).strokeColor(GOLD2);
  doc.circle(cx, cy, r * 0.5).stroke();
  for (let a = 0; a < 360; a += 45) {
    const rad = a * Math.PI / 180;
    doc.moveTo(cx + Math.cos(rad) * r * 0.7, cy + Math.sin(rad) * r * 0.7)
      .lineTo(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r).stroke();
  }
  doc.restore();
}
function iconeLua(doc, cx, cy, r) {
  doc.save();
  doc.circle(cx, cy, r * 0.7).fillColor(GOLD2).fill();
  doc.circle(cx + r * 0.3, cy - r * 0.2, r * 0.6).fillColor(NAVY2).fill();
  doc.restore();
}
function iconeAsc(doc, cx, cy, r) {
  doc.save().lineWidth(1.5).strokeColor(GOLD2);
  doc.moveTo(cx, cy + r * 0.7).lineTo(cx, cy - r * 0.7).stroke();
  doc.moveTo(cx - r * 0.4, cy - r * 0.3).lineTo(cx, cy - r * 0.7).lineTo(cx + r * 0.4, cy - r * 0.3).stroke();
  doc.restore();
}
function iconeElemento(doc, cx, cy, r, elemento) {
  doc.save().lineWidth(1.5).strokeColor(ELEMENTO_COR[elemento] || GOLD2);
  if (elemento === 'Fogo' || elemento === 'Ar') {
    doc.moveTo(cx, cy - r).lineTo(cx - r * 0.85, cy + r * 0.6).lineTo(cx + r * 0.85, cy + r * 0.6).closePath().stroke();
    if (elemento === 'Ar') doc.moveTo(cx - r * 0.5, cy + r * 0.0).lineTo(cx + r * 0.5, cy + r * 0.0).stroke();
  } else {
    doc.moveTo(cx, cy + r).lineTo(cx - r * 0.85, cy - r * 0.6).lineTo(cx + r * 0.85, cy - r * 0.6).closePath().stroke();
    if (elemento === 'Terra') doc.moveTo(cx - r * 0.5, cy + r * 0.0).lineTo(cx + r * 0.5, cy + r * 0.0).stroke();
  }
  doc.restore();
}

// ---------- Conteúdo ----------
const TIPO_LABEL = { mapa_astral: 'Mapa Astral', astrologia_vedica: 'Astrologia Védica', tarot: 'Tarot', buzios: 'Búzios' };

function dadosDoMapa(technical) {
  const oc = technical && technical.astrologiaOcidental;
  if (!oc) return null;
  let elemDom = null, max = -1;
  for (const [el, n] of Object.entries(oc.elementos || {})) {
    if (n > max) { max = n; elemDom = el; }
  }
  return { sol: oc.sol, lua: oc.lua, ascendente: oc.ascendente, elementoDominante: elemDom };
}

/**
 * Gera o PDF e retorna um Buffer.
 * @param {Object} consultation  linha da consulta (inclui result_text, technical_json, type, category, created_at)
 * @param {Object} user          { full_name, email }
 */
function gerarPDF(consultation, user) {
  return new Promise((resolve, reject) => {
    try {
      const technical = consultation.technical_json ? JSON.parse(consultation.technical_json) : null;
      const mapa = dadosDoMapa(technical);
      const tipoLabel = TIPO_LABEL[consultation.type] || consultation.type;
      const data = new Date((consultation.created_at || new Date().toISOString()) + 'Z');
      const dataFmt = isNaN(data) ? new Date().toLocaleDateString('pt-BR') : data.toLocaleDateString('pt-BR');
      const signoPrincipal = mapa ? mapa.sol : null;

      const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Fundo automático em cada página nova
      doc.on('pageAdded', () => fundo(doc));

      const W = doc.page.width, H = doc.page.height;
      const MX = 64, CW = W - 2 * MX;

      // ---------- PÁGINA 1 — CAPA ----------
      fundo(doc); // primeira página
      emblema(doc, W / 2, 150, 56);
      doc.font('Helvetica-Bold').fontSize(26).fillColor(GOLD2)
        .text('ORÁCULO DA ALMA', 0, 232, { width: W, align: 'center', characterSpacing: 4 });
      doc.font('Times-Italic').fontSize(12).fillColor(CREAMDIM)
        .text('O universo fala com você', 0, 266, { width: W, align: 'center' });

      if (signoPrincipal) {
        medalhaoSigno(doc, signoPrincipal, W / 2, 420, 78);
        doc.font('Helvetica-Bold').fontSize(15).fillColor(GOLD2)
          .text(signoPrincipal, 0, 510, { width: W, align: 'center', characterSpacing: 2 });
      } else {
        emblema(doc, W / 2, 420, 70);
      }

      divisor(doc, MX, 560, CW);
      doc.font('Helvetica').fontSize(11).fillColor(CREAMDIM)
        .text('RELATÓRIO PREMIUM', 0, 576, { width: W, align: 'center', characterSpacing: 3 });
      doc.font('Helvetica-Bold').fontSize(18).fillColor(CREAM)
        .text(user.full_name || 'Consulente', 0, 596, { width: W, align: 'center' });

      const linhas = [
        ['Consulta', tipoLabel],
        ['Data', dataFmt],
      ];
      if (signoPrincipal) linhas.push(['Signo solar', signoPrincipal]);
      let ly = 640;
      doc.fontSize(11);
      linhas.forEach(([k, v]) => {
        doc.font('Helvetica').fillColor(GOLD2).text(k + ':', MX, ly, { width: CW / 2, align: 'right' });
        doc.font('Times-Roman').fillColor(CREAM).text(v, MX + CW / 2 + 10, ly, { width: CW / 2 - 10, align: 'left' });
        ly += 22;
      });

      doc.font('Times-Italic').fontSize(9).fillColor(CREAMDIM)
        .text('Autoconhecimento, espiritualidade e entretenimento.', 0, H - 70, { width: W, align: 'center' });

      // ---------- PÁGINA 2 — MAPA VISUAL ----------
      if (mapa) {
        doc.addPage();
        tituloPagina(doc, 'Seu Mapa Visual', W, MX, CW);
        const badges = [
          ['Sol', mapa.sol, iconeSol],
          ['Lua', mapa.lua, iconeLua],
          ['Ascendente', mapa.ascendente, iconeAsc],
          ['Elemento', mapa.elementoDominante, (d, x, y, r) => iconeElemento(d, x, y, r, mapa.elementoDominante)],
        ];
        let by = 180;
        const bw = CW, bh = 92;
        badges.forEach(([label, val, icon]) => {
          doc.save();
          doc.lineWidth(1).strokeColor(GOLD).roundedRect(MX, by, bw, bh, 12).stroke();
          doc.circle(MX + 56, by + bh / 2, 26).lineWidth(1).strokeColor(GOLD2).stroke();
          icon(doc, MX + 56, by + bh / 2, 16);
          doc.font('Helvetica-Bold').fontSize(12).fillColor(GOLD2)
            .text(label.toUpperCase(), MX + 100, by + 24, { characterSpacing: 2 });
          doc.font('Times-Roman').fontSize(16).fillColor(CREAM)
            .text(val || '—', MX + 100, by + 44);
          doc.restore();
          by += bh + 16;
        });

        doc.font('Times-Italic').fontSize(10.5).fillColor(CREAMDIM)
          .text('Estes valores foram calculados por efemérides reais. As páginas a seguir trazem a interpretação.',
            MX, by + 10, { width: CW, align: 'center' });
      }

      // ---------- PÁGINAS DE CONTEÚDO ----------
      doc.addPage();
      let y = 110;
      const bottom = H - 84;
      const ensure = (need) => { if (y + need > bottom) { doc.addPage(); y = 110; } };

      tituloPagina(doc, 'A Leitura da Sua Alma', W, MX, CW);
      y = 180;

      const texto = (consultation.result_text || '').trim();
      const blocos = texto.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

      blocos.forEach((bloco) => {
        const isTitulo = /^(\d+\.\s+|[A-ZÁ-Ú][^\n]{0,46}:?$)/.test(bloco) && bloco.length < 60 && !bloco.endsWith('.');
        if (isTitulo) {
          ensure(50);
          const t = bloco.replace(/^\d+\.\s*/, '');
          doc.font('Helvetica-Bold').fontSize(14).fillColor(GOLD2);
          const h = doc.heightOfString(t, { width: CW, characterSpacing: 1 });
          ensure(h + 18);
          doc.text(t, MX, y, { width: CW, characterSpacing: 1 });
          y = doc.y + 6;
          divisor(doc, MX, y, CW); y += 14;
        } else {
          doc.font('Times-Roman').fontSize(11.5).fillColor(CREAM);
          const h = doc.heightOfString(bloco, { width: CW, lineGap: 3, align: 'justify' });
          if (h > bottom - 110 && y > 200) { doc.addPage(); y = 110; }
          ensure(Math.min(h, bottom - 110) + 10);
          doc.text(bloco, MX, y, { width: CW, lineGap: 3, align: 'justify' });
          y = doc.y + 10;
        }
      });

      // ---------- PÁGINA FINAL — MENSAGEM ----------
      doc.addPage();
      emblema(doc, W / 2, 200, 60);
      doc.font('Helvetica-Bold').fontSize(18).fillColor(GOLD2)
        .text('Mensagem Final', 0, 300, { width: W, align: 'center', characterSpacing: 2 });
      divisor(doc, MX, 332, CW);
      doc.font('Times-Italic').fontSize(13).fillColor(CREAM)
        .text('Que esta leitura ilumine seus caminhos. O universo conspira a seu favor — confie na sua jornada e siga com o coração aberto.',
          MX + 20, 360, { width: CW - 40, align: 'center', lineGap: 4 });
      doc.font('Helvetica').fontSize(10).fillColor(CREAMDIM)
        .text('Oráculo da Alma', 0, 460, { width: W, align: 'center', characterSpacing: 2 });
      doc.font('Times-Italic').fontSize(9).fillColor(CREAMDIM)
        .text('As interpretações são voltadas para autoconhecimento, espiritualidade e entretenimento. Não substituem orientação médica, jurídica, psicológica ou financeira.',
          MX + 30, H - 120, { width: CW - 60, align: 'center', lineGap: 2 });

      // ---------- Rodapé com número de página ----------
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(8).fillColor(CREAMDIM)
          .text(`Oráculo da Alma  ·  ${i + 1} / ${range.count}`, 0, H - 44, { width: W, align: 'center', characterSpacing: 1 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function tituloPagina(doc, titulo, W, MX, CW) {
  doc.font('Helvetica-Bold').fontSize(20).fillColor(GOLD2)
    .text(titulo, 0, 110, { width: W, align: 'center', characterSpacing: 2 });
  divisor(doc, MX, 150, CW);
}

module.exports = { gerarPDF };
