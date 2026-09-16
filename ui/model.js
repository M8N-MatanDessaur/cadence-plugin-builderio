/**
 * Everything about a model beyond its entries, so nobody has to open Builder for it:
 * the schema (fields added, removed, edited), a new entry, generate entries with AI, find
 * and replace across the model's text fields, export as JSON, delete the model, and a new
 * model. The aside offers them; each opens as a panel in the main area.
 */
import { waitForTask } from './helpers.js';
import { Panel, Stat, Health, List, ListRow } from './kit.js';

const FIELD_TYPES = ['text', 'longText', 'richText', 'number', 'boolean', 'url', 'file', 'color', 'date', 'list', 'object', 'reference', 'html', 'email'];
const TEXTY = new Set(['text', 'longText', 'richText', 'html', 'url', 'email']);

export function useModel(host, bio, name) {
  const { react } = host;
  const { useState, useEffect, useCallback } = react;
  const [model, setModel] = useState(null);
  const reload = useCallback(() => { if (!name) return; bio('/models').then((ms) => setModel((ms || []).find((m) => m.name === name) || null)).catch(() => setModel(null)); }, [bio, name]);
  useEffect(() => { setModel(null); reload(); }, [reload]);
  return { model, reload };
}

/** The tools of a model, in the right pane. */
export function ModelTools({ host, model, modelRow, mode, setMode, onOpenEntry, health }) {
  const { h, ui } = host;
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const fields = model ? model.fields || [] : [];
  const btn = (id, label, primary) => h(ui.Button, { className: 'sy-btn--sm', variant: primary ? 'primary' : undefined, onClick: () => setMode(mode === id ? null : id) }, label);
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    Panel(host, { title: 'Do', action: meta(mode ? 'one open' : '') },
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } }, btn('new', 'New entry', true), btn('generate', 'Generate with AI'), btn('schema', 'Schema'), btn('replace', 'Find and replace'), btn('export', 'Export'), btn('delete', 'Delete model'))),
    modelRow ? Panel(host, { title: 'This model', action: meta(modelRow.kind) }, h(ui.InfoGrid, { items: [{ label: 'Entries', value: modelRow.total }, { label: 'Published', value: modelRow.published }, { label: 'Drafts', value: modelRow.drafts }, { label: 'Stale', value: modelRow.stale || 0 }, { label: 'Missing alt', value: modelRow.missingAlt || 0 }] })) : null,
    Panel(host, { title: 'Fields', action: meta(model ? `${fields.length}` : '...') },
      !model ? h(ui.Skeleton, { count: 4, height: 14 }) : fields.length ? List(host, fields.map((f) => ListRow(host, { key: f.name, lead: h('span', { className: 'mind-dot', style: { background: f.required ? 'var(--sy-brass)' : 'var(--sy-text-3)', width: 7, height: 7 } }), label: f.name, sub: `${f.type}${f.required ? ' - required' : ''}${f.helperText ? ` - ${f.helperText}` : ''}` }))) : h('p', { className: 'mlead', style: { margin: 0 } }, 'No declared fields; the content lives in blocks.')));
}

const emptyFor = (f) => (f.type === 'boolean' ? false : f.type === 'number' ? null : f.type === 'list' ? [] : f.type === 'object' || f.type === 'model' ? Object.fromEntries((f.subFields || []).map((sf) => [sf.name, emptyFor(sf)])) : f.type === 'reference' ? null : '');

