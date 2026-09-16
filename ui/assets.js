/**
 * Assets: the images and files of the space as a grid, one selected on the right with where it
 * is used and the alt text of each use (editable), and Delete for the unused.
 */
import { ago } from './helpers.js';
import { Panel, Stat, Health, List, ListRow } from './kit.js';

const bytes = (n) => (!n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

export function Assets({ host, bio, space, q, selected, onSelect, onOpenEntry }) {
  const { h, ui, tokens } = host;
  const { useState, useEffect } = host.react;
  const [data, setData] = useState(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [q, space]);
  useEffect(() => { setData(null); bio(`/assets?query=${encodeURIComponent(q || '')}&limit=48&offset=${offset}`).then(setData).catch((e) => setData({ error: e.message, assets: [] })); }, [q, offset, space]);
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const empty = (text) => h('p', { className: 'mlead', style: { margin: 0 } }, text);
  const list = data ? data.assets || [] : [];
  const isImg = (a) => /image\//.test(a.type || '') || /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(a.url || '');
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    h('div', { className: 'mstats mstats--head' },
      Stat(host, { label: 'Shown', value: !data ? '...' : list.length, tone: 'brass', hint: data && data.totalMatches !== undefined ? `${data.totalMatches} match` : q ? 'searching the whole space' : 'newest first' }),
      Stat(host, { label: 'Images', value: !data ? '...' : list.filter(isImg).length, tone: 'muted' }),
      Stat(host, { label: 'Other files', value: !data ? '...' : list.filter((a) => !isImg(a)).length, tone: 'muted' }),
      Stat(host, { label: 'Size on this page', value: !data ? '...' : bytes(list.reduce((n, a) => n + (a.bytes || 0), 0)) || '-', tone: 'muted' })),
    Panel(host, { title: 'Assets', wide: true, action: h('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
      offset > 0 ? h(ui.Button, { className: 'sy-btn--sm', onClick: () => setOffset(Math.max(0, offset - 48)) }, 'Newer') : null,
      data && data.hasMore ? h(ui.Button, { className: 'sy-btn--sm', onClick: () => setOffset(offset + 48) }, 'Older') : null,
      meta(data ? `${offset + 1}-${offset + list.length}` : '')) },
      !data ? h(ui.Skeleton, { count: 6, height: 18 }) : data.error ? empty(data.error) : list.length ? h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 } },
        list.map((a) => h('button', { key: a.id, type: 'button', onClick: () => onSelect(a), title: a.name, style: { textAlign: 'left', padding: 0, border: `1px solid ${selected && selected.id === a.id ? 'var(--sy-brass)' : tokens('line')}`, borderRadius: 8, background: 'var(--sy-surface)', cursor: 'pointer', overflow: 'hidden', color: 'inherit', font: 'inherit' } },
          h('div', { style: { height: 96, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } }, isImg(a) ? h('img', { src: a.url, alt: '', loading: 'lazy', style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' } }) : h('span', { className: 'mpanel__meta' }, (a.type || 'file').split('/').pop())),
          h('div', { style: { padding: '6px 8px' } }, h('div', { style: { fontSize: 'var(--sy-fs-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, a.name || a.id), h('div', { className: 'mpanel__meta' }, `${a.width && a.height ? `${a.width}x${a.height} - ` : ''}${bytes(a.bytes)}`)))))
        : empty(q ? 'No asset matches.' : 'No asset in this space.')));
}

export function AssetsAside({ host, bio, space, selected, onOpenEntry, onChanged }) {
  const { h, ui, notify } = host;
  const { useState, useEffect } = host.react;
  const [usages, setUsages] = useState(null);
  const [alt, setAlt] = useState({});
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setUsages(null); setAlt({}); setConfirm(false); if (selected) bio(`/asset-usage?url=${encodeURIComponent(selected.url)}`).then((d) => setUsages(d.usages || [])).catch(() => setUsages([])); }, [selected && selected.id, space]);
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const FILL = { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }, bodyStyle: { flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' } };
  if (!selected) return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } }, Panel(host, { title: 'This asset' }, h('p', { className: 'mlead', style: { margin: 0 } }, 'Pick an asset to see where it is used, fix its alt text where it is used, or delete it when nothing uses it.')));
  const setUsageAlt = async (u) => {
    const text = (alt[`${u.model}/${u.entryId}`] !== undefined ? alt[`${u.model}/${u.entryId}`] : u.altText || '').trim();
    setBusy(`${u.model}/${u.entryId}`);
    try { await bio('/asset-usage', { method: 'PATCH', body: JSON.stringify({ url: selected.url, model: u.model, entryId: u.entryId, altText: text }) }); notify(`Alt text set in ${u.entryName}`, 'moss'); const d = await bio(`/asset-usage?url=${encodeURIComponent(selected.url)}`); setUsages(d.usages || []); }
    catch (e) { notify(e.message, 'rosin'); } finally { setBusy(null); }
  };
  const remove = async () => { setBusy('delete'); try { await bio(`/assets/${encodeURIComponent(selected.id)}`, { method: 'DELETE' }); notify('Asset deleted', 'moss'); onChanged(); } catch (e) { notify(e.message, 'rosin'); } finally { setBusy(null); setConfirm(false); } };
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)', flex: 1, minHeight: 0, height: '100%' } },
    Panel(host, { title: 'This asset', action: h('a', { className: 'mpanel__meta', href: selected.url, target: '_blank', rel: 'noreferrer' }, 'open') },
      /image\//.test(selected.type || '') || /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(selected.url || '') ? h('img', { src: selected.url, alt: '', style: { width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginBottom: 'var(--sy-s2)' } }) : null,
      h(ui.InfoGrid, { items: [{ label: 'Name', value: selected.name || selected.id }, { label: 'Type', value: selected.type || '-' }, { label: 'Size', value: `${selected.width && selected.height ? `${selected.width}x${selected.height}, ` : ''}${bytes(selected.bytes) || '-'}` }, { label: 'Last used', value: selected.lastUsed ? ago(selected.lastUsed) : '-' }] })),
    Panel(host, { title: 'Used in', ...FILL, action: meta(usages === null ? 'searching...' : `${usages.length}`) },
      usages === null ? h(ui.Skeleton, { count: 3, height: 16 }) : usages.length ? h('div', null, usages.map((u) => h('div', { key: `${u.model}/${u.entryId}`, style: { padding: '6px 0' } },
        ListRow(host, { key: 'row', lead: h('span', { className: 'mind-dot', style: { background: u.published === 'published' ? 'var(--sy-moss)' : 'var(--sy-brass)' } }), label: u.entryName, sub: `${u.model}${u.altText ? ` - alt: ${u.altText}` : ' - no alt text'}`, onClick: () => onOpenEntry(u.model, u.entryId) }),
        h('div', { style: { display: 'flex', gap: 6, marginTop: 4 } },
          h(ui.Input, { value: alt[`${u.model}/${u.entryId}`] !== undefined ? alt[`${u.model}/${u.entryId}`] : (u.altText || ''), placeholder: 'Alt text for this use', onChange: (e) => setAlt({ ...alt, [`${u.model}/${u.entryId}`]: e.target.value }), 'aria-label': 'Alt text' }),
          h(ui.Button, { className: 'sy-btn--sm', disabled: busy === `${u.model}/${u.entryId}`, onClick: () => setUsageAlt(u) }, busy === `${u.model}/${u.entryId}` ? '...' : 'Set'))))) : h('p', { className: 'mlead', style: { margin: 0 } }, 'No entry uses it.')),
    usages && !usages.length ? Panel(host, { title: 'Unused', action: meta('safe to delete') }, h('div', { style: { display: 'flex', gap: 6 } }, confirm ? [h(ui.Button, { key: 'y', disabled: !!busy, onClick: remove, style: { color: 'var(--sy-rosin)' } }, busy === 'delete' ? 'Deleting...' : 'Yes, delete it'), h(ui.Button, { key: 'n', className: 'sy-btn--sm', onClick: () => setConfirm(false) }, 'Keep it')] : h(ui.Button, { onClick: () => setConfirm(true) }, 'Delete the asset'))) : null);
}
