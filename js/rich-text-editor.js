/**
 * RichTextEditor v5.0 — stable compatibility adapter built on SunEditor 3.4.1.
 *
 * Copyright (c) 2026 The Greek Directory. All rights reserved.
 * SunEditor is an MIT-licensed, zero-runtime-dependency editor engine.
 * The pinned CDN assets are loaded on demand; no upload endpoint is configured.
 *
 * Backward-compatible entry point:
 *   RichTextEditor.mount({ inputId, label, placeholder, maxLength,
 *     noFormatPaste, plainPaste, onChange })
 *
 * The returned instance preserves the v4 methods. mount() remains synchronous;
 * the editor engine initializes asynchronously and exposes instance.ready.
 */
(function (window, document) {
  'use strict';

  if (!window || !document) return;

  const VERSION = '5.0.0';
  const ENGINE_VERSION = '3.4.1';
  const ENGINE_JS = `https://cdn.jsdelivr.net/npm/suneditor@${ENGINE_VERSION}/dist/suneditor.min.js`;
  const ENGINE_CSS = `https://cdn.jsdelivr.net/npm/suneditor@${ENGINE_VERSION}/dist/suneditor.min.css`;
  const STYLE_ID = 'rte-v5-shared-styles';
  const DANGEROUS_TAGS = new Set([
    'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'APPLET', 'FORM', 'INPUT',
    'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION', 'META', 'LINK', 'BASE', 'NOSCRIPT'
  ]);
  const ALLOWED_TAGS = new Set([
    'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'SPAN', 'MARK', 'CODE',
    'PRE', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI',
    'A', 'IMG', 'HR', 'FIGURE', 'FIGCAPTION', 'TABLE', 'THEAD', 'TBODY', 'TFOOT',
    'TR', 'TH', 'TD', 'COLGROUP', 'COL'
  ]);
  const ALLOWED_STYLE_PROPS = new Set([
    'color', 'background-color', 'text-align', 'vertical-align', 'float',
    'width', 'height', 'max-width', 'margin', 'margin-left', 'margin-right',
    'margin-top', 'margin-bottom', 'display', 'white-space', 'border-color',
    'border-width', 'border-style', 'border-collapse'
  ]);
  const ALLOWED_ATTRS = {
    A: ['href', 'target', 'rel', 'title'],
    IMG: ['src', 'alt', 'width', 'height', 'style'],
    SPAN: ['style'], MARK: ['style'], P: ['style'],
    H1: ['style'], H2: ['style'], H3: ['style'], H4: ['style'], H5: ['style'], H6: ['style'],
    BLOCKQUOTE: ['style'], PRE: ['style'], FIGURE: ['style'], FIGCAPTION: ['style'],
    TABLE: ['style'], TH: ['style', 'colspan', 'rowspan'], TD: ['style', 'colspan', 'rowspan'],
    COL: ['style', 'span'],
  };

  let engineLoadPromise = null;
  const instancesByInput = new WeakMap();

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function isSafeUrl(value, kind) {
    const url = String(value || '').trim();
    if (!url || /[\u0000-\u001f\u007f]/.test(url)) return false;
    if (/^(?:https?):\/\//i.test(url)) return true;
    if (kind === 'link' && /^(?:mailto|tel):/i.test(url)) return true;
    // Relative paths and in-document anchors are permitted. Protocol-relative URLs
    // are intentionally rejected so pasted content cannot silently switch origins.
    if (/^(?:#|\/|\.\/|\.\.\/)/.test(url) && !/^\/\//.test(url)) return true;
    return false;
  }

  function safeStyleValue(property, value) {
    const v = String(value || '').trim();
    if (!v || /url\s*\(|expression\s*\(|javascript:|vbscript:|@import|[<>\\]/i.test(v)) return false;
    if (property === 'color' || property === 'background-color' || property === 'border-color') {
      return /^(?:#[0-9a-f]{3,8}|rgba?\([\d.%\s,/+-]+\)|hsla?\([\d.%\s,/+-]+\)|[a-z]{1,24}|transparent|currentcolor)$/i.test(v);
    }
    if (['width', 'height', 'max-width'].includes(property)) {
      return /^(?:\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh|ch)|auto|max-content|min-content|fit-content)$/i.test(v);
    }
    if (property === 'text-align') return /^(left|right|center|justify|start|end)$/i.test(v);
    if (property === 'vertical-align') return /^(baseline|sub|super|top|middle|bottom|text-top|text-bottom)$/i.test(v);
    if (property === 'float') return /^(left|right|none)$/i.test(v);
    if (property === 'display') return /^(block|inline|inline-block)$/i.test(v);
    if (property === 'white-space') return /^(normal|pre|pre-wrap|pre-line|break-spaces)$/i.test(v);
    if (property === 'border-width') return /^(?:\d+(?:\.\d+)?(?:px|pt|em|rem)|thin|medium|thick)$/i.test(v);
    if (property === 'border-style') return /^(none|solid|dashed|dotted|double)$/i.test(v);
    if (property === 'border-collapse') return /^(collapse|separate)$/i.test(v);
    if (property.startsWith('margin')) {
      return /^(?:auto|0|[+-]?\d+(?:\.\d+)?(?:px|pt|em|rem|%))(?:\s+(?:auto|0|[+-]?\d+(?:\.\d+)?(?:px|pt|em|rem|%))){0,3}$/i.test(v);
    }
    return false;
  }

  function sanitizeStyle(styleText) {
    const result = [];
    String(styleText || '').split(';').forEach((declaration) => {
      const colon = declaration.indexOf(':');
      if (colon < 1) return;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (!ALLOWED_STYLE_PROPS.has(property) || !safeStyleValue(property, value)) return;
      result.push(`${property}: ${value}`);
    });
    return result.join('; ');
  }

  function sanitizeRichTextHtml(html) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
    const body = parsed.body;

    // Remove executable / embedding elements with their contents; unwrap harmless
    // unknown formatting wrappers so text is retained rather than silently discarded.
    body.querySelectorAll(Array.from(DANGEROUS_TAGS).join(',')).forEach((node) => node.remove());

    function cleanChildren(parent) {
      Array.from(parent.childNodes).forEach((node) => {
        if (node.nodeType === Node.COMMENT_NODE) {
          node.remove();
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const element = node;
        const tag = element.tagName;
        if (!ALLOWED_TAGS.has(tag)) {
          cleanChildren(element);
          const fragment = document.createDocumentFragment();
          while (element.firstChild) fragment.appendChild(element.firstChild);
          element.replaceWith(fragment);
          return;
        }

        const allowed = ALLOWED_ATTRS[tag] || [];
        Array.from(element.attributes).forEach((attribute) => {
          const name = attribute.name.toLowerCase();
          if (name.startsWith('on') || name === 'contenteditable' || name === 'spellcheck' ||
              name === 'class' || name.startsWith('data-') || !allowed.includes(name)) {
            element.removeAttribute(attribute.name);
            return;
          }
          if (name === 'style') {
            const style = sanitizeStyle(attribute.value);
            if (style) element.setAttribute('style', style);
            else element.removeAttribute('style');
          }
          if (name === 'colspan' || name === 'rowspan' || name === 'span') {
            const number = Number.parseInt(attribute.value, 10);
            if (!Number.isInteger(number) || number < 1 || number > 100) element.removeAttribute(attribute.name);
            else element.setAttribute(attribute.name, String(number));
          }
          if (name === 'width' || name === 'height') {
            const number = Number.parseInt(attribute.value, 10);
            if (!Number.isInteger(number) || number < 1 || number > 10000) element.removeAttribute(attribute.name);
            else element.setAttribute(attribute.name, String(number));
          }
        });

        if (tag === 'A') {
          const href = element.getAttribute('href') || '';
          if (!isSafeUrl(href, 'link')) element.removeAttribute('href');
          if (element.getAttribute('target') === '_blank') {
            element.setAttribute('rel', 'noopener noreferrer');
          } else {
            element.removeAttribute('target');
            element.removeAttribute('rel');
          }
        }
        if (tag === 'IMG') {
          const src = element.getAttribute('src') || '';
          if (!isSafeUrl(src, 'image')) {
            element.remove();
            return;
          }
          if (!element.hasAttribute('alt')) element.setAttribute('alt', '');
          const style = sanitizeStyle(element.getAttribute('style') || '');
          const styleParts = style ? style.split('; ') : [];
          if (!styleParts.some((part) => /^max-width\s*:/i.test(part))) styleParts.push('max-width: 100%');
          if (!styleParts.some((part) => /^height\s*:/i.test(part))) styleParts.push('height: auto');
          element.setAttribute('style', styleParts.filter(Boolean).join('; '));
        }

        cleanChildren(element);
      });
    }

    cleanChildren(body);
    return body.innerHTML;
  }

  function stripHtml(html) {
    const clean = sanitizeRichTextHtml(html);
    const parsed = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html');
    const root = parsed.body;
    const blockTags = new Set([
      'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE',
      'PRE', 'FIGURE', 'TR', 'TABLE', 'HR'
    ]);
    let output = '';
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        output += node.nodeValue || '';
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node;
      if (el.tagName === 'BR') {
        output += '\n';
        return;
      }
      if (el.tagName === 'TD' || el.tagName === 'TH') {
        if (output && !/[\t\n]$/.test(output)) output += '\t';
      }
      if (blockTags.has(el.tagName) && output && !output.endsWith('\n')) output += '\n';
      Array.from(el.childNodes).forEach(walk);
      if (blockTags.has(el.tagName) && !output.endsWith('\n')) output += '\n';
    }
    Array.from(root.childNodes).forEach(walk);
    return output.replace(/[\t ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function htmlToDocument(html) {
    const clean = sanitizeRichTextHtml(html);
    const parsed = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html');
    const blocks = [];

    Array.from(parsed.body.children).forEach((node) => {
      const tag = node.tagName;
      if (/^H[1-6]$/.test(tag)) {
        blocks.push({ type: 'heading', level: Number(tag.slice(1)), content: node.innerHTML });
      } else if (tag === 'P') {
        blocks.push({ type: 'paragraph', content: node.innerHTML });
      } else if (tag === 'UL' || tag === 'OL') {
        blocks.push({
          type: tag === 'UL' ? 'bulletList' : 'orderedList',
          items: Array.from(node.children).filter((child) => child.tagName === 'LI').map((li) => li.innerHTML)
        });
      } else if (tag === 'BLOCKQUOTE') {
        blocks.push({ type: 'blockquote', content: node.innerHTML });
      } else if (tag === 'PRE') {
        blocks.push({ type: 'codeBlock', content: node.textContent || '' });
      } else if (tag === 'HR') {
        blocks.push({ type: 'divider' });
      } else if (tag === 'IMG' || (tag === 'FIGURE' && node.querySelector('img'))) {
        const figure = tag === 'FIGURE' ? node : null;
        const image = figure ? figure.querySelector('img') : node;
        blocks.push({
          type: 'image',
          src: image.getAttribute('src') || '',
          alt: image.getAttribute('alt') || '',
          width: image.getAttribute('width') || '',
          height: image.getAttribute('height') || '',
          style: image.getAttribute('style') || '',
          figureStyle: figure ? figure.getAttribute('style') || '' : ''
        });
      } else if (tag === 'TABLE') {
        const rows = Array.from(node.rows).map((row) => ({
          cells: Array.from(row.cells).map((cell) => ({
            type: cell.tagName.toLowerCase(),
            html: cell.innerHTML,
            colspan: cell.colSpan > 1 ? cell.colSpan : undefined,
            rowspan: cell.rowSpan > 1 ? cell.rowSpan : undefined
          }))
        }));
        blocks.push({ type: 'table', rows });
      } else {
        // Preserve any safe block that the JSON mapper does not understand.
        blocks.push({ type: 'html', html: node.outerHTML });
      }
    });

    return { schema: 'rich-text-document', version: 1, blocks };
  }

  function jsonBlocksToHtml(data) {
    const blocks = Array.isArray(data) ? data : (data && Array.isArray(data.blocks) ? data.blocks : []);
    const html = [];
    blocks.forEach((block) => {
      if (!block || typeof block !== 'object') return;
      switch (block.type) {
        case 'paragraph':
          html.push(`<p>${block.content || '<br>'}</p>`);
          break;
        case 'heading': {
          const level = Math.min(6, Math.max(1, Number(block.level) || 1));
          html.push(`<h${level}>${block.content || ''}</h${level}>`);
          break;
        }
        case 'bulletList':
        case 'orderedList': {
          const tag = block.type === 'orderedList' ? 'ol' : 'ul';
          const items = Array.isArray(block.items) ? block.items : [];
          html.push(`<${tag}>${items.map((item) => `<li>${typeof item === 'string' ? item : (item && item.html) || '<br>'}</li>`).join('')}</${tag}>`);
          break;
        }
        case 'blockquote':
          html.push(`<blockquote>${block.content || '<p><br></p>'}</blockquote>`);
          break;
        case 'codeBlock':
          html.push(`<pre><code>${escapeHtml(block.content || '')}</code></pre>`);
          break;
        case 'divider':
          html.push('<hr>');
          break;
        case 'image': {
          if (!isSafeUrl(block.src, 'image')) break;
          const imageStyle = sanitizeStyle(block.style || 'max-width: 100%; height: auto');
          const figureStyle = sanitizeStyle(block.figureStyle || '');
          html.push(`<figure${figureStyle ? ` style="${escapeAttr(figureStyle)}"` : ''}><img src="${escapeAttr(block.src)}" alt="${escapeAttr(block.alt || '')}"${block.width ? ` width="${escapeAttr(block.width)}"` : ''}${block.height ? ` height="${escapeAttr(block.height)}"` : ''} style="${escapeAttr(imageStyle)}"></figure>`);
          break;
        }
        case 'table': {
          const rows = Array.isArray(block.rows) ? block.rows : [];
          const rowHtml = rows.map((row, rowIndex) => {
            // v4 compatibility: rows were arrays of cell HTML strings and the
            // first row was marked as a header through block.hasHeader.
            const cells = Array.isArray(row) ? row.map((cellHtml) => ({
              type: block.hasHeader && rowIndex === 0 ? 'th' : 'td', html: cellHtml
            })) : (Array.isArray(row.cells) ? row.cells : []);
            return `<tr>${cells.map((cell) => {
              const cellTag = cell.type === 'th' ? 'th' : 'td';
              const colspan = Number(cell.colspan) > 1 ? Number(cell.colspan) : 0;
              const rowspan = Number(cell.rowspan) > 1 ? Number(cell.rowspan) : 0;
              const attrs = `${colspan ? ` colspan="${colspan}"` : ''}${rowspan ? ` rowspan="${rowspan}"` : ''}`;
              return `<${cellTag}${attrs}>${cell.html || cell.content || '<br>'}</${cellTag}>`;
            }).join('')}</tr>`;
          }).join('');
          if (block.hasHeader && rows.length) {
            const boundary = rowHtml.indexOf('</tr>') + 5;
            html.push(`<table><thead>${rowHtml.slice(0, boundary)}</thead><tbody>${rowHtml.slice(boundary)}</tbody></table>`);
          } else {
            html.push(`<table><tbody>${rowHtml}</tbody></table>`);
          }
          break;
        }
        case 'html':
          html.push(String(block.html || ''));
          break;
        default:
          // v4 compatibility: tolerate an unknown type with an HTML payload.
          if (typeof block.html === 'string') html.push(block.html);
          else if (typeof block.content === 'string') html.push(`<p>${block.content}</p>`);
          break;
      }
    });
    return sanitizeRichTextHtml(html.join(''));
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rte-wrap { width:100%; position:relative; background:#fff; border:1px solid #d9dee7; border-radius:6px; color:#1f2937; }
      .rte-wrap:focus-within { border-color:#7ba4e8; box-shadow:0 0 0 2px rgba(37,99,235,.10); }
      .rte-compat-bar { display:flex; align-items:center; justify-content:flex-end; gap:8px; min-height:34px; padding:4px 9px; background:#f7f8fa; border-bottom:1px solid #e5e7eb; border-radius:5px 5px 0 0; }
      .rte-paste-toggle { display:inline-flex; align-items:center; gap:6px; min-height:25px; padding:3px 8px; border:1px solid #d1d5db; border-radius:4px; background:#fff; color:#374151; font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif; cursor:pointer; }
      .rte-paste-toggle:hover { background:#f1f5f9; border-color:#9ca3af; }
      .rte-paste-toggle[aria-pressed="true"] { background:#eaf1fb; color:#174ea6; border-color:#9bb8e6; }
      .rte-paste-toggle:focus-visible, .rte-context-menu button:focus-visible { outline:2px solid #2563eb; outline-offset:2px; }
      .rte-wrap .sun-editor { border:0 !important; border-radius:0 0 5px 5px !important; box-shadow:none !important; background:#fff !important; }
      .rte-wrap .se-toolbar { background:#f7f8fa !important; border:0 !important; border-bottom:1px solid #e5e7eb !important; padding:5px 7px !important; outline:0 !important; }
      .rte-wrap .se-btn-module-border { border-color:#e0e4ea !important; }
      .rte-wrap .se-btn { border-radius:4px !important; }
      .rte-wrap .se-btn:focus-visible { outline:2px solid #2563eb !important; outline-offset:1px !important; }
      .rte-wrap .se-btn:hover { background:#e9edf3 !important; }
      .rte-wrap .se-btn:active, .rte-wrap .se-btn.active { background:#e4ebf5 !important; }
      .rte-wrap .se-container { border:0 !important; background:#fff !important; }
      .rte-wrap .se-wrapper { min-height:200px; }
      .rte-wrap .sun-editor-editable { min-height:200px; padding:16px 18px !important; font-family:Arial,Helvetica,sans-serif !important; font-size:15px !important; line-height:1.65 !important; color:#1f2937 !important; overflow-wrap:anywhere; }
      .rte-wrap .sun-editor-editable p { margin:0 0 .8em; }
      .rte-wrap .sun-editor-editable h1,.rte-wrap .sun-editor-editable h2,.rte-wrap .sun-editor-editable h3 { color:#111827; line-height:1.3; }
      .rte-wrap .sun-editor-editable blockquote { margin:1em 0; padding:8px 14px; border-left:3px solid #94a3b8; background:#f7f8fa; color:#374151; }
      .rte-wrap .sun-editor-editable pre { padding:12px 14px; border-radius:4px; background:#f3f4f6; color:#111827; white-space:pre-wrap; }
      .rte-wrap .sun-editor-editable code { font-family:Consolas,"SFMono-Regular",monospace; background:#f1f3f5; border-radius:3px; padding:1px 4px; }
      .rte-wrap .sun-editor-editable pre code { background:transparent; padding:0; }
      .rte-wrap .sun-editor-editable table { border-collapse:collapse; width:100%; }
      .rte-wrap .sun-editor-editable th,.rte-wrap .sun-editor-editable td { border:1px solid #cbd5e1; padding:7px 9px; vertical-align:top; }
      .rte-wrap .sun-editor-editable th { background:#f1f5f9; font-weight:600; }
      .rte-wrap .se-resizing-bar { min-height:22px; background:#f7f8fa; border-top:1px solid #e5e7eb; }
      .rte-wrap .se-char-counter-wrapper { font:11px system-ui,-apple-system,"Segoe UI",sans-serif; color:#6b7280; }
      .rte-context-menu { position:fixed; z-index:2147483000; display:none; min-width:205px; padding:5px; background:#fff; border:1px solid #d1d5db; border-radius:6px; box-shadow:0 5px 18px rgba(15,23,42,.16); }
      .rte-context-menu.is-open { display:block; }
      .rte-context-menu button { display:block; width:100%; border:0; border-radius:4px; padding:7px 10px; background:transparent; color:#1f2937; text-align:left; font:13px system-ui,-apple-system,"Segoe UI",sans-serif; cursor:pointer; }
      .rte-context-menu button:hover { background:#f1f5f9; }
      .rte-context-menu button[data-danger="true"] { color:#b42318; }
      .rte-context-divider { height:1px; margin:4px 3px; background:#e5e7eb; }
      .rte-load-error { padding:9px 11px; color:#991b1b; background:#fef2f2; border-top:1px solid #fecaca; font:12px system-ui,-apple-system,"Segoe UI",sans-serif; }
      .rte-wrap .se-wrapper-inner { overflow:visible; }
      @media (max-width:640px) {
        .rte-wrap .se-toolbar { padding:4px !important; }
        .rte-wrap .sun-editor-editable { padding:12px !important; }
        .rte-context-menu { min-width:185px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureEngineAssets() {
    if (window.SUNEDITOR && typeof window.SUNEDITOR.create === 'function') {
      ensureEngineStylesheet();
      return Promise.resolve(window.SUNEDITOR);
    }
    if (engineLoadPromise) return engineLoadPromise;
    ensureEngineStylesheet();
    engineLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rte-suneditor-engine]');
      const script = existing || document.createElement('script');
      const finish = () => {
        if (window.SUNEDITOR && typeof window.SUNEDITOR.create === 'function') resolve(window.SUNEDITOR);
        else reject(new Error('SunEditor loaded but did not expose SUNEDITOR.create().'));
      };
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', () => reject(new Error('Could not load the SunEditor engine from jsDelivr.')), { once: true });
      if (!existing) {
        script.src = ENGINE_JS;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.rteSuneditorEngine = 'true';
        document.head.appendChild(script);
      }
    }).catch((error) => {
      engineLoadPromise = null;
      throw error;
    });
    return engineLoadPromise;
  }

  function ensureEngineStylesheet() {
    if (document.querySelector('link[data-rte-suneditor-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = ENGINE_CSS;
    link.crossOrigin = 'anonymous';
    link.dataset.rteSuneditorCss = 'true';
    document.head.appendChild(link);
  }

  function findEditable(root, engine) {
    try {
      const editable = engine && engine.$ && engine.$.frameContext && engine.$.frameContext.get('wysiwyg');
      if (editable && editable.isContentEditable) return editable;
    } catch (_) { /* frame context may not be initialized yet */ }
    return root.querySelector('.sun-editor-editable[contenteditable="true"]') ||
      root.querySelector('[contenteditable="true"]');
  }

  function setCaretAt(node, offset) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.setStart(node, Math.max(0, Math.min(offset, node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length)));
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function getCurrentCell(target) {
    const node = target && (target.nodeType === Node.TEXT_NODE ? target.parentElement : target);
    return node && node.closest ? node.closest('td, th') : null;
  }

  function insertPlainTextAtSelection(editable, text, engine, maxLength) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    if (!editable.contains(range.commonAncestorContainer)) return false;

    let value = String(text || '').replace(/\r\n?/g, '\n');
    if (Number.isFinite(maxLength) && maxLength > 0) {
      const currentLength = stripHtml(editable.innerHTML).length;
      const selectedLength = range.toString().length;
      const available = Math.max(0, maxLength - currentLength + selectedLength);
      value = Array.from(value).slice(0, available).join('');
    }

    range.deleteContents();
    const fragment = document.createDocumentFragment();
    const pieces = value.split('\n');
    pieces.forEach((piece, index) => {
      if (piece) fragment.appendChild(document.createTextNode(piece));
      if (index < pieces.length - 1) fragment.appendChild(document.createElement('br'));
    });
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) setCaretAfter(lastNode);
    else range.collapse(true);
    try { engine.$.history.push(false); } catch (_) { /* engine history may not yet be initialized */ }
    return true;
  }

  function setCaretAfter(node) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function currentLineAndText(editable) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!editable.contains(range.startContainer) || range.startContainer.nodeType !== Node.TEXT_NODE) return null;
    const textNode = range.startContainer;
    const prefix = textNode.textContent.slice(0, range.startOffset);
    const block = textNode.parentElement && textNode.parentElement.closest('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,div');
    if (!block || !editable.contains(block)) return null;
    return { textNode, prefix, offset: range.startOffset, block };
  }

  function applyMarkdownShortcut(engine, editable, event) {
    if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) return false;
    const current = currentLineAndText(editable);
    if (!current) return false;
    const match = current.prefix.match(/^(\s*)(#{1,3}|[-*]|1\.)$/);
    if (!match || current.block.textContent.trim() !== match[0].trim()) return false;
    event.preventDefault();
    current.textNode.deleteData(0, current.offset);
    const marker = match[2];
    try {
      if (marker === '#') engine.$.format.setLine(document.createElement('H1'));
      else if (marker === '##') engine.$.format.setLine(document.createElement('H2'));
      else if (marker === '###') engine.$.format.setLine(document.createElement('H3'));
      else if (marker === '-' || marker === '*') engine.$.plugins.list_bulleted.submit();
      else if (marker === '1.') engine.$.plugins.list_numbered.submit();
      engine.$.history.push(false);
    } catch (error) {
      // If the engine command cannot apply in this caret context, restore the marker.
      current.textNode.insertData(0, marker);
      return false;
    }
    return true;
  }

  function applyInlineCodeShortcut(engine, editable) {
    const current = currentLineAndText(editable);
    if (!current) return false;
    const match = current.prefix.match(/(^|\s)`([^`\n]+)`$/);
    if (!match) return false;
    const openAt = current.prefix.length - match[0].length + match[1].length;
    const closeAt = current.offset;
    const range = document.createRange();
    range.setStart(current.textNode, openAt);
    range.setEnd(current.textNode, closeAt);
    range.deleteContents();
    const code = document.createElement('code');
    code.textContent = match[2];
    range.insertNode(code);
    setCaretAfter(code);
    try { engine.$.history.push(false); } catch (_) { /* no-op */ }
    return true;
  }

  function buildContextMenu(onAction) {
    const menu = document.createElement('div');
    menu.className = 'rte-context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Table actions');
    menu.dataset.rteUi = 'true';
    const items = [
      ['insert-row-above', 'Insert row above'],
      ['insert-row-below', 'Insert row below'],
      ['insert-column-left', 'Insert column left'],
      ['insert-column-right', 'Insert column right'],
      ['divider', ''],
      ['delete-row', 'Delete row'],
      ['delete-column', 'Delete column'],
      ['delete-table', 'Delete table']
    ];
    items.forEach(([action, label]) => {
      if (action === 'divider') {
        const divider = document.createElement('div');
        divider.className = 'rte-context-divider';
        divider.setAttribute('role', 'separator');
        menu.appendChild(divider);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.textContent = label;
      button.setAttribute('role', 'menuitem');
      if (action.startsWith('delete')) button.dataset.danger = 'true';
      button.addEventListener('click', () => onAction(action));
      menu.appendChild(button);
    });
    document.body.appendChild(menu);
    return menu;
  }

  function performTableAction(action, context, engine, sync, closeMenu) {
    if (!context || !context.table || !context.table.isConnected || !context.cell || !context.cell.isConnected) return;
    const table = context.table;
    const cell = context.cell;

    // Prefer SunEditor's table model. It handles rowspan/colspan, cell state,
    // table selection, and its own component wrappers. A small DOM fallback is
    // retained for engine builds where those plugin methods are not exposed.
    const plugin = engine && engine.$ && engine.$.plugins && engine.$.plugins.table;
    const grid = plugin && plugin.gridService;
    if (plugin && grid && typeof plugin.setCellInfo === 'function' && typeof grid.editTable === 'function') {
      try {
        plugin.setCellInfo(cell, true);
        switch (action) {
          case 'insert-row-above': grid.editTable('row', 'up'); break;
          case 'insert-row-below': grid.editTable('row', 'down'); break;
          case 'insert-column-left': grid.editTable('cell', 'left'); break;
          case 'insert-column-right': grid.editTable('cell', 'right'); break;
          case 'delete-row': grid.editTable('row', null); break;
          case 'delete-column': grid.editTable('cell', null); break;
          case 'delete-table':
            if (typeof plugin.componentDestroy === 'function') {
              plugin.componentDestroy(table.closest('figure') || table);
            } else {
              (table.closest('figure') || table).remove();
              try { engine.$.history.push(false); } catch (_) { /* optional */ }
            }
            break;
          default: return;
        }
        if (action !== 'delete-table' && typeof plugin.historyPush === 'function') plugin.historyPush();
        closeMenu();
        sync();
        return;
      } catch (error) {
        console.warn('RichTextEditor: SunEditor table operation fell back to DOM editing.', error);
      }
    }

    const row = cell.parentElement;
    const rowIndex = row.rowIndex;
    const cellIndex = cell.cellIndex;
    let focusTarget = null;
    if (action === 'insert-row-above' || action === 'insert-row-below') {
      const newRow = table.insertRow(rowIndex + (action === 'insert-row-below' ? 1 : 0));
      const columns = Math.max(1, table.rows[0] ? table.rows[0].cells.length : row.cells.length);
      for (let i = 0; i < columns; i++) {
        const sample = row.cells[Math.min(i, row.cells.length - 1)];
        const newCell = document.createElement(sample && sample.tagName === 'TH' ? 'th' : 'td');
        newCell.innerHTML = '<br>';
        newRow.appendChild(newCell);
        if (!focusTarget) focusTarget = newCell;
      }
    } else if (action === 'insert-column-left' || action === 'insert-column-right') {
      Array.from(table.rows).forEach((tableRow) => {
        const sample = tableRow.cells[Math.min(cellIndex, tableRow.cells.length - 1)];
        const newCell = document.createElement(sample && sample.tagName === 'TH' ? 'th' : 'td');
        newCell.innerHTML = '<br>';
        const insertAt = Math.min(tableRow.cells.length, cellIndex + (action === 'insert-column-right' ? 1 : 0));
        if (tableRow.cells[insertAt]) tableRow.insertBefore(newCell, tableRow.cells[insertAt]);
        else tableRow.appendChild(newCell);
        if (!focusTarget) focusTarget = newCell;
      });
    } else if (action === 'delete-row') {
      if (table.rows.length <= 1) (table.closest('figure') || table).remove();
      else {
        const nextRow = table.rows[rowIndex + 1] || table.rows[rowIndex - 1];
        table.deleteRow(rowIndex);
        focusTarget = nextRow && nextRow.cells[Math.min(cellIndex, nextRow.cells.length - 1)];
      }
    } else if (action === 'delete-column') {
      const maxColumns = Math.max.apply(null, Array.from(table.rows).map((r) => r.cells.length));
      if (maxColumns <= 1) (table.closest('figure') || table).remove();
      else {
        Array.from(table.rows).forEach((tableRow) => {
          if (tableRow.cells[cellIndex]) tableRow.deleteCell(cellIndex);
        });
        const firstRow = table.rows[0];
        focusTarget = firstRow && firstRow.cells[Math.min(cellIndex, firstRow.cells.length - 1)];
      }
    } else if (action === 'delete-table') {
      (table.closest('figure') || table).remove();
    }
    if (focusTarget && focusTarget.isConnected) {
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus();
      const range = document.createRange();
      range.selectNodeContents(focusTarget);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    try { engine.$.history.push(false); } catch (_) { /* native engine history is best-effort for direct table DOM operations */ }
    closeMenu();
    sync();
  }

  function createToolbarConfig(options) {
    const blockItems = options.blockFormats || ['p', 'h1', 'h2', 'h3', 'blockquote', 'pre'];
    return {
      plugins: window.SUNEDITOR.plugins,
      mode: 'classic',
      width: '100%',
      minHeight: options.minHeight || '200px',
      height: 'auto',
      iframe: false,
      value: sanitizeRichTextHtml(options.initialHtml || ''),
      placeholder: options.placeholder || '',
      editableFrameAttributes: {
        spellcheck: 'true',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': options.label || 'Rich text editor'
      },
      buttonList: [
        ['undo', 'redo'],
        ['blockStyle'],
        ['bold', 'italic', 'underline', 'strike'],
        ['textStyle'],
        ['fontColor', 'backgroundColor'],
        ['align'],
        ['list_bulleted', 'list_numbered', 'outdent', 'indent'],
        ['table', 'link', 'image'],
        ['codeBlock', 'hr', 'removeFormat']
      ],
      blockStyle: { items: blockItems },
      textStyle: { items: [{ name: 'Inline code', class: 'rte-inline-code', tag: 'code' }] },
      image: {
        canResize: true,
        showHeightInput: true,
        createFileInput: false,
        createUrlInput: true,
        useFormatType: true,
        defaultFormatType: 'block',
        insertBehavior: 'auto'
      },
      link: { textToDisplay: true, openNewWindow: true, noAutoPrefix: true },
      table: { scrollType: 'x', cellControllerPosition: 'cell', tableControllerPosition: 'table' },
      slashCommand_triggerChar: '/',
      slashCommand_items: ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'blockquote', 'pre', 'table', 'image', 'link', 'hr'],
      slashCommand_emptyMessage: 'No commands found',
      slashCommand_maxHeight: '300px',
      slashCommand_minWidth: '235px',
      historyStackSize: 120,
      charCounter: Number.isFinite(options.maxLength) && options.maxLength > 0,
      charCounter_max: Number.isFinite(options.maxLength) && options.maxLength > 0 ? options.maxLength : null,
      charCounter_type: 'char',
      wordCounter: !!options.wordCount,
      statusbar: Number.isFinite(options.maxLength) && options.maxLength > 0 || !!options.wordCount,
      statusbar_showPathLabel: false,
      statusbar_resizeEnable: false,
      lineBreakClearStyle: true,
      allowedURLProtocols: [],
      events: {
        onChange: (event) => {
          if (typeof options.__rteSync === 'function') options.__rteSync(event && typeof event.data === 'string' ? event.data : null);
        },
        onload: () => {
          if (typeof options.__rteLoaded === 'function') options.__rteLoaded();
        }
      }
    };
  }

  function mount(options) {
    options = options || {};
    ensureStyles();
    const input = document.getElementById(options.inputId);
    if (!input) {
      console.warn(`RichTextEditor: No element found with id "${options.inputId || ''}"`);
      return null;
    }
    const mounted = instancesByInput.get(input);
    if (mounted && !mounted.destroyed) return mounted.api;

    const originalParent = input.parentNode;
    const originalNextSibling = input.nextSibling;
    const originalStyle = input.getAttribute('style');
    const originalAriaHidden = input.getAttribute('aria-hidden');
    const originalRequired = input.hasAttribute('required');
    const initialHtml = sanitizeRichTextHtml(input.value || '');
    input.value = initialHtml;
    const maxLength = Number.isFinite(Number(options.maxLength)) && Number(options.maxLength) > 0
      ? Number(options.maxLength) : null;

    const wrapper = document.createElement('div');
    wrapper.className = 'rte-wrap';
    wrapper.dataset.rteVersion = VERSION;
    wrapper.setAttribute('data-rte-instance', '');
    const compatBar = document.createElement('div');
    compatBar.className = 'rte-compat-bar';
    const pasteButton = document.createElement('button');
    pasteButton.type = 'button';
    pasteButton.className = 'rte-paste-toggle';
    pasteButton.textContent = 'No-format paste';
    pasteButton.setAttribute('aria-pressed', String(!!options.noFormatPaste));
    pasteButton.setAttribute('aria-label', 'Toggle plain-text paste');
    pasteButton.title = options.plainPaste ? 'Plain-text paste is forced by the plainPaste compatibility option.' : 'When enabled, pasted content is inserted as plain text.';
    pasteButton.disabled = !!options.plainPaste;
    compatBar.appendChild(pasteButton);
    const mountPoint = document.createElement('div');
    mountPoint.className = 'rte-engine-mount';
    mountPoint.setAttribute('aria-label', options.label || 'Rich text editor');
    wrapper.append(compatBar, mountPoint);

    originalParent.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.style.display = 'none';
    input.setAttribute('aria-hidden', 'true');
    if (originalRequired) input.removeAttribute('required');

    const state = {
      destroyed: false,
      engine: null,
      editable: null,
      error: null,
      noFormatPaste: !!options.noFormatPaste,
      pendingHtml: null,
      context: null,
      observer: null,
      readyResolve: null,
      readyReject: null,
      callbacksBound: false,
      documentPasteHandler: null,
      documentKeyHandler: null
    };

    const ready = new Promise((resolve, reject) => {
      state.readyResolve = resolve;
      state.readyReject = reject;
    });
    // Avoid an unhandled rejection if an application does not consume .ready.
    ready.catch(() => {});

    function currentHtml() {
      if (state.editable) return sanitizeRichTextHtml(state.editable.innerHTML);
      return sanitizeRichTextHtml(input.value || '');
    }

    let lastSyncedHtml = initialHtml;
    function updateCompatibilityCounter(html, force) {
      // SunEditor's own counter enforces maxLength and word-count options. This
      // adapter keeps the form field and the legacy onChange callback synchronized.
      const clean = html == null ? currentHtml() : sanitizeRichTextHtml(html);
      input.value = clean;
      if (!force && clean === lastSyncedHtml) return clean;
      lastSyncedHtml = clean;
      const plain = stripHtml(clean);
      if (typeof options.onChange === 'function') {
        try { options.onChange(clean, plain); }
        catch (error) { console.error('RichTextEditor onChange callback failed:', error); }
      }
      return clean;
    }

    function sync(html, force) {
      if (state.destroyed) return;
      updateCompatibilityCounter(html, !!force);
    }

    function closeTableMenu() {
      if (!state.context || !state.context.menu) return;
      state.context.menu.classList.remove('is-open');
      state.context.cell = null;
      state.context.table = null;
    }

    function attachTableContextMenu() {
      const menu = buildContextMenu((action) => {
        performTableAction(action, state.context, state.engine, sync, closeTableMenu);
      });
      wrapper.appendChild(menu);
      state.context = { menu, cell: null, table: null };
      wrapper.addEventListener('contextmenu', (event) => {
        const cell = getCurrentCell(event.target);
        if (!cell || !state.editable || !state.editable.contains(cell)) {
          closeTableMenu();
          return;
        }
        const table = cell.closest('table');
        if (!table) return;
        event.preventDefault();
        state.context.cell = cell;
        state.context.table = table;
        menu.classList.add('is-open');
        const width = 220;
        const height = 255;
        menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8))}px`;
        const first = menu.querySelector('button');
        if (first) first.focus();
      });
      wrapper.addEventListener('click', (event) => {
        if (!menu.contains(event.target)) closeTableMenu();
      });
      wrapper.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && menu.classList.contains('is-open')) {
          closeTableMenu();
          state.editable && state.editable.focus();
        }
      });
      window.addEventListener('scroll', closeTableMenu, true);
    }

    function removeUnsafeLiveLinks() {
      if (!state.editable) return;
      state.editable.querySelectorAll('a[href]').forEach((anchor) => {
        if (!isSafeUrl(anchor.getAttribute('href'), 'link')) anchor.removeAttribute('href');
      });
      state.editable.querySelectorAll('img[src]').forEach((image) => {
        if (!isSafeUrl(image.getAttribute('src'), 'image')) image.remove();
      });
    }

    function attachEditingBehaviors() {
      if (state.callbacksBound || !state.editable) return;
      state.callbacksBound = true;
      const editable = state.editable;

      state.documentPasteHandler = (event) => {
        if (!editable.contains(event.target)) return;
        if (!state.noFormatPaste && !options.plainPaste) return;
        const clipboard = event.clipboardData || window.clipboardData;
        if (!clipboard) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const plain = clipboard.getData('text/plain');
        if (insertPlainTextAtSelection(editable, plain, state.engine, maxLength)) sync();
      };
      // Capture at document level so the plain-paste override runs before the
      // editor engine's own paste pipeline, not after its target/bubble handlers.
      document.addEventListener('paste', state.documentPasteHandler, true);

      state.documentKeyHandler = (event) => {
        if (!editable.contains(event.target)) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          event.stopImmediatePropagation();
          try { state.engine.$.plugins.link.open(); }
          catch (_) { /* toolbar link control remains available */ }
        }
      };
      document.addEventListener('keydown', state.documentKeyHandler, true);

      editable.addEventListener('keydown', (event) => {
        if (applyMarkdownShortcut(state.engine, editable, event)) {
          sync();
          return;
        }
      });

      editable.addEventListener('input', () => {
        if (applyInlineCodeShortcut(state.engine, editable)) {
          sync();
          return;
        }
        // SunEditor's own paste pipeline and HTML cleaner handle rich content.
        // This small check prevents unsafe live links/images from remaining active.
        removeUnsafeLiveLinks();
        sync();
      });

      editable.addEventListener('click', (event) => {
        const link = event.target && event.target.closest ? event.target.closest('a') : null;
        if (link && !isSafeUrl(link.getAttribute('href'), 'link')) event.preventDefault();
      });

      attachTableContextMenu();
    }

    function exposeReady() {
      if (state.destroyed || state.editable) return;
      state.editable = findEditable(wrapper, state.engine);
      if (!state.editable) return;
      state.editable.setAttribute('role', 'textbox');
      state.editable.setAttribute('aria-multiline', 'true');
      state.editable.setAttribute('aria-label', options.label || 'Rich text editor');
      state.editable.setAttribute('spellcheck', 'true');
      attachEditingBehaviors();
      if (state.pendingHtml !== null) {
        state.editable.innerHTML = sanitizeRichTextHtml(state.pendingHtml);
        state.pendingHtml = null;
        try { state.engine.$.history.reset(); } catch (_) { /* optional */ }
      }
      sync();
      if (state.readyResolve) state.readyResolve(api);
      state.readyResolve = null;
      state.readyReject = null;
    }

    function showLoadError(error) {
      if (state.destroyed || state.error) return;
      state.error = error;
      const message = document.createElement('div');
      message.className = 'rte-load-error';
      message.setAttribute('role', 'alert');
      message.textContent = 'The rich text editor could not load. The original text field has been restored.';
      wrapper.insertBefore(message, mountPoint);
      if (originalStyle === null) input.removeAttribute('style');
      else input.setAttribute('style', originalStyle);
      if (originalAriaHidden === null) input.removeAttribute('aria-hidden');
      else input.setAttribute('aria-hidden', originalAriaHidden);
      if (originalRequired) input.setAttribute('required', '');
      if (state.readyReject) state.readyReject(error);
      state.readyResolve = null;
      state.readyReject = null;
    }

    function initializeEngine(SUNEDITOR) {
      if (state.destroyed) return;
      const config = createToolbarConfig({
        ...options,
        initialHtml,
        maxLength,
        __rteSync: sync,
        __rteLoaded: exposeReady
      });
      try {
        state.engine = SUNEDITOR.create(mountPoint, config);
        // The frame is created synchronously in current SunEditor releases, but
        // initialization finishes on the next task. Check immediately and retry
        // briefly to support slower browser/device initialization.
        let attempts = 0;
        const poll = () => {
          if (state.destroyed || state.editable) return;
          exposeReady();
          if (!state.editable && attempts++ < 200) window.setTimeout(poll, 25);
          else if (!state.editable) showLoadError(new Error('SunEditor did not create an editable surface.'));
        };
        poll();
      } catch (error) {
        showLoadError(error);
      }
    }

    pasteButton.addEventListener('click', () => {
      if (options.plainPaste) return;
      state.noFormatPaste = !state.noFormatPaste;
      pasteButton.setAttribute('aria-pressed', String(state.noFormatPaste));
    });

    // The existing application replaces modal/form contents with innerHTML in
    // several places and does not consistently call destroy(). Observe removal
    // of this instance's wrapper so global capture listeners and editor resources
    // are still released when a containing form is re-rendered.
    if (typeof window.MutationObserver === 'function' && document.documentElement) {
      state.observer = new MutationObserver(() => {
        if (state.destroyed || wrapper.isConnected) return;
        state.destroyed = true;
        closeTableMenu();
        window.removeEventListener('scroll', closeTableMenu, true);
        if (state.engine && typeof state.engine.destroy === 'function') {
          try { state.engine.destroy(); } catch (_) { /* detached UI is already gone */ }
        }
        if (state.documentPasteHandler) document.removeEventListener('paste', state.documentPasteHandler, true);
        if (state.documentKeyHandler) document.removeEventListener('keydown', state.documentKeyHandler, true);
        if (state.context && state.context.menu) state.context.menu.remove();
        state.observer.disconnect();
        instancesByInput.delete(input);
      });
      state.observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    const api = {
      ready,
      version: VERSION,
      getHtml: () => currentHtml(),
      getText: () => stripHtml(currentHtml()),
      setHtml: (html) => {
        const clean = sanitizeRichTextHtml(html || '');
        state.pendingHtml = clean;
        input.value = clean;
        if (state.editable) {
          state.editable.innerHTML = clean;
          state.pendingHtml = null;
          try { state.engine.$.history.reset(); } catch (_) { /* optional */ }
          sync(clean, true);
        }
      },
      // getJson() retains the original v4 array schema. The versioned schema is
      // available through getJsonDocument(); setJson() accepts either format.
      getJson: () => domToJsonBlocks(currentHtml()),
      getJsonDocument: () => htmlToDocument(currentHtml()),
      setJson: (data) => {
        const html = jsonBlocksToHtml(data);
        api.setHtml(html);
      },
      getNoFormatPaste: () => state.noFormatPaste,
      setNoFormatPaste: (value) => {
        state.noFormatPaste = !!value;
        pasteButton.setAttribute('aria-pressed', String(state.noFormatPaste));
      },
      focus: () => {
        if (state.editable) state.editable.focus();
        else mountPoint.focus();
      },
      clear: () => api.setHtml(''),
      getElement: () => state.editable || mountPoint,
      destroy: () => {
        if (state.destroyed) return;
        state.destroyed = true;
        closeTableMenu();
        window.removeEventListener('scroll', closeTableMenu, true);
        if (state.engine && typeof state.engine.destroy === 'function') {
          try { state.engine.destroy(); } catch (_) { /* continue restoring source input */ }
        }
        if (state.context && state.context.menu) state.context.menu.remove();
        if (state.documentPasteHandler) document.removeEventListener('paste', state.documentPasteHandler, true);
        if (state.documentKeyHandler) document.removeEventListener('keydown', state.documentKeyHandler, true);
        if (state.observer) state.observer.disconnect();
        if (wrapper.parentNode) wrapper.remove();
        if (originalParent) {
          if (originalNextSibling && originalNextSibling.parentNode === originalParent) originalParent.insertBefore(input, originalNextSibling);
          else originalParent.appendChild(input);
        }
        if (originalStyle === null) input.removeAttribute('style');
        else input.setAttribute('style', originalStyle);
        if (originalAriaHidden === null) input.removeAttribute('aria-hidden');
        else input.setAttribute('aria-hidden', originalAriaHidden);
        if (originalRequired) input.setAttribute('required', '');
        instancesByInput.delete(input);
      }
    };

    instancesByInput.set(input, { api, destroyed: false });

    ensureEngineAssets().then(initializeEngine).catch(showLoadError);
    return api;
  }

  function domToJsonBlocks(editorRoot) {
    const source = typeof editorRoot === 'string'
      ? editorRoot
      : (editorRoot && typeof editorRoot.innerHTML === 'string' ? editorRoot.innerHTML : '');
    const documentData = htmlToDocument(source);
    return documentData.blocks.map((block) => {
      if (block.type === 'table') {
        const rows = (block.rows || []).map((row) => (row.cells || []).map((cell) => cell.html || ''));
        const hasHeader = !!(block.rows && block.rows[0] && block.rows[0].cells &&
          block.rows[0].cells.some((cell) => cell.type === 'th'));
        return { type: 'table', hasHeader, rows };
      }
      if (block.type === 'image') {
        return { type: 'image', src: block.src, alt: block.alt, style: block.style || '' };
      }
      if (block.type === 'html') return block;
      return block;
    });
  }

  window.RichTextEditor = {
    version: VERSION,
    engine: `SunEditor ${ENGINE_VERSION}`,
    mount,
    sanitizeRichTextHtml,
    stripHtml,
    domToJsonBlocks,
    jsonBlocksToHtml,
    htmlToDocument,
    isSafeUrl
  };
})(window, document);