export function NewEntry({ host, bio, model, schema, onCreated, onCancel, seed }) {
  const { h, ui, notify } = host;
  const { useState } = host.react;
  const fields = (schema ? schema.fields || [] : []).filter((f) => f.type !== 'uiBlocks');
  const [name, setName] = useState(seed ? `Copy of ${seed.name}` : '');
  const [data, setData] = useState(() => seed ? { ...(seed.data || {}) } : Object.fromEntries(fields.map((f) => [f.name, emptyFor(f)])));
  const [url, setUrl] = useState(seed && seed.data && typeof seed.data.url === 'string' ? `${seed.data.url}-copy` : '');
  const [busy, setBusy] = useState(false);
  const isPage = schema && schema.kind === 'page';
  const set = (k, v) => setData({ ...data, [k]: v });
  const create = async () => {
    if (!name.trim()) return notify('Give the entry a name', 'rosin');
    if (isPage && !url.trim()) return notify('A page needs a URL', 'rosin');
    setBusy(true);
    try {
      const body = { name: name.trim(), published: 'draft', data: { ...data } };
      if (isPage) { body.data.url = url.trim(); body.query = [{ property: 'urlPath', operator: 'is', value: url.trim() }]; }
      if (seed && seed.query && !isPage) body.query = seed.query;
      const r = await bio(`/content/${encodeURIComponent(model)}`, { method: 'POST', body: JSON.stringify(body) });
      if (!r || !r.id) throw new Error((r && (r.message || r.error)) || 'Builder did not return an id');
      notify(`Created "${name.trim()}" as a draft`, 'moss'); onCreated(r.id);
    } catch (e) { notify(e.message, 'rosin'); } finally { setBusy(false); }
  };
  return Panel(host, { title: seed ? `Duplicate ${seed.name}` : `New ${model} entry`, wide: true, action: h('span', { className: 'mpanel__meta' }, 'created as a draft') },
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      h(ui.Field, { label: 'Name' }, h(ui.Input, { value: name, placeholder: 'As it appears in Builder', onChange: (e) => setName(e.target.value), autoFocus: true })),
      isPage ? h(ui.Field, { label: 'URL', hint: 'the path this page answers to' }, h(ui.Input, { value: url, placeholder: '/about-us', onChange: (e) => setUrl(e.target.value) })) : null,
      fields.filter((f) => f.name !== 'url').map((f) => h(ui.Field, { key: f.name, label: `${f.name}${f.required ? ' (required)' : ''}`, hint: f.helperText || f.type },
        f.type === 'boolean' ? h(ui.Chip, { on: !!data[f.name], onClick: () => set(f.name, !data[f.name]) }, data[f.name] ? 'true' : 'false')
          : f.type === 'number' ? h(ui.Input, { type: 'number', value: data[f.name] === null || data[f.name] === undefined ? '' : data[f.name], onChange: (e) => set(f.name, e.target.value === '' ? null : Number(e.target.value)) })
          : f.type === 'longText' || f.type === 'richText' || f.type === 'html' ? h(ui.Textarea, { value: typeof data[f.name] === 'string' ? data[f.name] : '', rows: 4, onChange: (e) => set(f.name, e.target.value) })
          : TEXTY.has(f.type) || f.type === 'file' || f.type === 'color' || f.type === 'date' ? h(ui.Input, { value: typeof data[f.name] === 'string' ? data[f.name] : '', onChange: (e) => set(f.name, e.target.value) })
          : h(ui.CodeEditor, { value: JSON.stringify(data[f.name] === undefined ? emptyFor(f) : data[f.name], null, 2), language: 'json', height: 150, onChange: (val) => { try { set(f.name, JSON.parse(val)); } catch (_) {} } }))),
      h('div', { style: { display: 'flex', gap: 8 } }, h(ui.Button, { onClick: onCancel }, 'Cancel'), h('span', { style: { flex: 1 } }), h(ui.Button, { variant: 'primary', disabled: busy, onClick: create }, busy ? 'Creating...' : 'Create the draft'))));
}

