/**
 * Spaces: the Builder spaces this workspace knows. Each has a repository (so the screen can
 * follow the shell), a dashboard URL, and environments with their own keys and site URL.
 * Private keys are typed here and never shown again.
 */
import { Panel, Stat, List, ListRow } from './kit.js';

const blankEnv = () => ({ id: '', label: '', url: '', localPort: '', publicKey: '', privateKey: '' });

function SpaceForm({ host, api: API, initial, onDone, onCancel }) {
  const { h, ui, api, notify } = host;
  const { useState } = host.react;
  const editing = !!initial;
  const [name, setName] = useState(initial ? initial.name : '');
  const [repoPath, setRepoPath] = useState(initial ? initial.repoPath || '' : '');
  const [dashboardUrl, setDashboardUrl] = useState(initial ? initial.dashboardUrl || '' : 'https://builder.io/content');
  const [envs, setEnvs] = useState(initial && (initial.environments || []).length ? initial.environments.map((e) => ({ ...e, privateKey: '' })) : [{ ...blankEnv(), id: 'production', label: 'Production' }]);
  const [busy, setBusy] = useState(false);
  const setEnv = (i, patch) => setEnvs(envs.map((e, k) => (k === i ? { ...e, ...patch } : e)));
  const pickRepo = async () => { if (!host.pickTarget) return; const t = await host.pickTarget({ title: 'Which repository is this space for?', detail: 'The screen follows the shell that is on it.' }); if (t) { setRepoPath(t.path); if (!name) setName(t.repo); } };
  const save = async () => {
    if (!name.trim()) return notify('Give the space a name', 'rosin');
    setBusy(true);
    try {
      const body = { name: name.trim(), repoPath, dashboardUrl, environments: envs.filter((e) => e.label.trim()) };
      if (editing) await api(`${API}/spaces/${encodeURIComponent(initial.name)}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api(`${API}/spaces`, { method: 'POST', body: JSON.stringify(body) });
      notify(editing ? 'Space updated' : 'Space added', 'moss'); onDone(name.trim());
    } catch (e) { notify(e.message, 'rosin'); } finally { setBusy(false); }
  };
  return Panel(host, { title: editing ? `Edit ${initial.name}` : 'New space', wide: true, action: h('span', { className: 'mpanel__meta' }, 'keys stay on this machine') },
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      h('div', { className: 'bio-row2' },
        h(ui.Field, { label: 'Name' }, h(ui.Input, { value: name, placeholder: 'As Builder calls it', onChange: (e) => setName(e.target.value) })),
        h(ui.Field, { label: 'Dashboard URL' }, h(ui.Input, { value: dashboardUrl, onChange: (e) => setDashboardUrl(e.target.value) }))),
      h(ui.Field, { label: 'Repository', hint: 'The local checkout this space belongs to' }, h('div', { style: { display: 'flex', gap: 8 } }, h(ui.Input, { value: repoPath, placeholder: 'C:\\Code\\...', onChange: (e) => setRepoPath(e.target.value), style: { flex: 1 } }), host.pickTarget ? h(ui.Button, { onClick: pickRepo }, 'Choose...') : null)),
      h('div', { className: 'mpanel__meta' }, 'Environments'),
      envs.map((e, i) => h('div', { key: i, style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, alignItems: 'end', padding: '8px 0', borderTop: '1px solid var(--sy-line)' } },
        h(ui.Field, { label: 'Label' }, h(ui.Input, { value: e.label, placeholder: 'Production', onChange: (ev) => setEnv(i, { label: ev.target.value, id: e.id || ev.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }) })),
        h(ui.Field, { label: 'Site URL' }, h(ui.Input, { value: e.url, placeholder: 'https://www.example.com', onChange: (ev) => setEnv(i, { url: ev.target.value }) })),
        h(ui.Field, { label: 'Local port' }, h(ui.Input, { value: e.localPort, placeholder: '3000', onChange: (ev) => setEnv(i, { localPort: ev.target.value }) })),
        h(ui.Field, { label: 'Public key' }, h(ui.Input, { value: e.publicKey, onChange: (ev) => setEnv(i, { publicKey: ev.target.value }) })),
        h(ui.Field, { label: editing && e.privateKeySet ? 'Private key (blank keeps it)' : 'Private key' }, h(ui.Input, { type: 'password', value: e.privateKey, placeholder: 'bpk-...', onChange: (ev) => setEnv(i, { privateKey: ev.target.value }) })),
        h('div', null, envs.length > 1 ? h(ui.Button, { className: 'sy-btn--sm', onClick: () => setEnvs(envs.filter((_, k) => k !== i)) }, 'Remove') : null))),
      h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        h(ui.Button, { className: 'sy-btn--sm', onClick: () => setEnvs([...envs, blankEnv()]) }, 'Add an environment'),
        h('span', { style: { flex: 1 } }),
        h(ui.Button, { onClick: onCancel }, 'Cancel'),
        h(ui.Button, { variant: 'primary', disabled: busy, onClick: save }, busy ? 'Saving...' : editing ? 'Save' : 'Add the space'))));
}

export function Spaces({ host, api: API, spaces, current, onChanged, onPick }) {
  const { h, ui, api, notify } = host;
  const { useState } = host.react;
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const list = spaces || [];
  const remove = async (name) => { try { await api(`${API}/spaces/${encodeURIComponent(name)}`, { method: 'DELETE' }); notify(`${name} removed`, 'moss'); setConfirm(null); onChanged(); } catch (e) { notify(e.message, 'rosin'); } };
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    h('div', { className: 'mstats mstats--head' },
      Stat(host, { label: 'Spaces', value: spaces === null ? '...' : list.length, tone: 'brass' }),
      Stat(host, { label: 'With a repository', value: spaces === null ? '...' : list.filter((s) => s.repoPath).length, tone: 'muted', hint: 'follow the shell' }),
      Stat(host, { label: 'Environments', value: spaces === null ? '...' : list.reduce((n, s) => n + (s.environments || []).length, 0), tone: 'muted' }),
      Stat(host, { label: 'Missing keys', value: spaces === null ? '...' : list.reduce((n, s) => n + (s.environments || []).filter((e) => !(e.publicKey && e.privateKeySet)).length, 0), tone: list.some((s) => (s.environments || []).some((e) => !(e.publicKey && e.privateKeySet))) ? 'rosin' : 'moss' })),
    form !== null ? h(SpaceForm, { host, api: API, initial: form === 'new' ? null : form, onDone: (n) => { setForm(null); onChanged(); onPick(n); }, onCancel: () => setForm(null) })
      : Panel(host, { title: 'Spaces', wide: true, action: h(ui.Button, { className: 'sy-btn--sm', variant: 'primary', onClick: () => setForm('new') }, 'New space') },
        spaces === null ? h(ui.Skeleton, { count: 3, height: 18 }) : list.length ? List(host, list.map((s) => ListRow(host, { key: s.name, lead: h('span', { className: 'mind-dot', style: { background: s.name === current ? 'var(--sy-brass)' : 'var(--sy-text-3)' } }), label: s.name, sub: `${s.repoPath || 'no repository'} - ${(s.environments || []).map((e) => `${e.label}${e.publicKey && e.privateKeySet ? '' : ' (no keys)'}`).join(', ')}`, meta: h('span', { style: { display: 'flex', gap: 6 } }, s.name !== current ? h('button', { type: 'button', className: 'sy-btn sy-btn--sm', onClick: (e) => { e.stopPropagation(); onPick(s.name); } }, 'Use') : null, h('button', { type: 'button', className: 'sy-btn sy-btn--sm', onClick: (e) => { e.stopPropagation(); setForm(s); } }, 'Edit'), confirm === s.name ? h('button', { type: 'button', className: 'sy-btn sy-btn--sm', style: { color: 'var(--sy-rosin)' }, onClick: (e) => { e.stopPropagation(); remove(s.name); } }, 'Yes, remove') : h('button', { type: 'button', className: 'sy-btn sy-btn--sm', onClick: (e) => { e.stopPropagation(); setConfirm(s.name); } }, 'Remove')), onClick: () => onPick(s.name) }))) : h('p', { className: 'mlead', style: { margin: 0 } }, 'No space yet. Add one with its keys.')));
}
