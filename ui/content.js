/**
 * Content: the models, a model's entries, and one entry as a dashboard.
 *
 * The entry shows every field of its model with its value: text fields edit in place, rich
 * text edits as HTML, numbers and switches as themselves, anything else as JSON. Save writes
 * only the data. Publish, Unpublish, Delete, the preview URLs, and an AI panel that reviews
 * the entry or writes a field from what you typed.
 */
import { ago, stripHtml, waitForTask } from './helpers.js';
import { Panel, Stat, Health, List, ListRow } from './kit.js';
import { modelRow, entryRow, statusColour } from './overview.js';

export function Models({ host, health, q, onOpen }) {
  const { h, ui } = host;
  const { data } = health;
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const empty = (text) => h('p', { className: 'mlead', style: { margin: 0 } }, text);
  const models = (data ? data.models || [] : []).filter((m) => !q || m.name.toLowerCase().includes(q));
  const kinds = ['page', 'section', 'data'];
  const group = (k) => models.filter((m) => (kinds.includes(m.kind) ? m.kind === k : k === 'data'));
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    h('div', { className: 'mstats mstats--head' },
      Stat(host, { label: 'Models', value: !data ? '...' : models.length, tone: 'brass' }),
      Stat(host, { label: 'Pages', value: !data ? '...' : group('page').reduce((n, m) => n + m.total, 0), tone: 'muted', hint: `${group('page').length} page model${group('page').length === 1 ? '' : 's'}` }),
      Stat(host, { label: 'Sections', value: !data ? '...' : group('section').reduce((n, m) => n + m.total, 0), tone: 'muted', hint: `${group('section').length} section model${group('section').length === 1 ? '' : 's'}` }),
      Stat(host, { label: 'Data', value: !data ? '...' : group('data').reduce((n, m) => n + m.total, 0), tone: 'muted', hint: `${group('data').length} data model${group('data').length === 1 ? '' : 's'}` })),
    ...kinds.map((k) => group(k).length ? Panel(host, { key: k, title: `${k[0].toUpperCase() + k.slice(1)} models`, wide: true, action: meta(`${group(k).length}`) }, List(host, group(k).sort((a, b) => b.total - a.total).map((m) => modelRow(host, m, onOpen)))) : null),
    !data ? Panel(host, { title: 'Models', wide: true }, h(ui.Skeleton, { count: 6, height: 18 })) : !models.length ? Panel(host, { title: 'Models', wide: true }, empty('No model matches.')) : null);
}

export function Entries({ host, bio, space, model, modelRow: m, q, onOpen }) {
  const { h, ui } = host;
  const { useState, useEffect } = host.react;
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => { setData(null); bio(`/entries?model=${encodeURIComponent(model)}&q=${encodeURIComponent(q || '')}&status=${status}&limit=50&offset=${page * 50}`).then(setData).catch((e) => setData({ error: e.message, entries: [] })); }, [model, q, status, page, space]);
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const empty = (text) => h('p', { className: 'mlead', style: { margin: 0 } }, text);
  const list = data ? data.entries || [] : [];
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    h('div', { className: 'mstats mstats--head' },
      Stat(host, { label: 'Entries', value: !data ? '...' : data.total, tone: 'brass' }),
      Stat(host, { label: 'Published', value: !data ? '...' : data.published, tone: 'moss' }),
      Stat(host, { label: 'Drafts', value: !data ? '...' : data.drafts, tone: data && data.drafts ? 'brass' : 'muted' }),
      Stat(host, { label: 'Fields', value: m ? m.fieldCount : '-', tone: 'muted', hint: m ? m.kind : undefined })),
    Panel(host, { title: 'Entries', wide: true, action: h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } },
      [['', 'All'], ['published', 'Published'], ['draft', 'Drafts']].map(([k, l]) => h(ui.Chip, { key: k, on: status === k, onClick: () => { setStatus(k); setPage(0); } }, l)),
      data && data.total > 50 ? h('span', { className: 'mpanel__meta', style: { marginLeft: 8 } }, `${page * 50 + 1}-${Math.min((page + 1) * 50, data.total)} of ${data.total}`) : null,
      data && page > 0 ? h(ui.Button, { className: 'sy-btn--sm', onClick: () => setPage(page - 1) }, 'Newer') : null,
      data && (page + 1) * 50 < data.total ? h(ui.Button, { className: 'sy-btn--sm', onClick: () => setPage(page + 1) }, 'Older') : null) },
      !data ? h(ui.Skeleton, { count: 8, height: 18 }) : data.error ? empty(data.error) : list.length ? List(host, list.map((e) => ListRow(host, { key: e.id, lead: h('span', { className: 'mind-dot', style: { background: statusColour(e) } }), label: e.name, sub: `${e.published === 'published' ? 'published' : 'draft'}${e.url ? ` - ${e.url}` : ''}${e.title && e.title !== e.name ? ` - ${e.title}` : ''}`, meta: e.lastUpdated ? ago(e.lastUpdated) : '', onClick: () => onOpen(e.id) }))) : empty(q ? 'Nothing matches.' : 'No entry in this model yet.')));
}