export function Schema({ host, bio, model, schema, onChanged, onCancel }) {
  const { h, ui, notify, tokens } = host;
  const { useState, useEffect } = host.react;
  const [fields, setFields] = useState(schema ? (schema.fields || []).map((f) => ({ ...f })) : []);
  useEffect(() => { setFields(schema ? (schema.fields || []).map((f) => ({ ...f })) : []); }, [schema && schema.id]);
  const [add, setAdd] = useState({ name: '', type: 'text', required: false, helperText: '' });
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(fields) !== JSON.stringify(schema ? schema.fields || [] : []);
  const save = async () => {
    if (!schema) return;
    setBusy(true);
    try { await bio(`/models/${encodeURIComponent(schema.id)}`, { method: 'PATCH', body: JSON.stringify({ fields }) }); notify('Schema saved', 'moss'); onChanged(); }
    catch (e) { notify(e.message, 'rosin'); } finally { setBusy(false); }
  };
  const addField = () => { const n = add.name.trim(); if (!n || fields.some((f) => f.name === n)) return notify('Give the field a new name', 'rosin'); setFields([...fields, { name: n, type: add.type, required: !!add.required, helperText: add.helperText || '' }]); setAdd({ name: '', type: 'text', required: false, helperText: '' }); };
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= fields.length) return; const next = fields.slice(); [next[i], next[j]] = [next[j], next[i]]; setFields(next); };
  return Panel(host, { title: `Schema of ${model}`, wide: true, action: h('div', { style: { display: 'flex', gap: 6 } }, h(ui.Button, { className: 'sy-btn--sm', onClick: onCancel }, 'Close'), h(ui.Button, { className: 'sy-btn--sm', variant: 'primary', disabled: !dirty || busy, onClick: save }, busy ? 'Saving...' : dirty ? 'Save the schema' : 'Saved')) },
    !schema ? h(ui.Skeleton, { count: 5, height: 16 }) : h('div', null,
      h('p', { className: 'mlead', style: { margin: '0 0 var(--sy-s2)' } }, 'Fields in the order Builder shows them. Removing a field does not delete the data entries already hold; it hides it from the editor.'),
      fields.length ? fields.map((f, i) => h('div', { key: `${f.name}-${i}`, style: { display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 130px 90px minmax(160px, 2fr) auto', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: `1px solid ${tokens('line')}` } },
        h(ui.Input, { value: f.name, onChange: (e) => setFields(fields.map((x, k) => (k === i ? { ...x, name: e.target.value } : x))), 'aria-label': 'Field name' }),
        h(ui.Select, { value: FIELD_TYPES.includes(f.type) ? f.type : f.type, onChange: (e) => setFields(fields.map((x, k) => (k === i ? { ...x, type: e.target.value } : x))), 'aria-label': 'Type' }, [...new Set([f.type, ...FIELD_TYPES])].map((t) => h('option', { key: t, value: t }, t))),
        h(ui.Chip, { on: !!f.required, onClick: () => setFields(fields.map((x, k) => (k === i ? { ...x, required: !x.required } : x))) }, 'required'),
        h(ui.Input, { value: f.helperText || '', placeholder: 'Helper text', onChange: (e) => setFields(fields.map((x, k) => (k === i ? { ...x, helperText: e.target.value } : x))), 'aria-label': 'Helper text' }),
        h('span', { style: { display: 'flex', gap: 4 } }, h('button', { type: 'button', className: 'sy-btn sy-btn--sm', onClick: () => move(i, -1), title: 'Up' }, 'up'), h('button', { type: 'button', className: 'sy-btn sy-btn--sm', onClick: () => move(i, 1), title: 'Down' }, 'down'), h('button', { type: 'button', className: 'sy-btn sy-btn--sm', onClick: () => setFields(fields.filter((_, k) => k !== i)), title: 'Remove the field' }, 'remove')))) : h('p', { className: 'mlead', style: { margin: 0 } }, 'No declared field yet.'),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 130px 90px minmax(160px, 2fr) auto', gap: 8, alignItems: 'center', padding: '10px 0 0', marginTop: 6, borderTop: `1px solid ${tokens('line')}` } },
        h(ui.Input, { value: add.name, placeholder: 'New field name', onChange: (e) => setAdd({ ...add, name: e.target.value }), onKeyDown: (e) => { if (e.key === 'Enter') addField(); } }),
        h(ui.Select, { value: add.type, onChange: (e) => setAdd({ ...add, type: e.target.value }) }, FIELD_TYPES.map((t) => h('option', { key: t, value: t }, t))),
        h(ui.Chip, { on: add.required, onClick: () => setAdd({ ...add, required: !add.required }) }, 'required'),
        h(ui.Input, { value: add.helperText, placeholder: 'Helper text', onChange: (e) => setAdd({ ...add, helperText: e.target.value }) }),
        h(ui.Button, { className: 'sy-btn--sm', onClick: addField }, 'Add'))));
}

