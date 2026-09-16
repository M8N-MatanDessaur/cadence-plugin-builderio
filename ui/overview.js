/**
 * The space as a bento: what it holds, what needs attention, what changed last, and whether
 * the preview site answers.
 */
import { ago } from './helpers.js';
import { Panel, Stat, Health, Bars, List, ListRow } from './kit.js';

export function useHealth(host, bio, space, enabled) {
  const { react } = host;
  const { useState, useEffect, useCallback } = react;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback((fresh) => {
    if (!space || !enabled) return;
    setError(null);
    bio(`/health${fresh ? '?refresh=1' : ''}`).then(setData).catch((e) => { setData(null); setError(e.message); });
  }, [bio, space, enabled]);
  useEffect(() => { setData(null); reload(); }, [space]);
  return { data, error, reload };
}

export const statusColour = (e) => (e.published === 'published' || e.status === 'published' ? 'var(--sy-moss)' : 'var(--sy-brass)');
export const modelRow = (host, m, onOpen) => ListRow(host, { key: m.name, lead: host.h('span', { className: 'mind-dot', style: { background: m.kind === 'page' ? 'var(--sy-brass)' : m.kind === 'section' ? 'var(--sy-moss)' : 'var(--sy-text-3)' } }), label: m.name, sub: `${m.kind} - ${m.fieldCount} field${m.fieldCount === 1 ? '' : 's'} - ${m.published} published${m.drafts ? `, ${m.drafts} draft${m.drafts === 1 ? '' : 's'}` : ''}${m.stale ? ` - ${m.stale} stale` : ''}${m.missingAlt ? ` - ${m.missingAlt} missing alt` : ''}`, meta: `${m.total}`, onClick: () => onOpen(m.name) });
export const entryRow = (host, e, onOpen, extra) => ListRow(host, { key: `${e._modelName || e.modelName}-${e.id}`, lead: host.h('span', { className: 'mind-dot', style: { background: statusColour(e) } }), label: e.name || e.id, sub: `${e._modelName || e.modelName}${e.data && e.data.url ? ` - ${e.data.url}` : ''}${extra ? ` - ${extra}` : ''}`, meta: e.lastUpdated ? ago(e.lastUpdated) : '', onClick: () => onOpen(e._modelName || e.modelName, e.id) });