export function ContentAside({ host, health, openModel, onOpenModel, onOpenEntry }) {
  const { h, ui } = host;
  const { data } = health;
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const FILL = { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }, bodyStyle: { flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' } };
  const models = data ? data.models || [] : [];
  const m = openModel ? models.find((x) => x.name === openModel) : null;
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)', flex: 1, minHeight: 0, height: '100%' } },
    m ? Panel(host, { title: 'This model', action: meta(m.kind) }, h(ui.InfoGrid, { items: [{ label: 'Entries', value: m.total }, { label: 'Published', value: m.published }, { label: 'Drafts', value: m.drafts }, { label: 'Stale', value: m.stale || 0 }, { label: 'Missing alt', value: m.missingAlt || 0 }, { label: 'Fields', value: m.fieldCount }] })) : null,
    Panel(host, { title: 'Models', ...FILL, action: meta(data ? `${models.length}` : '...') },
      !data ? h(ui.Skeleton, { count: 6, height: 16 }) : List(host, models.slice().sort((a, b) => a.name.localeCompare(b.name)).map((x) => ListRow(host, { key: x.name, lead: h('span', { className: 'mind-dot', style: { background: x.name === openModel ? 'var(--sy-brass)' : 'var(--sy-text-3)' } }), label: x.name, sub: `${x.kind} - ${x.total}`, onClick: () => onOpenModel(x.name) })))),
    !openModel && data && (data.recent || []).length ? Panel(host, { title: 'Changed last', ...FILL, action: meta(`${data.recent.length}`) }, List(host, data.recent.slice(0, 8).map((e) => entryRow(host, e, onOpenEntry)))) : null);
}

export function useEntry(host, bio, open) {
  const { react } = host;
  const { useState, useEffect, useCallback } = react;
  const [data, setData] = useState(null);
  const [model, setModel] = useState(null);
  const [previews, setPreviews] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(() => {
    if (!open) return;
    setError(null);
    bio(`/content/${encodeURIComponent(open.model)}/${encodeURIComponent(open.id)}`).then((d) => { if (!d) throw new Error('Entry not found'); setData(d); }).catch((e) => setError(e.message));
    bio('/models').then((ms) => setModel((ms || []).find((m) => m.name === open.model) || null)).catch(() => setModel(null));
    bio(`/preview-url?model=${encodeURIComponent(open.model)}&entryId=${encodeURIComponent(open.id)}`).then(setPreviews).catch(() => setPreviews({ urls: [] }));
  }, [bio, open && open.model, open && open.id]);
  useEffect(() => { setData(null); setModel(null); setPreviews(null); reload(); }, [reload]);
  return { data, model, previews, error, reload };
}

const TEXT = new Set(['text', 'string', 'longText', 'url', 'email', 'color', 'date', 'html', 'richText']);
const isLocalized = (v) => v && typeof v === 'object' && v['@type'] === '@builder.io/core:LocalizedValue';