export function FindReplace({ host, bio, model, schema, onDone, onCancel }) {
  const { h, ui, notify } = host;
  const { useState } = host.react;
  const fields = (schema ? schema.fields || [] : []).filter((f) => TEXTY.has(f.type));
  const [field, setField] = useState(fields[0] ? fields[0].name : '');
  const [find, setFind] = useState('');
  const [repl, setRepl] = useState('');
  const [hits, setHits] = useState(null);
  const [busy, setBusy] = useState(null);
  const matchIn = (v) => (typeof v === 'string' ? v.includes(find) : v && typeof v === 'object' && v['@type'] ? Object.values(v).some((x) => typeof x === 'string' && x.includes(find)) : false);
  const apply = (v) => (typeof v === 'string' ? v.split(find).join(repl) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' && k !== '@type' ? x.split(find).join(repl) : x])) : v);
  const preview = async () => {
    if (!field || !find) return;
    setBusy('preview');
    try { const all = await bio(`/content/${encodeURIComponent(model)}/export`, { method: 'POST', body: '{}' }); const list = (all || []).filter((e) => e.data && matchIn(e.data[field])); setHits(list.map((e) => ({ id: e.id, name: e.name || e.id, published: e.published, before: typeof e.data[field] === 'string' ? e.data[field] : JSON.stringify(e.data[field]), data: e.data }))); }
    catch (e) { notify(e.message, 'rosin'); } finally { setBusy(null); }
  };
  const run = async () => {
    if (!hits || !hits.length) return;
    setBusy('apply');
    try { const r = await bio(`/content/${encodeURIComponent(model)}/bulk-update`, { method: 'POST', body: JSON.stringify({ entries: hits.map((x) => ({ id: x.id, updates: { data: { ...x.data, [field]: apply(x.data[field]) } } })) }) }); notify(`Updated ${r.success} of ${r.total} entr${r.total === 1 ? 'y' : 'ies'}`, r.success === r.total ? 'moss' : 'brass'); onDone(); }
    catch (e) { notify(e.message, 'rosin'); } finally { setBusy(null); }
  };
  return Panel(host, { title: `Find and replace in ${model}`, wide: true, action: h(ui.Button, { className: 'sy-btn--sm', onClick: onCancel }, 'Close') },
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      h('p', { className: 'mlead', style: { margin: 0 } }, 'Exact text, one field, every entry of the model. Preview shows what would change; nothing is written until you apply. Published entries stay published with the new text.'),
      h('div', { className: 'bio-row2' },
        h(ui.Field, { label: 'Field' }, h(ui.Select, { value: field, onChange: (e) => { setField(e.target.value); setHits(null); } }, fields.map((f) => h('option', { key: f.name, value: f.name }, `${f.name} (${f.type})`)))),
        h('div')),
      h('div', { className: 'bio-row2' },
        h(ui.Field, { label: 'Find' }, h(ui.Input, { value: find, onChange: (e) => { setFind(e.target.value); setHits(null); } })),
        h(ui.Field, { label: 'Replace with' }, h(ui.Input, { value: repl, onChange: (e) => setRepl(e.target.value) }))),
      h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        h(ui.Button, { disabled: !field || !find || !!busy, onClick: preview }, busy === 'preview' ? 'Reading every entry...' : 'Preview'),
        hits ? h('span', { className: 'mpanel__meta' }, `${hits.length} entr${hits.length === 1 ? 'y' : 'ies'} contain it`) : null,
        h('span', { style: { flex: 1 } }),
        hits && hits.length ? h(ui.Button, { variant: 'primary', disabled: !!busy, onClick: run }, busy === 'apply' ? 'Applying...' : `Replace in ${hits.length}`) : null),
      hits && hits.length ? h('div', { style: { maxHeight: 360, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' } }, List(host, hits.map((x) => ListRow(host, { key: x.id, lead: h('span', { className: 'mind-dot', style: { background: x.published === 'published' ? 'var(--sy-moss)' : 'var(--sy-brass)' } }), label: x.name, sub: x.before.slice(0, 200) })))) : null));
}

export function ExportModel({ host, bio, model, onCancel }) {
  const { h, ui, notify } = host;
  const { useState } = host.react;
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const fetchAll = async () => { setBusy(true); try { setData(await bio(`/content/${encodeURIComponent(model)}/export`, { method: 'POST', body: '{}' })); } catch (e) { notify(e.message, 'rosin'); } finally { setBusy(false); } };
  const text = data ? JSON.stringify(data, null, 2) : '';
  return Panel(host, { title: `Export ${model}`, wide: true, action: h(ui.Button, { className: 'sy-btn--sm', onClick: onCancel }, 'Close') },
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      h('p', { className: 'mlead', style: { margin: 0 } }, 'Every entry of the model, published and draft, as JSON: a backup, or the input of the Import script (Export-Entries and New-Entry cover the same from a shell).'),
      h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        h(ui.Button, { variant: 'primary', disabled: busy, onClick: fetchAll }, busy ? 'Reading...' : data ? 'Read again' : 'Read every entry'),
        data ? h('span', { className: 'mpanel__meta' }, `${data.length} entries, ${Math.round(text.length / 1024)} KB`) : null,
        h('span', { style: { flex: 1 } }),
        data ? h(ui.Button, { onClick: () => navigator.clipboard.writeText(text).then(() => notify('Copied', 'moss')).catch(() => {}) }, 'Copy JSON') : null,
        data && host.writeNote ? h(ui.Button, { onClick: async () => { if (await host.writeNote(`${model} export ${new Date().toISOString().slice(0, 10)}`, '```json\n' + text + '\n```')) notify('Saved as a note', 'moss'); } }, 'Save as note') : null),
      data ? h(ui.CodeEditor, { value: text.length > 400000 ? text.slice(0, 400000) + '\n// truncated' : text, language: 'json', height: 460, readOnly: true }) : null));
}

export function Generate({ host, bio, model, schema, onCreated, onCancel }) {
  const { h, ui, api, notify } = host;
  const { useState } = host.react;
  const fields = (schema ? schema.fields || [] : []).filter((f) => f.type !== 'uiBlocks');
  const [brief, setBrief] = useState('');
  const [count, setCount] = useState(3);
  const [drafts, setDrafts] = useState(null);
  const [busy, setBusy] = useState(null);
  const generate = async () => {
    if (!brief.trim()) return;
    setBusy('ai'); setDrafts(null);
    try {
      const system = 'You write CMS content for a Builder.io model. Return ONLY a JSON array, no prose, no fences.';
      const prompt = `Write ${count} ${model} entries from this brief: "${brief.trim()}".\n\nEach entry is an object { "name": string, "data": { ${fields.map((f) => `"${f.name}": ${f.type === 'number' ? 'number' : f.type === 'boolean' ? 'boolean' : f.type === 'list' ? 'array' : f.type === 'object' ? 'object' : 'string'}${f.required ? ' (required)' : ''}${f.helperText ? ` /* ${f.helperText} */` : ''}`).join(', ')} } }. ${schema && schema.kind === 'page' ? 'Include a "url" path in data starting with /.' : ''} Rich text and html fields take simple HTML. Concrete, specific, no placeholders, no lorem.`;
      let text = '';
      try { text = String((await api('/api/notes/ai', { method: 'POST', body: JSON.stringify({ prompt, system, maxTokens: 2000 }) })).text || '').trim(); } catch (_) {}
      if (!text) {
        const cfg = await api('/api/config').catch(() => ({}));
        const result = await api('/api/orchestrator/spawn', { method: 'POST', body: JSON.stringify({ cli: cfg.DefaultCli || 'claude', from: 'builderio-generate', timeout: 240000, prompt: `${system}\n\n${prompt}\n\nDo not run any bootstrap, do not save anything. Reply with the JSON array only.` }) });
        text = String(result.handledLocally ? result.answer : result.id ? await waitForTask(api, result.id, 240000) : (result.error || '')).replace(/^\s*\[bootstrap:[^\]]*\]\s*/, '').trim();
      }
      const m = text.match(/\[[\s\S]*\]/);
      const arr = JSON.parse(m ? m[0] : text);
      if (!Array.isArray(arr) || !arr.length) throw new Error('The AI did not return entries');
      setDrafts(arr.map((x) => ({ name: x.name || 'Untitled', data: x.data || {}, keep: true })));
    } catch (e) { notify(e.message, 'rosin'); } finally { setBusy(null); }
  };
  const create = async () => {
    const keep = (drafts || []).filter((d) => d.keep);
    if (!keep.length) return;
    setBusy('create');
    let made = 0; let firstId = null;
    for (const d of keep) {
      try { const body = { name: d.name, published: 'draft', data: d.data }; if (schema && schema.kind === 'page' && d.data.url) body.query = [{ property: 'urlPath', operator: 'is', value: d.data.url }]; const r = await bio(`/content/${encodeURIComponent(model)}`, { method: 'POST', body: JSON.stringify(body) }); if (r && r.id) { made++; if (!firstId) firstId = r.id; } }
      catch (e) { notify(`${d.name}: ${e.message}`, 'rosin'); }
    }
    setBusy(null);
    notify(`Created ${made} draft${made === 1 ? '' : 's'}`, made ? 'moss' : 'rosin');
    if (made) onCreated(firstId);
  };
  return Panel(host, { title: `Generate ${model} entries with AI`, wide: true, action: h(ui.Button, { className: 'sy-btn--sm', onClick: onCancel }, 'Close') },
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      h('p', { className: 'mlead', style: { margin: 0 } }, 'Describe what you need; the AI writes the entries against the model\'s fields. You review them here, untick what you do not want, and they are created as drafts. Nothing is published.'),
      h(ui.Field, { label: 'Brief' }, h(ui.Textarea, { value: brief, rows: 4, placeholder: 'e.g. Five FAQ entries about warranty coverage for acrylic bath liners, friendly tone, one paragraph each.', onChange: (e) => setBrief(e.target.value) })),
      h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        h(ui.Field, { label: 'How many' }, h(ui.Input, { type: 'number', value: count, min: 1, max: 20, style: { width: 90 }, onChange: (e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1))) })),
        h('span', { style: { flex: 1 } }),
        h(ui.Button, { variant: drafts ? undefined : 'primary', disabled: !!busy || !brief.trim(), onClick: generate }, busy === 'ai' ? 'Writing...' : drafts ? 'Write again' : 'Write them'),
        drafts ? h(ui.Button, { variant: 'primary', disabled: !!busy || !drafts.some((d) => d.keep), onClick: create }, busy === 'create' ? 'Creating...' : `Create ${drafts.filter((d) => d.keep).length} draft${drafts.filter((d) => d.keep).length === 1 ? '' : 's'}`) : null),
      drafts ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } }, drafts.map((d, i) => h('div', { key: i, style: { padding: 'var(--sy-s2)', border: '1px solid var(--sy-line)', borderRadius: 8, opacity: d.keep ? 1 : 0.5 } },
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 } }, h(ui.Chip, { on: d.keep, onClick: () => setDrafts(drafts.map((x, k) => (k === i ? { ...x, keep: !x.keep } : x))) }, d.keep ? 'create' : 'skip'), h(ui.Input, { value: d.name, onChange: (e) => setDrafts(drafts.map((x, k) => (k === i ? { ...x, name: e.target.value } : x))), style: { flex: 1 } })),
        h(ui.CodeEditor, { value: JSON.stringify(d.data, null, 2), language: 'json', height: 170, onChange: (val) => { try { setDrafts(drafts.map((x, k) => (k === i ? { ...x, data: JSON.parse(val) } : x))); } catch (_) {} } })))) : null));
}