export function Overview({ host, health, insights, q, onOpenEntry, onOpenModel, onAction }) {
  const { h, ui, api } = host;
  const { useState, useEffect } = host.react;
  const { data, error } = health;
  const [preview, setPreview] = useState(null);
  useEffect(() => { setPreview(null); if (data && data.previewUrl) api(`/api/plugins/builderio/preview-check?url=${encodeURIComponent(data.previewUrl)}`).then(setPreview).catch(() => setPreview({ ok: false })); }, [data && data.previewUrl]);
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const empty = (text) => h('p', { className: 'mlead', style: { margin: 0 } }, text);
  if (error) return h(ui.EmptyState, { title: 'Builder did not answer', body: error });
  const loading = !data;
  const models = (data ? data.models || [] : []).filter((m) => !q || m.name.toLowerCase().includes(q));
  const issues = data ? data.issues || [] : [];
  const c = insights.data ? insights.data.counts : null;
  const byKind = models.reduce((acc, m) => { acc[m.kind] = (acc[m.kind] || 0) + 1; return acc; }, {});
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    h('div', { className: 'mstats mstats--head' },
      Stat(host, { label: 'Entries', value: loading ? '...' : data.totalEntries, tone: 'brass', hint: loading ? undefined : `in ${data.totalModels} model${data.totalModels === 1 ? '' : 's'}` }),
      Stat(host, { label: 'Drafts', value: loading ? '...' : data.totalDrafts, tone: data && data.totalDrafts ? 'brass' : 'muted', hint: 'unpublished' }),
      Stat(host, { label: 'To look at', value: !c ? '...' : c.stale + c.missingAlt + c.missingUrl + c.duplicateUrl + c.missingField, tone: c && (c.stale + c.missingAlt + c.missingUrl + c.duplicateUrl + c.missingField) ? 'rosin' : 'muted', hint: c ? `${c.stale} stale, ${c.missingAlt} without alt` : 'reading the entries...' }),
      Stat(host, { label: 'Preview', value: !data || !data.previewUrl ? 'none' : preview === null ? '...' : preview.ok ? 'up' : 'down', tone: preview && preview.ok ? 'moss' : preview ? 'rosin' : 'muted', hint: data && data.previewUrl ? data.previewUrl.replace(/^https?:\/\//, '') : 'no environment URL' })),
    h('div', { className: 'mhealth' },
      ...Object.entries(byKind).map(([k, n]) => Health(host, { key: k, label: `${k} models`, value: n })),
      Health(host, { label: 'locales', value: loading ? '...' : (data.locales || []).length || 'none' }),
      Health(host, { label: 'environment', value: data ? data.activeEnv || '-' : '...' })),
    onAction ? Panel(host, { title: 'Do', wide: true, action: meta('everything Builder, from here') },
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
        h(ui.Button, { className: 'sy-btn--sm', variant: 'primary', onClick: () => onAction('new-model') }, 'New model'),
        h(ui.Button, { className: 'sy-btn--sm', onClick: () => onOpenModel((models[0] || {}).name || '') }, 'Open a model to add or generate entries'),
        h(ui.Button, { className: 'sy-btn--sm', onClick: () => onAction('insights') }, 'Fix what is stale or missing'),
        h(ui.Button, { className: 'sy-btn--sm', onClick: () => onAction('assets') }, 'Assets and alt text'),
        h(ui.Button, { className: 'sy-btn--sm', onClick: () => onAction('ask') }, 'Ask the AI about the space'))) : null,
    issues.length ? Panel(host, { title: 'Needs attention', wide: true, action: meta(`${issues.length}`) },
      List(host, issues.map((i, k) => ListRow(host, { key: k, lead: h('span', { className: 'mind-dot', style: { background: i.level === 'warn' ? 'var(--sy-brass)' : 'var(--sy-text-3)' } }), label: i.message, sub: i.issue === 'draft' ? 'Content > drafts' : i.issue === 'stale' ? 'Insights > stale' : i.issue === 'missing-alt' ? 'Insights > missing alt' : 'Content' })))) : null,
    h('div', { className: 'bio-row2' },
      Panel(host, { title: 'Models', action: meta(loading ? '' : `${models.length}`) },
        loading ? h(ui.Skeleton, { count: 5, height: 18 }) : models.length ? h('div', { style: { maxHeight: 520, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' } }, List(host, models.slice().sort((a, b) => b.total - a.total).map((m) => modelRow(host, m, onOpenModel)))) : empty('No model in this space.')),
      Panel(host, { title: 'Changed last', action: meta(loading ? '' : `${(data.recent || []).length}`) },
        loading ? h(ui.Skeleton, { count: 5, height: 18 }) : (data.recent || []).length ? List(host, data.recent.map((e) => entryRow(host, e, onOpenEntry))) : empty('Nothing changed lately.'))));
}

export function OverviewAside({ host, health, insights, onOpenEntry, onOpenModel }) {
  const { h, ui } = host;
  const { data } = health;
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const FILL = { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }, bodyStyle: { flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' } };
  const c = insights.data ? insights.data.counts : null;
  const worst = insights.data ? (insights.data.entries || []).filter((e) => e.issues.some((i) => i !== 'draft')).sort((a, b) => b.issues.length - a.issues.length).slice(0, 15) : [];
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)', flex: 1, minHeight: 0, height: '100%' } },
    Panel(host, { title: 'Issues', action: meta(c ? `${c.total} entries read` : '...') },
      c ? Bars(host, { rows: [{ label: 'drafts', value: c.drafts }, { label: 'stale', value: c.stale, color: 'var(--sy-brass)' }, { label: 'missing alt', value: c.missingAlt, color: 'var(--sy-rosin)' }, { label: 'missing url', value: c.missingUrl, color: 'var(--sy-rosin)' }, { label: 'duplicate url', value: c.duplicateUrl, color: 'var(--sy-rosin)' }, { label: 'empty required', value: c.missingField, color: 'var(--sy-brass)' }] }) : h(ui.Skeleton, { count: 5, height: 14 })),
    Panel(host, { title: 'Fix first', ...FILL, action: meta(insights.data ? `${worst.length}` : '...') },
      !insights.data ? h(ui.Skeleton, { count: 4, height: 16 }) : worst.length ? List(host, worst.map((e) => ListRow(host, { key: `${e.modelName}-${e.id}`, lead: h('span', { className: 'mind-dot', style: { background: 'var(--sy-rosin)' } }), label: e.name, sub: `${e.modelName} - ${e.issues.filter((i) => i !== 'draft').join(', ')}`, onClick: () => onOpenEntry(e.modelName, e.id) }))) : h('p', { className: 'mlead', style: { margin: 0 } }, 'Nothing beyond drafts.')),
    data && data.models ? Panel(host, { title: 'Empty models', action: meta(`${data.models.filter((m) => !m.total).length}`) },
      data.models.filter((m) => !m.total).length ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } }, data.models.filter((m) => !m.total).map((m) => h(ui.Chip, { key: m.name, onClick: () => onOpenModel(m.name) }, m.name))) : h('p', { className: 'mlead', style: { margin: 0 } }, 'Every model has content.')) : null);
}
