/**
 * Studio: the code side of the space. The components the repository registers with Builder,
 * the ones it only defines, and a shell on the repository to work on them.
 */
import { Panel, Stat, Health, List, ListRow } from './kit.js';

export function Studio({ host, bio, space, current, q }) {
  const { h, ui, tokens } = host;
  const { useState, useEffect } = host.react;
  const [info, setInfo] = useState(null);
  const [files, setFiles] = useState(null);
  const [open, setOpen] = useState(null);
  const [registered, setRegistered] = useState({});
  useEffect(() => {
    setInfo(null); setFiles(null); setOpen(null); setRegistered({});
    if (!current || !current.repoPath) return;
    bio('/repo/info').then(setInfo).catch((e) => setInfo({ error: e.message }));
    bio('/repo/components').then(async (list) => {
      const arr = Array.isArray(list) ? list : [];
      setFiles(arr);
      // Which files register with Builder: read the likely ones (small repos, bounded).
      const reg = {};
      await Promise.all(arr.slice(0, 80).map(async (f) => { try { const r = await bio(`/repo/file/${encodeURIComponent(f.relativePath)}`); const c = r.content || ''; if (/Builder\.registerComponent|registerComponent\(|builder\.registerComponent|@builder\.io\/react|@builder\.io\/sdk/.test(c)) reg[f.relativePath] = /registerComponent/.test(c) ? 'registers' : 'uses the SDK'; } catch (_) {} }));
      setRegistered(reg);
    }).catch((e) => setFiles({ error: e.message }));
  }, [current && current.repoPath, space]);
  const meta = (text) => h('span', { className: 'mpanel__meta' }, text);
  const empty = (text) => h('p', { className: 'mlead', style: { margin: 0 } }, text);
  if (!current || !current.repoPath) return h(ui.EmptyState, { title: 'No repository on this space', body: 'Give the space a repository under Spaces, and its Builder components show up here.' });
  const list = Array.isArray(files) ? files.filter((f) => !q || f.relativePath.toLowerCase().includes(q)) : [];
  const regs = list.filter((f) => registered[f.relativePath] === 'registers');
  const openFile = async (f) => { try { const r = await bio(`/repo/file/${encodeURIComponent(f.relativePath)}`); setOpen({ ...f, content: r.content || '' }); } catch (e) { setOpen({ ...f, content: e.message }); } };
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    h('div', { className: 'mstats mstats--head' },
      Stat(host, { label: 'Component files', value: files === null ? '...' : list.length, tone: 'brass' }),
      Stat(host, { label: 'Registered with Builder', value: files === null ? '...' : regs.length, tone: regs.length ? 'moss' : 'muted', hint: 'Builder.registerComponent found' }),
      Stat(host, { label: 'Framework', value: info ? info.framework || '-' : '...', tone: 'muted' }),
      Stat(host, { label: 'Repository', value: current.repoPath.split(/[\\/]/).pop(), tone: 'muted', hint: current.repoPath })),
    h('div', { className: 'bio-row2' },
      Panel(host, { title: 'Registered components', action: meta(files === null ? 'reading...' : `${regs.length}`) },
        files === null ? h(ui.Skeleton, { count: 5, height: 16 }) : files.error ? empty(files.error) : regs.length ? List(host, regs.map((f) => ListRow(host, { key: f.relativePath, lead: h('span', { className: 'mind-dot', style: { background: 'var(--sy-moss)' } }), label: f.name, sub: f.relativePath, onClick: () => openFile(f) }))) : empty('No file calls Builder.registerComponent in the component folders.')),
      Panel(host, { title: 'All component files', action: meta(files === null ? '' : `${list.length}`) },
        files === null ? h(ui.Skeleton, { count: 5, height: 16 }) : list.length ? h('div', { style: { maxHeight: 480, overflow: 'auto', paddingRight: 14, scrollbarGutter: 'stable' } }, List(host, list.map((f) => ListRow(host, { key: f.relativePath, lead: h('span', { className: 'mind-dot', style: { background: registered[f.relativePath] ? (registered[f.relativePath] === 'registers' ? 'var(--sy-moss)' : 'var(--sy-brass)') : 'var(--sy-text-3)', width: 7, height: 7 } }), label: f.name, sub: `${f.relativePath}${registered[f.relativePath] ? ` - ${registered[f.relativePath]}` : ''}`, onClick: () => openFile(f) })))) : empty('No component files found under components/, src/components/ or app/components/.'))),
    open ? Panel(host, { title: open.relativePath, wide: true, action: h('div', { style: { display: 'flex', gap: 6 } }, host.openShell ? h(ui.Button, { className: 'sy-btn--sm', onClick: () => host.openShell({ repo: current.name, path: current.repoPath }, { launch: true, label: open.name }) }, 'Work on it') : null, h(ui.Button, { className: 'sy-btn--sm', onClick: () => setOpen(null) }, 'Close')) },
      h(ui.CodeEditor, { value: open.content.slice(0, 400000), language: open.name, height: 560, readOnly: true })) : null);
}

export function StudioAside({ host, current }) {
  const { h, ui } = host;
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sy-s3)' } },
    Panel(host, { title: 'Repository' },
      current && current.repoPath ? h('div', null,
        h('p', { className: 'mlead', style: { margin: '0 0 var(--sy-s2)', wordBreak: 'break-all' } }, current.repoPath),
        host.openShell ? h(ui.Button, { variant: 'primary', className: 'sy-btn--sm', onClick: () => host.openShell({ repo: current.name, path: current.repoPath }, { launch: true, label: current.name }) }, 'Start working') : null)
        : h('p', { className: 'mlead', style: { margin: 0 } }, 'No repository on this space.')),
    Panel(host, { title: 'Environments', action: h('span', { className: 'mpanel__meta' }, current ? `${(current.environments || []).length}` : '') },
      current && (current.environments || []).length ? List(host, current.environments.map((e) => ListRow(host, { key: e.id, lead: h('span', { className: 'mind-dot', style: { background: e.id === current.activeEnv ? 'var(--sy-brass)' : 'var(--sy-text-3)' } }), label: e.label, sub: `${e.url || (e.localPort ? `localhost:${e.localPort}` : 'no URL')}${e.publicKey && e.privateKeySet ? '' : ' - keys missing'}` }))) : h('p', { className: 'mlead', style: { margin: 0 } }, 'None.')));
}
