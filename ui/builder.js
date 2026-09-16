/**
 * Builder.io in Cadence 3.0: three regions and a header, like the other plugins.
 *
 *   Sidebar: Overview, Content, Insights, Assets, Studio, Ask, Spaces; the space this screen
 *   is on (it follows the repository the active shell is on), its environment, a search.
 *   Main: the space as a bento, a model's entries, one entry as a dashboard you can edit and
 *   publish, the issues, the assets, the code side, questions.
 *   Right: what to fix first, the models, or the entry's preview and facts.
 *
 * Every call carries ?space=<name>, so two screens on two repositories never fight over a
 * global active space. Private keys never reach the browser.
 */
import { ensureStyles, NavItem, Section } from './kit.js';
import { ago } from './helpers.js';
import { useHealth, Overview, OverviewAside } from './overview.js';
import { Models, Entries, useEntry, EntryPage, EntryAside, ContentAside } from './content.js';
import { useInsights, Insights, InsightsAside } from './insights.js';
import { Assets, AssetsAside } from './assets.js';
import { Studio, StudioAside } from './studio.js';
import { Spaces } from './spaces.js';
import { Ask } from './ask.js';
import { useModel, ModelTools, NewEntry, Schema, FindReplace, ExportModel, Generate, DeleteModel, NewModel } from './model.js';

export const API = '/api/plugins/builderio';

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'chart', hint: 'The space: models, entries, drafts, what needs attention, what changed last.' },
  { id: 'content', label: 'Content', icon: 'list', hint: 'Models and their entries. Open one to read, edit, preview and publish it.' },
  { id: 'insights', label: 'Insights', icon: 'warning', hint: 'Entries with a problem: drafts, stale, missing alt text, missing or duplicate URLs, empty required fields.' },
  { id: 'assets', label: 'Assets', icon: 'epic', hint: 'Images and files in the space, where they are used, and their alt text.' },
  { id: 'studio', label: 'Studio', icon: 'branch', hint: 'The code side: the components this repository registers with Builder.' },
  { id: 'ask', label: 'Ask', icon: 'search', hint: 'A question about the content. The AI reads the space for you.' },
  { id: 'spaces', label: 'Spaces', icon: 'story', hint: 'The Builder spaces this workspace knows, their repositories and environments.' },
];