/** A small rich-text editor: bold, italic, heading, list, link, and an HTML toggle. Emits HTML. */
function RichText({ host, value, onChange }) {
  const { h, react, tokens } = host;
  const { useRef, useEffect, useState } = react;
  const ref = useRef(null);
  const [html, setHtml] = useState(false);
  useEffect(() => { if (!html && ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || ''; }, [value, html]);
  const cmd = (name, arg) => { ref.current && ref.current.focus(); document.execCommand(name, false, arg); onChange(ref.current ? ref.current.innerHTML : ''); };
  const tool = (label, fn, title) => h('button', { type: 'button', className: 'sy-btn sy-btn--sm', title, onMouseDown: (e) => e.preventDefault(), onClick: fn }, label);
  return h('div', { style: { border: `1px solid ${tokens('line')}`, borderRadius: 6, background: 'var(--sy-surface)' } },
    h('div', { style: { display: 'flex', gap: 4, padding: 4, borderBottom: `1px solid ${tokens('line')}`, flexWrap: 'wrap' } },
      tool('B', () => cmd('bold'), 'Bold'), tool('I', () => cmd('italic'), 'Italic'), tool('H2', () => cmd('formatBlock', 'h2'), 'Heading'), tool('P', () => cmd('formatBlock', 'p'), 'Paragraph'), tool('List', () => cmd('insertUnorderedList'), 'Bulleted list'), tool('Link', () => { const u = window.prompt('Link to'); if (u) cmd('createLink', u); }, 'Link'), tool('Clear', () => cmd('removeFormat'), 'Remove formatting'),
      h('span', { style: { flex: 1 } }), tool(html ? 'Rich' : 'HTML', () => setHtml(!html), html ? 'Back to rich text' : 'Edit the HTML')),
    html ? h(host.ui.CodeEditor, { value: value || '', language: 'html', height: 220, onChange })
      : h('div', { ref, contentEditable: true, suppressContentEditableWarning: true, className: 'prose', style: { minHeight: 90, padding: '8px 10px', outline: 'none', fontSize: 'var(--sy-fs-sm)' }, onInput: () => onChange(ref.current.innerHTML), onBlur: () => onChange(ref.current.innerHTML) }));
}

/** The site with Builder's preview parameters, so the page shows THIS entry, draft or not. */
const withBuilderParams = (url, publicKey, model, id) => { if (!url) return url; const parts = []; if (publicKey) parts.push(`builder.space=${encodeURIComponent(publicKey)}`); if (model) parts.push(`builder.preview=${encodeURIComponent(model)}`); if (model && id) parts.push(`builder.overrides.${encodeURIComponent(model)}=${encodeURIComponent(id)}`); if (id) parts.push(`builder.overrides.page=${encodeURIComponent(id)}`); parts.push('builder.noCache=true'); return `${url}${url.includes('?') ? '&' : '?'}${parts.join('&')}`; };

export function EntryPage({ host, bio, space, model, id, entry, health, onChanged, onClose, onDuplicate }) {
  const { h, ui, api, notify, tokens } = host;
  const { useState, useEffect } = host.react;
  const { data, model: schema, previews, error } = entry;
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(null);
  const [ai, setAi] = useState(null);
  const [aiKind, setAiKind] = useState(null);
  const [writeFor, setWriteFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [zoom, setZoom] = useState(0.6);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [unfolded, setUnfolded] = useState(() => new Set());
  useEffect(() => { setDraft({}); setAi(null); setAiKind(null); setConfirmDelete(false); setJsonMode(false); setShowPreview(false); setPreviewIdx(0); }, [id, data && data.lastUpdated]);
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const empty = (text) => h('p', { className: 'mlead', style: { margin: 0 } }, text);
  if (error) return h(ui.EmptyState, { title: 'Could not open the entry', body: error });
  if (!data) return h('div', null, h('div', { className: 'mstats mstats--head' }, [0, 1, 2, 3].map((k) => h('div', { key: k, className: 'mstat' }, h(ui.Skeleton, { count: 2, height: 14 })))), h('div', { className: 'bio-item', style: { marginTop: 'var(--sy-s3)' } }, Panel(host, { title: 'Fields' }, h(ui.Skeleton, { count: 8, height: 16 })), Panel(host, { title: 'Publish' }, h(ui.Skeleton, { count: 3, height: 16 }))));

  const published = data.published === 'published';
  const fields = schema ? schema.fields || [] : [];
  const values = data.data || {};
  const known = new Set(fields.map((f) => f.name));
  const extra = Object.keys(values).filter((k) => !known.has(k) && k !== 'blocks' && k !== 'blocksString' && !k.startsWith('@'));
  const dirty = Object.keys(draft).length > 0;
  const current = (name) => (name in draft ? draft[name] : values[name]);
  const act = async (fn, done) => { try { await fn(); if (done) notify(done, 'moss'); onChanged(); } catch (e) { notify(e.message, 'rosin'); } finally { setBusy(null); } };
  const save = () => { setBusy('save'); act(() => bio(`/content/${encodeURIComponent(model)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ data: { ...values, ...draft } }) }).then(() => setDraft({})), 'Saved'); };
  const publish = (to) => { setBusy(to); act(() => bio(`/content/${encodeURIComponent(model)}/${encodeURIComponent(id)}/${to}`, { method: 'POST', body: '{}' }), to === 'publish' ? 'Published' : 'Unpublished'); };
  const remove = () => { setBusy('delete'); act(() => bio(`/content/${encodeURIComponent(model)}/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => onClose()), 'Deleted'); };

  const askAi = async (kind, fieldName) => {
    setAiKind(kind); setAi(null); setWriteFor(fieldName || null);
    try {
      const summary = fields.map((f) => `${f.name} (${f.type}${f.required ? ', required' : ''}): ${JSON.stringify(current(f.name) === undefined ? null : current(f.name)).slice(0, 300)}`).join('\n');
      const system = 'You help a content editor working in Builder.io. Plain, specific, no fluff, no emoji. Markdown unless asked for raw text.';
      const prompt = kind === 'review'
        ? `Review this ${model} entry "${data.name}" (${published ? 'published' : 'draft'}). Say what is missing, weak, inconsistent or risky (empty required fields, placeholder text, missing alt text, broken or odd URLs, tone), then what to change, field by field. Short.\n\nFields:\n${summary}`
        : kind === 'write'
          ? `Write the value of the field "${fieldName}" (${(fields.find((f) => f.name === fieldName) || {}).type || 'text'}) of the ${model} entry "${data.name}". The editor wants to say, in their words: "${String(current(fieldName) || '').trim()}". Write that out properly in the site's voice - keep their intent, add only what makes it clear, never invent facts. Reply with the field value only, no quotes, no label${(fields.find((f) => f.name === fieldName) || {}).type === 'richText' || (fields.find((f) => f.name === fieldName) || {}).type === 'html' ? ', as simple HTML' : ''}.\n\nThe other fields, for context:\n${summary}`
          : `Suggest alt text for every image in this ${model} entry "${data.name}" that has none. Reply as a Markdown list: the image URL, then the alt text (short, descriptive, no "image of").\n\nData:\n${JSON.stringify(values).slice(0, 12000)}`;
      let text = '';
      try { text = String((await api('/api/notes/ai', { method: 'POST', body: JSON.stringify({ prompt, system, maxTokens: kind === 'write' ? 600 : 900 }) })).text || '').trim(); } catch (_) {}
      if (!text) {
        const cfg = await api('/api/config').catch(() => ({}));
        const result = await api('/api/orchestrator/spawn', { method: 'POST', body: JSON.stringify({ cli: cfg.DefaultCli || 'claude', from: 'builderio', timeout: 180000, prompt: `${system}\n\n${prompt}\n\nThis is a one-off answer: do not run any bootstrap, do not save anything. Reply with the answer only.` }) });
        text = String(result.handledLocally ? result.answer : result.id ? await waitForTask(api, result.id, 180000) : (result.error || '')).replace(/^\s*\[bootstrap:[^\]]*\]\s*/, '').trim();
      }
      if (!text) { notify('Nothing came back', 'rosin'); setAiKind(null); return; }
      if (kind === 'write') { setDraft({ ...draft, [fieldName]: text.replace(/^```[a-z]*\n?|\n?```$/g, '') }); setAiKind(null); notify(`${fieldName} written - review it, then Save`, 'moss'); }
      else setAi(text);
    } catch (e) { notify(e.message, 'rosin'); setAiKind(null); }
  };

  const fieldView = (f, getV = current, setV = (name, val) => setDraft({ ...draft, [name]: val }), depth = 0) => {
    const v = getV(f.name);
    const type = f.type || 'text';
    const label = h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 } },
      h('span', { style: { fontWeight: 600, fontSize: 'var(--sy-fs-sm)' } }, f.name),
      h('span', { className: 'mpanel__meta' }, `${type}${f.required ? ' - required' : ''}`),
      f.required && (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) ? h('span', { className: 'mpanel__meta', style: { color: 'var(--sy-rosin)' } }, 'empty') : null,
      depth === 0 && f.name in draft ? h('span', { className: 'mpanel__meta', style: { color: 'var(--sy-brass)' } }, 'changed') : null,
      h('span', { style: { flex: 1 } }),
      TEXT.has(type) && !isLocalized(v) ? h('button', { type: 'button', className: 'mpanel__meta', style: { background: 'none', border: 0, cursor: 'pointer', padding: 0 }, disabled: !!aiKind || !String(v || '').trim(), title: String(v || '').trim() ? 'The AI writes this field out from what is typed' : 'Type something first', onClick: () => askAi('write', f.name) }, aiKind === 'write' && writeFor === f.name ? 'writing...' : 'write with AI') : null);
    let control;
    if (isLocalized(v)) {
      const locales = [...new Set([...Object.keys(v).filter((k) => k !== '@type'), ...((health && health.data && health.data.locales) || [])])];
      const setLoc = (loc, val) => setV(f.name, { ...v, '@type': v['@type'], [loc]: val });
      control = h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } }, locales.map((loc) => h('div', { key: loc, style: { display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: 8, alignItems: 'start' } },
        h('span', { className: 'mpanel__meta', style: { paddingTop: 8 } }, loc),
        typeof v[loc] === 'string' || v[loc] === undefined
          ? ((type === 'richText' || type === 'html' || /<\w+/.test(String(v[loc] || '')))
            ? h(RichText, { host, value: v[loc] || '', onChange: (val) => setLoc(loc, val) })
            : (String(v[loc] || '').length > 120 || type === 'longText')
              ? h(ui.Textarea, { value: v[loc] || '', rows: 3, onChange: (e) => setLoc(loc, e.target.value) })
              : h(ui.Input, { value: v[loc] || '', placeholder: loc === 'Default' ? '' : 'falls back to Default', onChange: (e) => setLoc(loc, e.target.value) }))
          : h(ui.CodeEditor, { value: JSON.stringify(v[loc], null, 2), language: 'json', height: 140, onChange: (val) => { try { setLoc(loc, JSON.parse(val)); } catch (_) {} } }))));
    }
    else if (type === 'richText' || type === 'html') control = h(RichText, { host, value: v === undefined || v === null ? '' : String(v), onChange: (val) => setV(f.name, val) });
    else if (type === 'boolean') control = h(ui.Chip, { on: !!v, onClick: () => setV(f.name, !v) }, v ? 'true' : 'false');
    else if (type === 'number') control = h(ui.Input, { type: 'number', value: v === undefined || v === null ? '' : v, onChange: (e) => setV(f.name, e.target.value === '' ? null : Number(e.target.value)) });
    else if (type === 'longText' || (typeof v === 'string' && v.length > 120)) control = h(ui.Textarea, { value: v === undefined || v === null ? '' : String(v), rows: Math.min(12, Math.max(3, Math.ceil(String(v || '').length / 90))), onChange: (e) => setV(f.name, e.target.value) });
    else if (TEXT.has(type) || typeof v === 'string' || v === undefined || v === null) control = h(ui.Input, { value: v === undefined || v === null ? '' : String(v), placeholder: f.helperText || '', onChange: (e) => setV(f.name, e.target.value) });
    else if (type === 'file' && typeof v === 'string') control = h('div', null, /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(v) || /cdn\.builder\.io/.test(v) ? h('img', { src: v, alt: '', style: { maxWidth: 240, maxHeight: 140, borderRadius: 6, display: 'block', marginBottom: 4 } }) : null, h('code', { className: 'mpanel__meta', style: { wordBreak: 'break-all' } }, v));
    else if ((type === 'object' || type === 'model') && Array.isArray(f.subFields) && f.subFields.length && depth < 3) control = h('div', { style: { paddingLeft: 12, borderLeft: `2px solid ${tokens('line')}` } }, f.subFields.map((sf) => fieldView(sf, (n) => (v && typeof v === 'object' ? v[n] : undefined), (n, val) => setV(f.name, { ...(v && typeof v === 'object' ? v : {}), [n]: val }), depth + 1)));
    else {
      const key = `${depth}:${f.name}`;
      const text = JSON.stringify(v, null, 2) || '';
      const open = unfolded.has(key);
      control = h('div', null,
        h(ui.CodeEditor, { value: text, language: 'json', height: open ? 460 : Math.min(200, 40 + text.split('\n').length * 18), onChange: (val) => { try { setV(f.name, JSON.parse(val)); } catch (_) {} } }),
        text.split('\n').length > 9 ? h('button', { type: 'button', className: 'mpanel__meta', style: { background: 'none', border: 0, cursor: 'pointer', padding: '6px 0 0' }, onClick: () => { const n = new Set(unfolded); if (open) n.delete(key); else n.add(key); setUnfolded(n); } }, open ? 'smaller' : `taller (${text.length > 1000 ? `${Math.round(text.length / 1000)} KB` : `${text.length} chars`})`) : null);
    }
    return h('div', { key: f.name, style: { padding: depth ? '6px 0' : 'var(--sy-s2) 0', borderTop: depth ? 0 : `1px solid ${tokens('line')}` } }, label, f.helperText ? h('p', { className: 'mlead', style: { margin: '0 0 6px' } }, f.helperText) : null, control);
  };

  const rawUrls = previews ? previews.urls || [] : [];
  const publicKey = health && health.data ? health.data.publicKey : '';
  const urls = rawUrls.map((u) => { const href = u.url || u; return { label: u.label || u.locale || '', href, preview: withBuilderParams(href, publicKey, model, data.id) }; });
  const blocks = Array.isArray(values.blocks) ? values.blocks.length : 0;
  const currentPreview = urls[Math.min(previewIdx, Math.max(0, urls.length - 1))];
  const previewPanel = showPreview && currentPreview ? Panel(host, { title: 'Preview', wide: true, style: { marginBottom: 'var(--sy-s3)' }, action: h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
    urls.length > 1 ? h('select', { className: 'sy-select', value: String(previewIdx), onChange: (e) => setPreviewIdx(Number(e.target.value)), 'aria-label': 'Preview locale', style: { height: 28, padding: '0 28px 0 10px', fontSize: 'var(--sy-fs-sm)', width: 'auto' } }, urls.map((u, i) => h('option', { key: i, value: String(i) }, u.label || `Preview ${i + 1}`))) : null,
    h('span', { role: 'group', 'aria-label': 'Zoom', style: { display: 'inline-flex', alignItems: 'center', border: `1px solid ${tokens('line')}`, borderRadius: 6, overflow: 'hidden', height: 28 } },
      h('button', { type: 'button', title: 'Zoom out', onClick: () => setZoom(Math.max(0.3, Math.round((zoom - 0.1) * 10) / 10)), style: { width: 28, height: 28, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: 15, lineHeight: 1 } }, '−'),
      h('span', { className: 'mpanel__meta', style: { width: 44, textAlign: 'center', borderLeft: `1px solid ${tokens('line')}`, borderRight: `1px solid ${tokens('line')}`, lineHeight: '28px' } }, `${Math.round(zoom * 100)}%`),
      h('button', { type: 'button', title: 'Zoom in', onClick: () => setZoom(Math.min(1, Math.round((zoom + 0.1) * 10) / 10)), style: { width: 28, height: 28, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: 15, lineHeight: 1 } }, '+')),
    h('span', { style: { display: 'inline-flex', gap: 6 } },
      h('button', { type: 'button', className: 'sy-btn sy-btn--sm', style: { height: 28, display: 'inline-flex', alignItems: 'center', gap: 6 }, onClick: () => window.open(currentPreview.preview, '_blank') }, h(host.icons.external, { size: 13 }), 'Open in a tab'),
      h('button', { type: 'button', className: 'sy-btn sy-btn--sm', style: { height: 28, display: 'inline-flex', alignItems: 'center', gap: 6 }, onClick: () => setShowPreview(false) }, h(host.icons.close, { size: 13 }), 'Hide'))) },
    h('div', { style: { position: 'relative', width: '100%', height: 560, overflow: 'hidden', borderRadius: 6, border: `1px solid ${tokens('line')}`, background: '#fff' } },
      h('iframe', { key: `${currentPreview.preview}-${data.lastUpdated}`, src: currentPreview.preview, referrerPolicy: 'no-referrer', title: 'Preview', style: { position: 'absolute', top: 0, left: 0, width: `${100 / zoom}%`, height: `${100 / zoom}%`, border: 0, transform: `scale(${zoom})`, transformOrigin: '0 0' } }))) : null;
  const jsonPanel = jsonMode ? Panel(host, { title: 'Data as JSON', wide: true, style: { marginBottom: 'var(--sy-s3)' }, action: h('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } }, jsonError ? h('span', { className: 'mpanel__meta', style: { color: 'var(--sy-rosin)' } }, jsonError) : null, h(ui.Button, { className: 'sy-btn--sm', onClick: () => setJsonMode(false) }, 'Back to fields'), h(ui.Button, { className: 'sy-btn--sm', variant: 'primary', disabled: !!busy, onClick: async () => { try { const parsed = JSON.parse(jsonText); setJsonError(null); setBusy('save'); await act(() => bio(`/content/${encodeURIComponent(model)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ data: parsed }) }).then(() => { setDraft({}); setJsonMode(false); }), 'Saved'); } catch (e) { setJsonError(e.message); } } }, busy === 'save' ? 'Saving...' : 'Save the JSON')) },
    h(ui.CodeEditor, { value: jsonText, language: 'json', height: 'calc(100vh - 430px)', onChange: (val) => { setJsonText(val); setJsonError(null); } })) : null;
  const aiPanel = Panel(host, { title: 'AI', action: h('div', { style: { display: 'flex', gap: 6 } },
    ai && host.writeNote ? h(ui.Button, { className: 'sy-btn--sm', onClick: async () => { if (await host.writeNote(`${model} ${data.name} review`, `# ${data.name}\n\n${ai}`)) notify('Saved and opened', 'moss'); } }, 'Save as note') : null,
    !ai ? meta(aiKind && aiKind !== 'write' ? 'reading...' : 'reads the fields') : null) },
    ai ? h('div', { style: { maxHeight: 360, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' } }, h(ui.Markdown, { source: ai })) : h('p', { className: 'mlead', style: { margin: '0 0 var(--sy-s2)' } }, 'Review says what is missing or weak, field by field. Alt text suggests text for every image without one. Each text field has its own "write with AI" that expands what you typed.'),
    aiKind && aiKind !== 'write' && !ai ? h('div', { style: { marginTop: 'var(--sy-s2)' } }, h(ui.Skeleton, { count: 4, height: 14 })) : null,
    h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: ai ? 'var(--sy-s3)' : 0 } },
      h(ui.Button, { className: 'sy-btn--sm', disabled: !!aiKind && !ai, onClick: () => askAi('review') }, 'Review'),
      h(ui.Button, { className: 'sy-btn--sm', disabled: !!aiKind && !ai, onClick: () => askAi('alt') }, 'Alt text')));

  return h('div', { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } },
    h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 'var(--sy-s3)', marginBottom: 'var(--sy-s3)' } },
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } }, h('span', { className: 'mind-dot', style: { background: statusColour(data) } }), h('span', { className: 'mpanel__title' }, `${model} - ${published ? 'published' : 'draft'}`)),
        h('h2', { style: { margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 600, color: 'var(--sy-text)' } }, data.name || data.id),
        h('p', { className: 'mlead', style: { margin: '6px 0 0' } }, `${values.url ? `${values.url} - ` : ''}${fields.length} field${fields.length === 1 ? '' : 's'}${blocks ? `, ${blocks} block${blocks === 1 ? '' : 's'}` : ''}${data.lastUpdated ? ` - updated ${ago(data.lastUpdated)}` : ''}${data.createdDate ? ` - created ${new Date(data.createdDate).toLocaleDateString()}` : ''}.`)),
      h('div', { style: { display: 'flex', gap: 6, flex: 'none' } },
        urls[0] ? h(ui.Button, { className: 'sy-btn--sm', onClick: () => setShowPreview(!showPreview) }, showPreview ? 'Hide preview' : 'Preview here') : null,
        h(ui.Button, { className: 'sy-btn--sm', onClick: () => { setJsonText(JSON.stringify({ ...values, ...draft }, null, 2)); setJsonError(null); setJsonMode(!jsonMode); } }, jsonMode ? 'Fields' : 'JSON'),
        onDuplicate ? h(ui.Button, { className: 'sy-btn--sm', onClick: () => onDuplicate(data) }, 'Duplicate') : null)),
    previewPanel,
    jsonPanel,
    h('div', { className: 'mstats mstats--head' },
      Stat(host, { label: 'State', value: published ? 'Published' : 'Draft', tone: published ? 'moss' : 'brass' }),
      Stat(host, { label: 'Required empty', value: fields.filter((f) => f.required && (current(f.name) === undefined || current(f.name) === null || current(f.name) === '')).length, tone: fields.some((f) => f.required && (current(f.name) === undefined || current(f.name) === null || current(f.name) === '')) ? 'rosin' : 'muted' }),
      Stat(host, { label: 'Unsaved', value: Object.keys(draft).length, tone: dirty ? 'brass' : 'muted', hint: dirty ? 'Save writes them' : undefined }),
      Stat(host, { label: 'Previews', value: previews === null ? '...' : urls.length, tone: 'muted', hint: previews && previews.error ? previews.error : undefined })),
    h('div', { className: 'bio-row2', style: showPreview || jsonMode ? { flex: 'none' } : { flex: 1, minHeight: 360 } },
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)', minWidth: 0, minHeight: 0 } },
        Panel(host, { title: 'Fields', style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }, bodyStyle: { flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' }, action: h('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } }, dirty ? h(ui.Button, { className: 'sy-btn--sm', onClick: () => setDraft({}) }, 'Discard') : null, h(ui.Button, { className: 'sy-btn--sm', variant: 'primary', disabled: !dirty || !!busy, onClick: save }, busy === 'save' ? 'Saving...' : dirty ? `Save ${Object.keys(draft).length}` : 'Saved')) },
          !schema ? h(ui.Skeleton, { count: 6, height: 16 }) : fields.filter((f) => f.type !== 'uiBlocks').length ? h('div', null, fields.filter((f) => f.type !== 'uiBlocks').map((f) => fieldView(f))) : empty('This model declares no fields; the content lives in blocks.'),
          extra.length ? h('div', { style: { marginTop: 'var(--sy-s2)' } }, h('div', { className: 'mpanel__meta', style: { margin: '6px 0' } }, 'Also in the data, outside the model'), extra.map((k) => fieldView({ name: k, type: typeof values[k] === 'string' ? 'text' : typeof values[k] === 'number' ? 'number' : typeof values[k] === 'boolean' ? 'boolean' : 'object' }))) : null),
        null),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)', minWidth: 0, minHeight: 0, overflow: 'auto', paddingRight: 2, scrollbarGutter: 'stable' } },
        Panel(host, { title: 'Publish', action: meta(published ? 'live' : 'not live') },
          h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            published ? h(ui.Button, { disabled: !!busy, onClick: () => publish('unpublish') }, busy === 'unpublish' ? 'Unpublishing...' : 'Unpublish') : h(ui.Button, { variant: 'primary', disabled: !!busy, onClick: () => publish('publish') }, busy === 'publish' ? 'Publishing...' : 'Publish'),
            confirmDelete ? h(ui.Button, { disabled: !!busy, onClick: remove, style: { color: 'var(--sy-rosin)' } }, busy === 'delete' ? 'Deleting...' : 'Yes, delete it') : h(ui.Button, { disabled: !!busy, onClick: () => setConfirmDelete(true) }, 'Delete'),
            confirmDelete ? h(ui.Button, { className: 'sy-btn--sm', onClick: () => setConfirmDelete(false) }, 'Keep it') : null),
          dirty ? h('p', { className: 'mlead', style: { margin: 'var(--sy-s2) 0 0', color: 'var(--sy-brass)' } }, 'Unsaved field changes are not published until you Save.') : null),
        aiPanel,
        blocks ? Panel(host, { title: 'Blocks', style: { flex: '1 0 auto', minHeight: 160, display: 'flex', flexDirection: 'column' }, bodyStyle: { flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' }, action: meta(`${blocks} - laid out in Builder's visual editor`) }, List(host, values.blocks.slice(0, 40).map((b, i) => ListRow(host, { key: i, lead: h('span', { className: 'mind-dot', style: { background: 'var(--sy-text-3)', width: 7, height: 7 } }), label: (b.component && b.component.name) || b.tagName || 'block', sub: b.component && b.component.options ? Object.keys(b.component.options).slice(0, 5).join(', ') : '' })))) : null,
        Panel(host, { title: 'Preview', bodyStyle: { maxHeight: 140, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' }, action: meta(previews === null ? 'resolving...' : urls.length ? `${urls.length}` : 'none') },
          previews === null ? h(ui.Skeleton, { count: 2, height: 16 }) : urls.length ? List(host, urls.map((u, i) => ListRow(host, { key: i, label: u.label || (i === 0 ? 'Preview' : `Preview ${i + 1}`), sub: String(u.href).replace(/^https?:\/\//, ''), meta: 'this entry', onClick: () => window.open(u.preview, '_blank') }))) : empty(previews && previews.error ? previews.error : 'No preview URL for this entry: the space has no environment URL, or the model no preview path.')),
        null)));
}

export function EntryAside({ host, bio, space, entry, current, model }) {
  const { h, ui } = host;
  const { data, model: schema } = entry;
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const fields = schema ? schema.fields || [] : [];
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    data ? Panel(host, { title: 'Details' }, h(ui.InfoGrid, { items: [{ label: 'Id', value: data.id }, { label: 'Model', value: model }, { label: 'Updated', value: data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '-' }, { label: 'Created', value: data.createdDate ? new Date(data.createdDate).toLocaleString() : '-' }, { label: 'Targeting', value: data.query && data.query.length ? data.query.map((t) => `${t.property} ${t.operator} ${JSON.stringify(t.value)}`).join('; ') : 'none' }] })) : null,
    Panel(host, { title: 'Model', action: meta(schema ? schema.kind : '...') },
      !schema ? h(ui.Skeleton, { count: 4, height: 14 }) : fields.length ? List(host, fields.map((f) => ListRow(host, { key: f.name, lead: h('span', { className: 'mind-dot', style: { background: f.required ? 'var(--sy-brass)' : 'var(--sy-text-3)', width: 7, height: 7 } }), label: f.name, sub: `${f.type}${f.required ? ' - required' : ''}` }))) : h('p', { className: 'mlead', style: { margin: 0 } }, 'No declared fields.')),
    current && current.dashboardUrl && data ? Panel(host, { title: 'In Builder' }, h('a', { className: 'sy-btn sy-btn--sm', href: `${current.dashboardUrl.replace(/\/content$/, '')}/content/${data.id}`, target: '_blank', rel: 'noreferrer' }, 'Open the visual editor')) : null);
}
