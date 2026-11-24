import { expect, mock, test } from 'claude-code/testing';

const pane = {
  plugin: 'sr-agent-map',
  component: 'Pane',
  requestId: 'agent-map',
  surface: 'terminal',
  viewport: { columns: 120, rows: 30 },
  props: {
    title: 'Subagent workflow', isFocused: true, bodyColumns: 52,
    placement: 'dock', scroll: { offset: 0, bodyRows: 18 }, view: {},
  },
} as const;

test('the pane updates as nested and parallel subagents run', async ($, on) => {
  const clock = mock.clock(on);
  let registered = '';
  let agents = [
    { id: 'parent', description: 'Review', kind: 'local_agent', status: 'running' },
    { id: 'child', parentId: 'parent', description: 'Find worktrees', kind: 'local_agent', status: 'waiting' },
    { id: 'sibling', description: 'Check docs', kind: 'local_agent', status: 'running' },
    { id: 'other', description: 'Background shell', kind: 'local_bash', status: 'running' },
  ];
  on('session.start', () => ({ cwd: '/work' }));
  on('command.register', ($, event) => {
    registered = event.name;
    return { value: undefined };
  });
  on('agent.list', () => ({ value: agents }));
  on('ui.open', () => ({ value: { isPlaced: true, placement: 'dock' } }));
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
  expect(registered).toBe('agent-map');
  await $.command.run({ command: 'agent-map', args: '' });
  const ui = await $.ui.mount(pane);
  expect(await ui.find({ type: 'Text', text: 'Parallel: Review + Check docs' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: '│  └─ ' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: 'Waiting' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: 'Background shell' })).toBeUndefined();

  agents = agents.map(agent => ({ ...agent, status: agent.id === 'child' ? 'running' : 'completed' }));
  await clock.advance(1000);
  expect(await ui.find({ type: 'Text', text: 'Now: Find worktrees' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: 'Completed' })).toBeDefined();
  agents = [];
  const result = await $.command.run({ command: 'agent-map', args: 'text' });
  expect(result.text).toContain('Review — Completed [parent]');
  expect(result.text).toContain('Find worktrees — Last status unknown [child]');
  await ui.unmount();
});

test('registered plan shows explicit dependencies and survives an invalid replacement', async ($, on) => {
  on('agent.list', () => ({ value: [{ id: 'a', description: 'Review', kind: 'local_agent', status: 'completed' }] }));
  on('ui.open', () => ({ value: { isPlaced: false } }));
  const plan = [{ id: 'review', title: 'Review', agentId: 'a' }, { id: 'test', title: 'Test', dependsOn: ['review'] }];
  await $.command.run({ command: 'agent-map', args: 'plan ' + JSON.stringify(plan) });
  const invalid = [{ id: 'cycle', title: 'Cycle', dependsOn: ['cycle'] }];
  const error = await $.command.run({ command: 'agent-map', args: 'plan ' + JSON.stringify(invalid) });
  expect(error.text).toContain('Plan unchanged');
  const result = await $.command.run({ command: 'agent-map', args: '' });
  expect(result.text).toContain('review: Review — Completed');
  expect(result.text).toContain('test: Test — Planned · after review');
});