export function DeleteModel({ host, bio, model, schema, modelRow, onDeleted, onCancel }) {
  const { h, ui, notify } = host;
  const { useState } = host.react;
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => { if (!schema) return; setBusy(true); try { await bio(`/models/${encodeURIComponent(schema.id)}`, { method: 'DELETE' }); notify(`Deleted the model ${model}`, 'moss'); onDeleted(); } catch (e) { notify(e.message, 'rosin'); } finally { setBusy(false); } };
  return Panel(host, { title: `Delete the model ${model}`, wide: true, action: h(ui.Button, { className: 'sy-btn--sm', onClick: onCancel }, 'Keep it') },
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      h('p', { className: 'mlead', style: { margin: 0, color: 'var(--sy-rosin)' } }, `This removes the model and its ${modelRow ? modelRow.total : ''} entries from Builder. There is no undo. Type the model name to confirm.`),
      h(ui.Input, { value: typed, placeholder: model, onChange: (e) => setTyped(e.target.value) }),
      h('div', null, h(ui.Button, { disabled: typed !== model || busy, onClick: run, style: { color: 'var(--sy-rosin)' } }, busy ? 'Deleting...' : 'Delete the model and its entries'))));
}

export function NewModel({ host, bio, onCreated, onCancel }) {
  const { h, ui, notify } = host;
  const { useState } = host.react;
  const [name, setName] = useState('');
  const [kind, setKind] = useState('data');
  const [fields, setFields] = useState([{ name: 'title', type: 'text', required: true }]);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!name.trim()) return notify('Give the model a name', 'rosin');
    setBusy(true);
    try { const r = await bio('/models', { method: 'POST', body: JSON.stringify({ name: name.trim(), kind, fields: fields.filter((f) => f.name.trim()) }) }); notify(`Created the model ${r && r.name ? r.name : name}`, 'moss'); onCreated(r && r.name ? r.name : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')); }
    catch (e) { notify(e.message, 'rosin'); } finally { setBusy(false); }
  };
  return Panel(host, { title: 'New model', wide: true, action: h('span', { className: 'mpanel__meta' }, 'names become kebab-case') },
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      h('div', { className: 'bio-row2' },
        h(ui.Field, { label: 'Name' }, h(ui.Input, { value: name, placeholder: 'testimonial', onChange: (e) => setName(e.target.value), autoFocus: true })),
        h(ui.Field, { label: 'Kind', hint: 'page: has a URL; section: dropped into pages; data: plain records' }, h(ui.Select, { value: kind, onChange: (e) => setKind(e.target.value) }, ['data', 'page', 'section'].map((k) => h('option', { key: k, value: k }, k))))),
      h('div', { className: 'mpanel__meta' }, 'Fields'),
      fields.map((f, i) => h('div', { key: i, style: { display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 130px 90px auto', gap: 8, alignItems: 'center' } },
        h(ui.Input, { value: f.name, placeholder: 'field name', onChange: (e) => setFields(fields.map((x, k) => (k === i ? { ...x, name: e.target.value } : x))) }),
        h(ui.Select, { value: f.type, onChange: (e) => setFields(fields.map((x, k) => (k === i ? { ...x, type: e.target.value } : x))) }, FIELD_TYPES.map((t) => h('option', { key: t, value: t }, t))),
        h(ui.Chip, { on: !!f.required, onClick: () => setFields(fields.map((x, k) => (k === i ? { ...x, required: !x.required } : x))) }, 'required'),
        h('button', { type: 'button', className: 'sy-btn sy-btn--sm', onClick: () => setFields(fields.filter((_, k) => k !== i)) }, 'remove'))),
      h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        h(ui.Button, { className: 'sy-btn--sm', onClick: () => setFields([...fields, { name: '', type: 'text', required: false }]) }, 'Add a field'),
        h('span', { style: { flex: 1 } }),
        h(ui.Button, { onClick: onCancel }, 'Cancel'),
        h(ui.Button, { variant: 'primary', disabled: busy, onClick: create }, busy ? 'Creating...' : 'Create the model'))));
}
