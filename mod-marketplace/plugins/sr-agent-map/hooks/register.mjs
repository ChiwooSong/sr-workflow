import { graphRows, readPlan, summarize, updateAgents } from './graph.mjs';

const paneId = 'agent-map';
const colors = { running: 'cyan', completed: 'green', failed: 'red', waiting: 'yellow', killed: 'yellow' };

export function register(on) {
  let agents = [];
  let plan = [];
  let timer;
  let generation = 0;
  let refreshQueue = Promise.resolve();
  let unavailable = false;

  function refresh(live) {
    const epoch = generation;
    const settled = live.then(value => ({ value }), () => ({ error: true }));
    refreshQueue = refreshQueue.then(async () => {
      if (epoch !== generation) return;
      const result = await settled;
      if (epoch === generation) {
        unavailable = result.error === true;
        if (!unavailable) agents = updateAgents(agents, result.value);
      }
    }).catch(() => { if (epoch === generation) unavailable = true; });
    return refreshQueue;
  }

  function planStatus(item, rows) {
    const agent = rows.find(row => row.id === item.agentId);
    if (agent) return agent.statusLabel;
    if (item.agentId) return 'Linked agent not observed';
    return 'Planned';
  }

  function asText() {
    const rows = graphRows(agents);
    const output = [unavailable ? 'Agent data unavailable' : summarize(agents), '', 'Main Claude'];
    for (const row of rows) {
      output.push(row.prefix + row.name + ' — ' + row.statusLabel + ' [' + row.id + ']' +
        (row.parentKnown ? '' : ' (parent not observed)'));
    }
    if (plan.length) {
      output.push('', 'Registered plan');
      for (const item of plan) {
        output.push(item.id + ': ' + item.title + ' — ' + planStatus(item, rows) +
          (item.dependsOn.length ? ' · after ' + item.dependsOn.join(', ') : ''));
      }
    }
    return output.join('\n');
  }

  on('session.start', async ($, event, next) => {
    const result = await next(event);
    await $.command.register({ name: 'agent-map', description: 'Show this session’s live subagent map', argumentHint: '[text | plan <JSON>]' });
    await refresh($.agent.list());
    return result;
  });

  on('agent.spawn', async ($, event, next) => {
    const result = await next(event);
    await refresh($.agent.list());
    return result;
  }).catch(($, event, next) => next(event));
  on('turn.complete', async ($, event, next) => {
    const result = await next(event);
    await refresh($.agent.list());
    return result;
  });

  on('command.run', { command: 'agent-map' }, async ($, event) => {
    const args = (event.args ?? '').trim();
    if (args.startsWith('plan ')) {
      try {
        plan = readPlan(args.slice('plan '.length));
      } catch (error) {
        return { text: 'Plan unchanged: ' + error.message };
      }
      await $.ui.invalidate('ui.render');
      return { text: plan.length ? 'Session plan registered. Open /agent-map to see it.' : 'Session plan cleared.' };
    }
    if (args && args !== 'text') return { text: 'Usage: /agent-map [text | plan <JSON array>]' };
    await refresh($.agent.list());
    if (args === 'text') return { text: asText() };
    const opened = await $.ui.open({ id: paneId, title: 'Subagent workflow', rows: 18, columns: 52, focus: true });
    if (!opened.isPlaced) return { text: asText() };
    await $.ui.invalidate('ui.render');
    timer?.cancel();
    timer = $.clock.every(1000, async () => {
      await refresh($.agent.list());
      await $.ui.invalidate('ui.render');
    });
    return {};
  });

  on('ui.render', { component: 'Pane', requestId: paneId }, ($, event) => {
    const { Box, Text } = $.ui.resolve(event);
    const rows = graphRows(agents);
    const nodes = rows.map(row => Box({
      flexDirection: 'row', children: [
        Text({ dimColor: true, children: row.prefix }),
        Box({
          flexDirection: 'column',
          borderStyle: 'round',
          paddingX: 1,
          children: [
            Text({ bold: true, children: row.name }),
            Text({ color: colors[row.status], children: row.statusLabel }),
            ...(row.parentKnown ? [] : [Text({ dimColor: true, children: 'Parent not observed' })]),
          ],
        }),
      ],
    }));
    return Box({
      flexDirection: 'column',
      children: [
        Text({ bold: true, children: unavailable ? 'Agent data unavailable' : summarize(agents) }),
        Text({ dimColor: true, children: 'Main Claude' }),
        ...nodes,
        ...(plan.length ? [
          Text({ bold: true, children: 'Registered plan' }),
          ...plan.map(item => Box({
            borderStyle: 'single', flexDirection: 'column', paddingX: 1,
            children: [
              Text({ children: item.title + ' [' + item.id + ']' }),
              Text({ dimColor: true, children: planStatus(item, rows) }),
              ...(item.dependsOn.length ? [Text({ dimColor: true, children: 'After ' + item.dependsOn.join(', ') })] : []),
            ],
          })),
        ] : []),
      ],
    });
  });

  on('ui.close', async ($, event, next) => {
    if (event.id === paneId) {
      timer?.cancel();
      timer = undefined;
    }
    return next(event);
  }).catch(($, event, next) => next(event));
  on('session.end', async ($, event, next) => {
    timer?.cancel();
    timer = undefined;
    generation++;
    agents = [];
    plan = [];
    unavailable = false;
    return next(event);
  });
}
