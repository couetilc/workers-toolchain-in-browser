import { createServer } from 'node:http';

// Only external inference is substituted. Pi, proxy, tools, SQLite and Vite remain real.
createServer(async (req, res) => {
  if (req.url === '/health') { res.end('ready'); return; }
  let body = ''; for await (const chunk of req) body += chunk;
  const request = JSON.parse(body);
  const messages = request.messages;
  const userIndex = messages.findLastIndex(message => message.role === 'user');
  const prompt = JSON.stringify(messages[userIndex].content).toLowerCase();
  const results = messages.slice(userIndex).filter(message => message.role === 'tool');
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const chunk = (delta, finish_reason = null) => res.write('data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'fixture', choices: [{ index: 0, delta, finish_reason }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }) + '\n\n');
  chunk({ role: 'assistant' });
  if (prompt.includes('slow') || prompt.includes('stream error')) {
    chunk({ content: 'Waiting for fixture provider…' });
    if (prompt.includes('stream error')) { setTimeout(() => res.destroy(), 100); return; }
    const timer = setTimeout(() => { chunk({ content: 'Finished waiting.' }, 'stop'); res.end('data: [DONE]\n\n'); }, 30_000);
    res.on('close', () => clearTimeout(timer)); return;
  }
  if (prompt.includes('tool error')) {
    if (!results.length) chunk({ tool_calls: [{ index: 0, id: 'missing', type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: 'missing.ts' }) } }] }, 'tool_calls');
    else chunk({ content: 'Tool error received; no file was changed.' }, 'stop');
    res.end('data: [DONE]\n\n'); return;
  }
  const read = results[1] ? JSON.parse(results[1].content) : { revision: 0 };
  const steps = [
    ['list_files', {}], ['read_file', { path: 'src/App.tsx' }],
    ['edit_file', { path: 'src/App.tsx', search: 'Browser-built React', replacement: 'Changed by Pi', expectedRevision: read.revision }],
    ['diagnostics', { path: 'src/App.tsx' }], ['build', {}],
  ];
  if (prompt.includes('conflict') && results.length === 2) await new Promise(resolve => setTimeout(resolve, 1500));
  if (results.length < steps.length) {
    const [name, args] = steps[results.length];
    chunk({ tool_calls: [{ index: 0, id: 'call-' + results.length, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }, 'tool_calls');
  } else chunk({ content: 'Fixture run finished. Inspect tool results for the outcome.' }, 'stop');
  res.end('data: [DONE]\n\n');
}).listen(4172, '127.0.0.1', () => console.log('Deterministic model fixture on 4172'));
