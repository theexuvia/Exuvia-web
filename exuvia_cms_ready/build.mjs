import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const CONTENT_DIR = path.join(ROOT, 'content', 'archivo');

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function yamlScalar(value) {
  const v = String(value ?? '').trim();
  if (!v || v === 'null' || v === '~') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    const q = v[0];
    const inside = v.slice(1, -1);
    return q === '"' ? inside.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : inside.replace(/''/g, "'");
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function parseFrontMatter(source) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!match) throw new Error('Falta el bloque de metadatos YAML al inicio del archivo.');
  const front = match[1].split(/\r?\n/);
  const data = {};
  let activeArray = null;
  for (const line of front) {
    const arr = line.match(/^\s+-\s+(.*)$/);
    if (arr && activeArray) {
      data[activeArray].push(yamlScalar(arr[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!kv) continue;
    const key = kv[1];
    const raw = kv[2] ?? '';
    if (raw.trim() === '') {
      data[key] = [];
      activeArray = key;
    } else {
      data[key] = yamlScalar(raw);
      activeArray = null;
    }
  }
  return { data, body: match[2].trim() };
}

function slugify(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'entrada';
}

function normKind(kind = '') {
  const s = String(kind).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s.includes('hipotesis')) return 'hipotesis';
  if (s.includes('metodo') || s.includes('metodolog')) return 'metodo';
  if (s.includes('nota')) return 'nota';
  if (s.includes('descubr') || s.includes('hallazgo')) return 'descubrimiento';
  if (s.includes('fuente') || s.includes('bibliog')) return 'fuentes';
  return 'reflexion';
}

function kindPrefix(kind = '') {
  const s = normKind(kind);
  return ({ nota: 'REG.', hipotesis: 'HIP.', metodo: 'MÉT.', descubrimiento: 'DESC.', fuentes: 'FUENTES.', reflexion: 'REF.' })[s] || 'REG.';
}

function parseNumericId(record = '') {
  const m = String(record).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function formatDate(raw) {
  if (!raw) return 'Sin fecha';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

function readingMinutes(post) {
  const existing = Number(post.data.reading_minutes);
  if (existing > 0) return existing;
  const words = `${post.body} ${post.data.excerpt || ''}`.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function inlineMarkdown(line) {
  let text = escapeHtml(line);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy">`);
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safeHref = /^(https?:|mailto:|\/|#|\.\/|\.\.\/)/i.test(href) ? href : '#';
    return `<a href="${escapeHtml(safeHref)}">${label}</a>`;
  });
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');
  return text;
}

function markdownToHtml(markdown = '') {
  const lines = String(markdown).replace(/\r/g, '').split('\n');
  const out = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let quoteLines = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${paragraph.map(inlineMarkdown).join(' ')}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listType && listItems.length) {
      out.push(`<${listType}>${listItems.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</${listType}>`);
    }
    listType = null; listItems = [];
  };
  const flushQuote = () => {
    if (quoteLines.length) {
      out.push(`<blockquote class="body-quote"><p>${quoteLines.map(inlineMarkdown).join(' ')}</p></blockquote>`);
      quoteLines = [];
    }
  };

  for (const original of lines) {
    const line = original.trim();
    if (!line) { flushParagraph(); flushList(); flushQuote(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList(); flushQuote();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (/^(---|\*\*\*|___)$/.test(line)) { flushParagraph(); flushList(); flushQuote(); out.push('<hr>'); continue; }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) { flushParagraph(); flushList(); quoteLines.push(quote[1]); continue; }
    const unordered = line.match(/^[-*+]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph(); flushQuote();
      const wanted = unordered ? 'ul' : 'ol';
      if (listType && listType !== wanted) flushList();
      listType = wanted; listItems.push((unordered || ordered)[1]);
      continue;
    }
    flushList(); flushQuote(); paragraph.push(line);
  }
  flushParagraph(); flushList(); flushQuote();
  return out.join('\n');
}

async function loadPosts() {
  await fs.mkdir(CONTENT_DIR, { recursive: true });
  const files = (await fs.readdir(CONTENT_DIR)).filter(name => name.toLowerCase().endsWith('.md'));
  const posts = [];
  for (const name of files) {
    const source = await fs.readFile(path.join(CONTENT_DIR, name), 'utf8');
    try {
      const parsed = parseFrontMatter(source);
      const slug = path.basename(name, path.extname(name));
      const data = parsed.data;
      posts.push({ ...parsed, data, slug, dateObj: data.date ? new Date(data.date) : new Date('2000-01-01') });
    } catch (error) {
      throw new Error(`No se pudo leer ${name}: ${error.message}`);
    }
  }
  const published = posts.filter(p => p.data.published !== false);
  const existingNumbers = published.map(p => parseNumericId(p.data.record_number)).filter(n => Number.isFinite(n));
  let nextNumber = Math.max(0, ...existingNumbers) + 1;
  const needsNumber = published.filter(p => !parseNumericId(p.data.record_number))
    .sort((a, b) => a.dateObj - b.dateObj || a.slug.localeCompare(b.slug, 'es'));
  for (const post of needsNumber) {
    post.data.record_number = `${kindPrefix(post.data.kind)} ${String(nextNumber).padStart(3, '0')}`;
    nextNumber += 1;
  }
  for (const post of published) {
    post.kindFilter = normKind(post.data.kind || 'Reflexión');
    post.title = String(post.data.title || post.slug.replaceAll('-', ' '));
    post.excerpt = String(post.data.excerpt || 'Entrada del archivo de investigación de Exuvia.');
    post.tags = Array.isArray(post.data.tags) ? post.data.tags.map(String) : [];
    post.minutes = readingMinutes(post);
    post.dateLabel = formatDate(post.data.date);
    post.searchText = [post.title, post.excerpt, post.data.kind, post.tags.join(' '), post.body].join(' ');
    post.recordNo = String(post.data.record_number || 'REGISTRO');
  }
  return published;
}

function renderArchiveCard(post) {
  const imagePath = String(post.data.featured_image || '').trim();
  const image = imagePath ? `<img class="entry-thumbnail" src="${escapeHtml(imagePath)}" alt="" loading="lazy">` : '';
  const kind = escapeHtml(post.data.kind || 'Reflexión');
  const id = escapeHtml(post.recordNo);
  return `<a class="entry-card" href="${escapeHtml(post.slug)}.html" data-kind="${escapeHtml(post.kindFilter)}" data-search="${escapeHtml(post.searchText.replace(/\s+/g, ' '))}"><div class="entry-top"><span class="entry-index">${id}</span><span class="entry-kind">${kind}</span></div>${image}<h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.excerpt)}</p><div class="entry-bottom"><span>Lectura · ${post.minutes} min</span><b>↗</b></div></a>`;
}

function renderHomeCard(post) {
  const kind = escapeHtml(post.data.kind || 'Reflexión');
  return `<a class="entry-card" href="${escapeHtml(post.slug)}.html"><div class="entry-meta"><span>${escapeHtml(post.recordNo)}</span><span>${kind}</span></div><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.excerpt)}</p><div class="entry-bottom"><span>Leer registro</span><b>↗</b></div></a>`;
}

function replaceGridContent(html, gridTag, insertionPointBefore, cardsHtml) {
  const start = html.indexOf(gridTag);
  if (start < 0) return html;
  const contentStart = start + gridTag.length;
  const stop = html.indexOf(insertionPointBefore, contentStart);
  if (stop < 0) return html;
  const gridClose = html.lastIndexOf('</div>', stop);
  if (gridClose < contentStart) return html;
  return html.slice(0, contentStart) + '\n          ' + cardsHtml + '\n        ' + html.slice(gridClose);
}

async function generateArchive(posts) {
  let html = await fs.readFile(path.join(ROOT, 'archivo.html'), 'utf8');
  const newest = [...posts].sort((a, b) => b.dateObj - a.dateObj || (parseNumericId(b.recordNo) || 0) - (parseNumericId(a.recordNo) || 0));
  const cards = newest.map(renderArchiveCard).join('\n          ');
  html = replaceGridContent(html, '<div class="entry-grid" id="entryGrid">', '<div class="empty-state"', cards);
  html = html.replace('<button class="filter" data-filter="metodo" aria-pressed="false">Método</button>', '<button class="filter" data-filter="metodo" aria-pressed="false">Método</button><button class="filter" data-filter="reflexion" aria-pressed="false">Reflexiones</button><button class="filter" data-filter="descubrimiento" aria-pressed="false">Descubrimientos</button><button class="filter" data-filter="fuentes" aria-pressed="false">Fuentes</button>');
  html = html.replace('.entry-card:hover{', '.entry-thumbnail{display:block;width:100%;height:145px;object-fit:cover;margin:0 0 18px;filter:saturate(.72);border:1px solid var(--line)}.entry-card:hover{');
  html = html.replace("const query=search.value.trim().toLowerCase();let visible=0;cards.forEach(card=>{const kindMatch=activeFilter==='all'||card.dataset.kind===activeFilter;const text=(card.innerText+' '+card.dataset.search).toLowerCase();const searchMatch=!query||text.includes(query);", "const normalizeText=value=>String(value).toLocaleLowerCase('es').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');const query=normalizeText(search.value.trim());let visible=0;cards.forEach(card=>{const kindMatch=activeFilter==='all'||card.dataset.kind===activeFilter;const text=normalizeText(card.innerText+' '+card.dataset.search);const searchMatch=!query||text.includes(query);");
  await fs.writeFile(path.join(DIST, 'archivo.html'), html, 'utf8');
}

function articleHtml(post, orderedPosts, css, header, footer) {
  const idx = orderedPosts.findIndex(p => p.slug === post.slug);
  const prev = idx > 0 ? orderedPosts[idx - 1] : null;
  const next = idx >= 0 && idx < orderedPosts.length - 1 ? orderedPosts[idx + 1] : null;
  const pull = post.data.pullquote ? `<div class="pull">${escapeHtml(post.data.pullquote)}</div>` : '';
  const featuredPath = String(post.data.featured_image || '').trim();
  const featured = featuredPath ? `<figure class="featured-image"><img src="${escapeHtml(featuredPath)}" alt="${escapeHtml(post.title)}"></figure>` : '';
  const tags = post.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const status = post.data.status_text ? `<div class="status"><strong>${escapeHtml(post.data.status_title || 'Estado del registro')}</strong>${escapeHtml(post.data.status_text)}</div>` : '';
  const question = post.data.question ? `<div class="question"><div class="eyebrow">Pregunta para llevarte</div><p>${escapeHtml(post.data.question)}</p></div>` : '';
  let nav = `<a href="archivo.html">← Volver al archivo</a>`;
  if (prev) nav += `<a href="${escapeHtml(prev.slug)}.html">← Registro anterior</a>`;
  if (next) nav += `<a href="${escapeHtml(next.slug)}.html">Siguiente registro →</a>`;
  const articleBody = `${pull}${featured}${markdownToHtml(post.body)}${status}${question}<div class="article-nav">${nav}</div>`;
  const description = escapeHtml(post.excerpt.slice(0, 155));
  const title = escapeHtml(post.title);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080909"><meta name="description" content="${description}"><title>${title} — Exuvia</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Manrope:wght@300;400;500;600&display=swap" rel="stylesheet"><style>${css}\n.featured-image{margin:0 0 30px}.featured-image img{display:block;width:100%;height:auto;border:1px solid var(--line)}.body ul,.body ol{color:#c7c0b6;padding-left:1.45rem;margin:0 0 23px}.body li{padding-left:.35rem;margin:0 0 10px;line-height:1.9}.body a{color:var(--accent);text-decoration:underline;text-underline-offset:3px}.body-quote{border-left:1px solid var(--accent);padding:6px 0 6px 20px;margin:25px 0;color:#ddd2c3;font:italic 1.55rem/1.3 var(--serif)}.body hr{border:0;border-top:1px solid var(--line);margin:30px 0}</style></head><body>${header}<main><article><header class="hero"><div class="container"><a class="back" href="archivo.html">← Volver al archivo</a><div class="eyebrow" style="margin-top:26px">${escapeHtml(post.recordNo)} / ${escapeHtml(post.data.kind || 'Registro')}</div><h1>${title}</h1><p class="dek">${escapeHtml(post.excerpt)}</p><div class="meta"><span class="tag">${escapeHtml(post.data.kind || 'Registro')}</span>${tags}<span class="tag">${post.minutes} min de lectura</span></div></div></header><div class="container"><div class="body">${articleBody}</div></div></article></main>${footer}<script>const menuButton=document.getElementById('menuButton');const nav=document.getElementById('mainNav');if(menuButton&&nav){menuButton.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menuButton.setAttribute('aria-expanded','false')}));}</script></body></html>`;
}

async function main() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
  const ignore = new Set(['dist', 'node_modules', '.git', 'content', 'build.mjs', 'package.json', 'netlify.toml', '.gitignore', 'README_CMS_EXUVIA.md', 'LEEME.txt', 'CAMBIAR_CONFIG_CMS.txt']);
  for (const name of await fs.readdir(ROOT)) {
    if (ignore.has(name)) continue;
    await fs.cp(path.join(ROOT, name), path.join(DIST, name), { recursive: true });
  }
  await fs.mkdir(path.join(DIST, 'assets', 'uploads'), { recursive: true });

  // Si Netlify publica desde un repositorio GitHub conectado, completa el repo del CMS automáticamente.
  const repoUrl = process.env.REPOSITORY_URL || '';
  const repoMatch = repoUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i);
  const cmsConfigPath = path.join(DIST, 'admin', 'config.yml');
  try {
    let cmsConfig = await fs.readFile(cmsConfigPath, 'utf8');
    if (repoMatch) cmsConfig = cmsConfig.replace('TU_USUARIO_GITHUB/exuvia-web', repoMatch[1].replace(/\.git$/i, ''));
    await fs.writeFile(cmsConfigPath, cmsConfig, 'utf8');
  } catch (e) {
    console.warn('No se encontró admin/config.yml; el editor de contenido no se habrá copiado.');
  }

  const posts = await loadPosts();
  const chronological = [...posts].sort((a, b) => a.dateObj - b.dateObj || (parseNumericId(a.recordNo) || 0) - (parseNumericId(b.recordNo) || 0));

  // La plantilla conserva exactamente el lenguaje visual del artículo actual.
  const sourceEntry = await fs.readFile(path.join(ROOT, 'entrada-001.html'), 'utf8');
  const cssMatch = sourceEntry.match(/<style>([\s\S]*?)<\/style>/i);
  const css = cssMatch ? cssMatch[1] : '';
  const headerStart = sourceEntry.indexOf('<header class="container header">');
  const headerEnd = sourceEntry.indexOf('</header>', headerStart) + '</header>'.length;
  const footerStart = sourceEntry.indexOf('<footer class="container footer">');
  const footerEnd = sourceEntry.indexOf('</footer>', footerStart) + '</footer>'.length;
  const header = sourceEntry.slice(headerStart, headerEnd);
  const footer = sourceEntry.slice(footerStart, footerEnd);

  // Quitar páginas de artículos copiadas como HTML: las genera ahora la colección de Markdown.
  for (const name of await fs.readdir(DIST)) {
    if (/^entrada-.*\.html$/i.test(name)) await fs.rm(path.join(DIST, name), { force: true });
  }
  for (const post of posts) {
    const html = articleHtml(post, chronological, css, header, footer);
    await fs.writeFile(path.join(DIST, `${post.slug}.html`), html, 'utf8');
  }

  await generateArchive(posts);

  // La selección editorial de Inicio también se renueva con las tres entradas más recientes.
  let home = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const latestCards = [...posts].sort((a, b) => b.dateObj - a.dateObj || (parseNumericId(b.recordNo) || 0) - (parseNumericId(a.recordNo) || 0)).slice(0, 3).map(renderHomeCard).join('\n          ');
  home = replaceGridContent(home, '<div class="entries-grid">', '<div class="section-end"', latestCards);
  await fs.writeFile(path.join(DIST, 'index.html'), home, 'utf8');

  console.log(`EXUVIA build OK · ${posts.length} entradas publicadas · salida: dist/`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
