/**
 * Insights: every entry with a problem, grouped by the kind of problem. Each row opens the entry.
 */
import { ago } from './helpers.js';
import { Panel, Stat, Health, List, ListRow } from './kit.js';

export function useInsights(host, bio, space, enabled) {
  const { react } = host;
  const { useState, useEffect, useCallback } = react;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(() => { if (!space || !enabled) return; setError(null); bio('/insights').then(setData).catch((e) => { setData(null); setError(e.message); }); }, [bio, space, enabled]);
  useEffect(() => { setData(null); reload(); }, [space, enabled]);
  return { data, error, reload };
}

const KINDS = [
  ['missing-alt', 'Images without alt text', 'accessibility and SEO'],
  ['missing-url', 'Pages without a URL', 'unreachable'],
  ['duplicate-url', 'Pages sharing a URL', 'one wins, the other is hidden'],
  ['missing-field', 'Empty required fields', 'the model says they must be set'],
  ['stale', 'Not touched in 90 days', 'published, and old'],
  ['draft', 'Drafts', 'not live'],
];
const has = (e, k) => (k === 'missing-field' ? e.issues.some((i) => i.startsWith('missing-field:')) : e.issues.includes(k));

export function Insights({ host, insights, q, onOpen }) {
  const { h, ui } = host;
  const { data, error } = insights;
  const { useState } = host.react;
  const [kind, setKind] = useState('');
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const empty = (text) => h('p', { className: 'mlead', style: { margin: 0 } }, text);
  if (error) return h(ui.EmptyState, { title: 'Could not read the entries', body: error });
  const entries = (data ? data.entries || [] : []).filter((e) => e.issues.length && (!q || `${e.name} ${e.modelName}`.toLowerCase().includes(q)));
  const c = data ? data.counts : null;
  const row = (e) => ListRow(host, { key: `${e.modelName}-${e.id}`, lead: h('span', { className: 'mind-dot', style: { background: e.issues.some((i) => i !== 'draft' && i !== 'stale') ? 'var(--sy-rosin)' : 'var(--sy-brass)' } }), label: e.name, sub: `${e.modelName} - ${e.issues.map((i) => i.replace('missing-field:', 'empty ')).join(', ')}${e.imageIssues && e.imageIssues.length ? ` - ${e.imageIssues.length} image${e.imageIssues.length === 1 ? '' : 's'}` : ''}`, meta: e.lastUpdated ? ago(e.lastUpdated) : '', onClick: () => onOpen(e.modelName, e.id) });
  const shown = kind ? entries.filter((e) => has(e, kind)) : entries;
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    h('div', { className: 'mstats mstats--head' },
      Stat(host, { label: 'Entries read', value: !c ? '...' : c.total, tone: 'brass' }),
      Stat(host, { label: 'With a problem', value: !data ? '...' : entries.filter((e) => e.issues.some((i) => i !== 'draft')).length, tone: entries.some((e) => e.issues.some((i) => i !== 'draft')) ? 'rosin' : 'moss', hint: 'beyond being a draft' }),
      Stat(host, { label: 'Images without alt', value: !c ? '...' : c.imagesMissingAlt, tone: c && c.imagesMissingAlt ? 'rosin' : 'muted', hint: c ? `of ${c.totalImages}` : undefined }),
      Stat(host, { label: 'Drafts', value: !c ? '...' : c.drafts, tone: 'muted' })),
    h('div', { className: 'mhealth' }, ...KINDS.map(([k, label]) => Health(host, { key: k, label, value: !data ? '...' : entries.filter((e) => has(e, k)).length }))),
    Panel(host, { title: kind ? KINDS.find(([k]) => k === kind)[1] : 'Everything to look at', wide: true, action: h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, h(ui.Chip, { on: !kind, onClick: () => setKind('') }, 'All'), ...KINDS.map(([k, label]) => h(ui.Chip, { key: k, on: kind === k, onClick: () => setKind(k) }, label.split(' ')[0] === 'Images' ? 'Alt text' : label.split(' ').slice(0, 2).join(' ')))) },
      !data ? h(ui.Skeleton, { count: 8, height: 18 }) : shown.length ? h('div', { style: { maxHeight: 640, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' } }, List(host, shown.sort((a, b) => b.issues.length - a.issues.length).slice(0, 200).map(row))) : empty(kind ? 'Nothing of that kind.' : 'Every entry is clean.')));
}

export function InsightsAside({ host, insights, onOpen }) {
  const { h, ui } = host;
  const { data } = insights;
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const models = data ? data.models || [] : [];
  const perModel = models.map((m) => ({ name: m.name, count: (data.entries || []).filter((e) => e.modelName === m.name && e.issues.some((i) => i !== 'draft')).length })).filter((m) => m.count).sort((a, b) => b.count - a.count);
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    Panel(host, { title: 'By model', action: meta(data ? `${perModel.length}` : '...') },
      !data ? h(ui.Skeleton, { count: 4, height: 16 }) : perModel.length ? List(host, perModel.map((m) => ListRow(host, { key: m.name, label: m.name, meta: `${m.count}` }))) : h('p', { className: 'mlead', style: { margin: 0 } }, 'No model has a problem beyond drafts.')),
    data && (data.counts.emptyModels || []).length ? Panel(host, { title: 'Empty models', action: meta(`${data.counts.emptyModels.length}`) }, h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } }, data.counts.emptyModels.map((m) => h(ui.Chip, { key: m }, m)))) : null,
    Panel(host, { title: 'How it reads' }, h('p', { className: 'mlead', style: { margin: 0 } }, 'Up to 200 entries per model. Stale means published and untouched for 90 days. Alt text is checked on Image blocks and on fields whose name says image.')));
}