function Builder({ host }) {
  const { h, ui, api, notify, context } = host;
  const { useState, useEffect, useCallback, useMemo } = host.react;
  const [tab, setTab] = useState('overview');
  const [spaces, setSpaces] = useState(null);
  const [space, setSpace] = useState(() => { try { return localStorage.getItem('sy.bio.space') || ''; } catch { return ''; } });
  const [q, setQ] = useState('');
  const [openModel, setOpenModel] = useState(null);
  const [openEntry, setOpenEntry] = useState(null);
  const [openAsset, setOpenAsset] = useState(null);
  const [mode, setMode] = useState(null);
  const [seed, setSeed] = useState(null);
  useEffect(() => { ensureStyles(); }, []);
  // Every call names the space, so the screen never depends on a global choice.
  const bio = useCallback((path, opts) => api(`${API}${path}${path.includes('?') ? '&' : '?'}space=${encodeURIComponent(space)}`, opts), [api, space]);
  const loadSpaces = useCallback(() => api(`${API}/spaces`).then((d) => {
    const list = d.spaces || [];
    setSpaces(list);
    // The space this screen starts on: the one whose repository is the active shell's, then the remembered one, then the stored active one.
    const focused = ((context && context()) || {}).focused;
    const norm = (v) => String(v || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    const byRepo = focused && focused.path ? list.find((sp) => sp.repoPath && norm(sp.repoPath) === norm(focused.path)) : null;
    setSpace((cur) => (byRepo ? byRepo.name : (cur && list.some((sp) => sp.name === cur)) ? cur : (d.activeSpace && list.some((sp) => sp.name === d.activeSpace)) ? d.activeSpace : (list[0] ? list[0].name : '')));
  }).catch((e) => { setSpaces([]); notify(e.message, 'rosin'); }), [api, context]);
  useEffect(() => { loadSpaces(); }, [loadSpaces]);
  useEffect(() => { try { if (space) localStorage.setItem('sy.bio.space', space); } catch {} }, [space]);
  const current = (spaces || []).find((sp) => sp.name === space) || null;
  const health = useHealth(host, bio, space, tab !== 'spaces');
  const insights = useInsights(host, bio, space, tab === 'insights' || tab === 'overview');
  const entry = useEntry(host, bio, openEntry);
  const schema = useModel(host, bio, openModel);
  const leave = () => { setOpenEntry(null); setOpenAsset(null); setMode(null); setSeed(null); };
  const setEnv = async (id) => { try { await bio('/env', { method: 'POST', body: JSON.stringify({ env: id }) }); await loadSpaces(); health.reload(); notify(`On ${id}`, 'moss'); } catch (e) { notify(e.message, 'rosin'); } };
  const nav = NAV.find((n) => n.id === tab) || NAV[0];
  const filtered = useMemo(() => q.trim().toLowerCase(), [q]);
  const configured = !!(current && (current.environments || []).some((e) => e.publicKey && e.privateKeySet));

  const left = h('div', { className: 'sb' },
    h('div', { className: 'sb__head' }, h('span', { className: 'sb__title' }, 'Builder.io')),
    h('div', { className: 'mind-stats' },
      !health.data ? h('span', null, spaces === null ? 'reading the spaces...' : configured ? 'reading the space...' : 'no space configured') : [h('span', { key: 'm' }, `${health.data.totalModels} models`), h('span', { key: 'e' }, `${health.data.totalEntries} entries`), h('span', { key: 'd' }, `${health.data.totalDrafts} drafts`)]),
    h('ul', { className: 'sb__list', role: 'list' },
      NAV.map((n) => NavItem(host, {
        key: n.id, icon: host.icons[n.icon], label: n.label, active: tab === n.id && !openEntry, title: n.hint,
        badge: n.id === 'content' && health.data ? (health.data.totalEntries || undefined) : n.id === 'insights' && insights.data ? ((insights.data.entries || []).filter((e) => e.issues.length).length || undefined) : n.id === 'spaces' && spaces ? (spaces.length || undefined) : undefined,
        onClick: () => { setTab(n.id); leave(); if (n.id !== 'content') setOpenModel(null); },
      }))),
    h('div', { style: { flex: 1 } }),
    Section(host, 'Space'),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 var(--sy-s3) var(--sy-s2)' } },
      h(ui.Select, { value: space, onChange: (e) => { setSpace(e.target.value); leave(); setOpenModel(null); }, 'aria-label': 'Space' },
        (spaces || []).map((sp) => h('option', { key: sp.name, value: sp.name }, sp.name)),
        !(spaces || []).length ? h('option', { value: '' }, 'No space yet') : null),
      current && (current.environments || []).length > 1 ? h(ui.Select, { value: current.activeEnv || '', onChange: (e) => setEnv(e.target.value), 'aria-label': 'Environment' },
        current.environments.map((e) => h('option', { key: e.id, value: e.id }, `${e.label}${e.publicKey ? '' : ' (no keys)'}`))) : null,
      tab === 'content' || tab === 'insights' || tab === 'assets' || tab === 'studio' ? h(ui.Input, { value: q, placeholder: tab === 'assets' ? 'Search assets' : tab === 'studio' ? 'Search components' : 'Search entries', onChange: (e) => setQ(e.target.value), 'aria-label': 'Search' }) : null),
    h('div', { className: 'sb__foot' }, openEntry ? 'One entry. Back to the model from the header.' : openModel ? 'One model. Back to the models from the header.' : nav.hint));

  const modelRow = openModel && health.data ? (health.data.models || []).find((m) => m.name === openModel) : null;
  const header = h('div', { className: 'mind-view__head' },
    h('div', null,
      h('h1', { className: 'stage-title' }, openEntry ? (entry.data ? entry.data.name || openEntry.id : 'Entry') : mode === 'new-model' ? 'New model' : openModel ? openModel : nav.label),
      h('p', { style: { margin: 0, color: 'var(--sy-text-3)', fontSize: 'var(--sy-fs-sm)' } },
        openEntry ? `${openEntry.model} - ${entry.data ? (entry.data.published === 'published' ? 'published' : 'draft') : 'reading...'}${entry.data && entry.data.lastUpdated ? ` - updated ${ago(entry.data.lastUpdated)}` : ''}` : openModel ? (modelRow ? `${modelRow.kind} model - ${modelRow.total} entries, ${modelRow.drafts} drafts.` : 'A model.') : `${nav.hint}${space ? ` On ${space}${current && current.activeEnv ? ` (${current.activeEnv})` : ''}.` : ''}`)),
    h('div', { className: 'mind-view__actions' },
      current && current.dashboardUrl && !openEntry ? h('a', { className: 'sy-btn', href: current.dashboardUrl, target: '_blank', rel: 'noreferrer' }, 'Open Builder') : null,
      tab === 'content' && openModel && !openEntry && !mode ? h(ui.Button, { variant: 'primary', onClick: () => setMode('new') }, 'New entry') : null,
      tab === 'content' && !openModel && !openEntry && mode !== 'new-model' ? h(ui.Button, { variant: 'primary', onClick: () => setMode('new-model') }, 'New model') : null,
      openEntry ? h(ui.Button, { onClick: () => { setOpenEntry(null); setSeed(null); } }, 'Back to the model') : mode ? h(ui.Button, { onClick: () => { setMode(null); setSeed(null); } }, openModel ? 'Back to the entries' : 'Back to the models') : openModel ? h(ui.Button, { onClick: () => setOpenModel(null) }, 'Back to the models') : h(ui.Button, { onClick: () => { health.reload(true); insights.reload(); loadSpaces(); } }, 'Refresh')));

  const openTheEntry = (model, id) => { setTab('content'); setOpenModel(model); setOpenAsset(null); setOpenEntry({ model, id }); };
  // The stage is a column: header on top, the screen below taking the rest, so a screen that
  // wants the full height (an entry) gets exactly the space left and never a page scrollbar.
  const main = h('div', { style: { padding: '12px 16px 24px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } },
    spaces && !spaces.length && tab !== 'spaces' ? h(ui.EmptyState, { title: 'No Builder space yet', body: 'Add one under Spaces: a name, the repository it belongs to, and the keys of each environment.' })
      : !configured && tab !== 'spaces' && spaces && spaces.length ? h(ui.EmptyState, { title: `${space || 'This space'} has no keys`, body: 'Give its environment a public and a private key under Spaces.' })
      : openEntry
        ? h(EntryPage, { host, bio, space, model: openEntry.model, id: openEntry.id, entry, health, onChanged: () => { entry.reload(); health.reload(true); insights.reload(); }, onClose: () => setOpenEntry(null), onDuplicate: (d) => { setSeed(d); setOpenEntry(null); setMode('new'); } })
      : tab === 'content'
        ? (mode === 'new-model' ? h(NewModel, { host, bio, onCreated: (name) => { setMode(null); health.reload(true); setOpenModel(name); }, onCancel: () => setMode(null) })
          : openModel && mode === 'new' ? h(NewEntry, { host, bio, model: openModel, schema: schema.model, seed, onCreated: (id) => { setMode(null); setSeed(null); health.reload(true); setOpenEntry({ model: openModel, id }); }, onCancel: () => { setMode(null); setSeed(null); } })
          : openModel && mode === 'generate' ? h(Generate, { host, bio, model: openModel, schema: schema.model, onCreated: (id) => { setMode(null); health.reload(true); insights.reload(); if (id) setOpenEntry({ model: openModel, id }); }, onCancel: () => setMode(null) })
          : openModel && mode === 'schema' ? h(Schema, { host, bio, model: openModel, schema: schema.model, onChanged: () => { schema.reload(); health.reload(true); }, onCancel: () => setMode(null) })
          : openModel && mode === 'replace' ? h(FindReplace, { host, bio, model: openModel, schema: schema.model, onDone: () => { setMode(null); health.reload(true); insights.reload(); }, onCancel: () => setMode(null) })
          : openModel && mode === 'export' ? h(ExportModel, { host, bio, model: openModel, onCancel: () => setMode(null) })
          : openModel && mode === 'delete' ? h(DeleteModel, { host, bio, model: openModel, schema: schema.model, modelRow, onDeleted: () => { setMode(null); setOpenModel(null); health.reload(true); }, onCancel: () => setMode(null) })
          : openModel ? h(Entries, { host, bio, space, model: openModel, modelRow, q: filtered, onOpen: (id) => setOpenEntry({ model: openModel, id }) })
          : h(Models, { host, health, q: filtered, onOpen: (m) => { setOpenModel(m); setMode(null); } }))
      : tab === 'insights' ? h(Insights, { host, insights, q: filtered, onOpen: openTheEntry })
      : tab === 'assets' ? h(Assets, { host, bio, space, q: filtered, selected: openAsset, onSelect: setOpenAsset, onOpenEntry: openTheEntry })
      : tab === 'studio' ? h(Studio, { host, bio, space, current, q: filtered })
      : tab === 'ask' ? h(Ask, { host, api: API, space, health, onOpen: openTheEntry })
      : tab === 'spaces' ? h(Spaces, { host, api: API, spaces, current: space, onChanged: loadSpaces, onPick: (n) => setSpace(n) })
      : h(Overview, { host, health, insights, q: filtered, onOpenEntry: openTheEntry, onOpenModel: (m) => { setTab('content'); setOpenModel(m); setMode(null); }, onAction: (a) => { if (a === 'new-model') { setTab('content'); setOpenModel(null); setMode('new-model'); } else if (a === 'insights') setTab('insights'); else if (a === 'assets') setTab('assets'); else if (a === 'ask') setTab('ask'); } }));

  const right = openEntry
    ? h(EntryAside, { host, bio, space, entry, current, model: openEntry.model })
    : tab === 'content' && openModel ? h(ModelTools, { host, model: schema.model, modelRow, mode, setMode: (m) => { setSeed(null); setMode(m); }, onOpenEntry: openTheEntry, health })
    : tab === 'content' ? h(ContentAside, { host, health, openModel, onOpenModel: (m) => { setOpenModel(m); setMode(null); }, onOpenEntry: openTheEntry })
    : tab === 'insights' ? h(InsightsAside, { host, insights, onOpen: openTheEntry })
    : tab === 'assets' ? h(AssetsAside, { host, bio, space, selected: openAsset, onOpenEntry: openTheEntry, onChanged: () => setOpenAsset(openAsset ? { ...openAsset } : null) })
    : tab === 'studio' ? h(StudioAside, { host, current })
    : tab === 'spaces' ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } }, h('div', { className: 'mpanel' }, h('div', { className: 'mpanel__head' }, h('span', { className: 'mpanel__title' }, 'How spaces work')), h('div', { className: 'mpanel__body' }, h('p', { className: 'mlead', style: { margin: 0 } }, 'A space is one Builder.io space with its keys. Give it the repository it belongs to and every Builder screen follows the shell that is on that repository. Environments hold their own keys and site URL; the private key is typed once and never shown again.'))))
    : tab === 'ask' ? h(OverviewAside, { host, health, insights, onOpenEntry: openTheEntry, onOpenModel: (m) => { setTab('content'); setOpenModel(m); } })
    : h(OverviewAside, { host, health, insights, onOpenEntry: openTheEntry, onOpenModel: (m) => { setTab('content'); setOpenModel(m); } });

  return h(ui.Regions, { left, right, paneId: `bio-${tab}`, paneLabel: openEntry ? 'This entry' : tab === 'content' && openModel ? 'This model' : tab === 'content' ? 'Models' : tab === 'insights' ? 'By kind' : tab === 'assets' ? 'This asset' : tab === 'studio' ? 'Repository' : 'Attention' },
    h('div', { className: 'bio-main', style: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 57px)' } }, h('div', { style: { padding: '32px 16px 0', flex: 'none' } }, header), main));
}

Builder.cadenceComponent = true;
export default Builder;
