const statusLabels = {
  pending: 'Queued',
  running: 'Running',
  waiting: 'Waiting',
  idle: 'Idle',
  completed: 'Completed',
  failed: 'Failed',
  killed: 'Stopped',
  paused: 'Paused',
  unknown: 'Last status unknown',
};

function shortLabel(value) {
  return typeof value === 'string'
    ? value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').trim().slice(0, 80)
    : '';
}

export function updateAgents(previous, current) {
  const agents = new Map(previous.map(agent => [agent.id, agent]));
  const live = new Set();
  for (const agent of current) {
    if (agent.kind && agent.kind !== 'local_agent') continue;
    if (typeof agent.id !== 'string' || !agent.id) continue;
    live.add(agent.id);
    agents.set(agent.id, {
      id: agent.id,
      parentId: agent.parentId,
      name: shortLabel(agent.description) || shortLabel(agent.name) || shortLabel(agent.type) || 'Subagent',
      status: Object.hasOwn(statusLabels, agent.status) ? agent.status : 'unknown',
    });
  }
  for (const [id, agent] of agents) {
    if (!live.has(id) && !['completed', 'failed', 'killed'].includes(agent.status)) {
      agents.set(id, { ...agent, status: 'unknown' });
    }
  }
  return [...agents.values()];
}

export function graphRows(agents) {
  const byId = new Map(agents.map(agent => [agent.id, agent]));
  const children = new Map();
  for (const agent of agents) {
    const parent = agent.parentId || null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(agent);
  }
  const rows = [];
  const seen = new Set();
  function visit(agent, prefix, last, parentKnown) {
    if (seen.has(agent.id)) return;
    seen.add(agent.id);
    const branch = parentKnown ? (last ? '└─ ' : '├─ ') : '   ';
    rows.push({ ...agent, prefix: prefix + branch, statusLabel: statusLabels[agent.status], parentKnown });
    const descendants = children.get(agent.id) ?? [];
    const indent = prefix + (last ? '   ' : '│  ');
    descendants.forEach((child, index) => visit(child, indent, index === descendants.length - 1, true));
  }
  const roots = children.get(null) ?? [];
  roots.forEach((agent, index) => visit(agent, '', index === roots.length - 1, true));
  for (const agent of agents) {
    if (!seen.has(agent.id) && agent.parentId && !byId.has(agent.parentId)) visit(agent, '', true, false);
  }
  for (const agent of agents) if (!seen.has(agent.id)) visit(agent, '', true, false);
  return rows;
}

export function summarize(agents) {
  const active = agents.filter(agent => agent.status === 'running');
  if (active.length) return (active.length > 1 ? 'Parallel: ' : 'Now: ') + active.map(agent => agent.name).join(' + ');
  const waiting = agents.filter(agent => ['pending', 'waiting', 'paused'].includes(agent.status));
  if (waiting.length) return 'Waiting: ' + waiting.map(agent => agent.name).join(' + ');
  return agents.length ? 'No subagent currently running' : 'No subagents observed in this session';
}

export function readPlan(input) {
  const items = JSON.parse(input);
  if (!Array.isArray(items) || items.length > 30) throw new Error('Expected up to 30 plan items.');
  const ids = new Set();
  const plan = items.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(item.id) ||
        ids.has(item.id) || !shortLabel(item.title)) {
      throw new Error('Each item needs a unique lowercase id and a title.');
    }
    ids.add(item.id);
    const dependsOn = item.dependsOn ?? [];
    if (!Array.isArray(dependsOn) || dependsOn.some(id => typeof id !== 'string')) {
      throw new Error('dependsOn must be a list of plan ids.');
    }
    if (item.agentId !== undefined && (typeof item.agentId !== 'string' || !item.agentId.trim())) {
      throw new Error('agentId must be a nonempty string.');
    }
    return { id: item.id, title: shortLabel(item.title), dependsOn, agentId: item.agentId };
  });
  const byId = new Map(plan.map(item => [item.id, item]));
  const checked = new Set();
  function check(id, visiting) {
    if (checked.has(id)) return;
    if (!byId.has(id) || visiting.has(id)) throw new Error('Plan dependencies must exist and be acyclic.');
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) check(dependency, visiting);
    visiting.delete(id);
    checked.add(id);
  }
  for (const item of plan) check(item.id, new Set());
  return plan;
}
