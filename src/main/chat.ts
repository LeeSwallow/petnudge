import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CHAT_PROVIDERS, PROVIDER_INFO, buildSystemPrompt, routeFor,
  type ChatConfig, type ChatEvent, type ChatProvider, type ChatProviderInfo, type ChatRequest
} from '../shared/chat';
import { createModel, runAgent } from './chatAgent';
import type { PetTool } from './petTools';

// Talking to the pet. CLI providers (Claude Code, Codex) run once per reply
// with their own tools and project settings off, in an empty folder, and get
// the app tools through the local MCP server. API providers go through the
// LangChain agent (chatAgent.ts) with the same tools bound.

const TIMEOUT_MS = 180_000;

type CliProvider = 'claude' | 'codex';
const BINARIES: Record<CliProvider, string> = { claude: 'claude', codex: 'codex' };
const isCli = (provider: ChatProvider): provider is CliProvider => PROVIDER_INFO[provider].kind === 'cli';

// Apps started from Finder get a minimal PATH, so look where installers put
// these first, then ask a login shell.
const searchDirs = () => {
  const home = os.homedir();
  return [path.join(home, '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.npm-global', 'bin'), path.join(home, '.bun', 'bin'), path.join(home, '.volta', 'bin')];
};

const found = new Map<CliProvider, string | null>();
const locate = async (provider: CliProvider): Promise<string | null> => {
  if (found.has(provider)) return found.get(provider)!;
  const name = BINARIES[provider];
  let result = searchDirs().map((dir) => path.join(dir, name)).find((file) => existsSync(file)) ?? null;
  if (!result) {
    result = await new Promise<string | null>((resolve) =>
      execFile(process.env.SHELL || '/bin/zsh', ['-lc', `command -v ${name}`], { timeout: 5000 }, (error, stdout) =>
        resolve(error ? null : stdout.trim().split('\n').pop() || null)));
  }
  found.set(provider, result);
  return result;
};

// The conversation so far, as one prompt (each CLI run starts fresh).
const conversation = (request: ChatRequest) => {
  const messages = [...request.messages];
  const last = messages.pop();
  const history = messages.map((m) => `${m.role === 'user' ? '사용자' : '너'}: ${m.text}`).join('\n');
  return `${history ? `지금까지의 대화:\n${history}\n\n` : ''}사용자: ${last?.text ?? ''}`;
};

type Mcp = { url: string; token: string } | null;

const cliArgs = (provider: CliProvider, model: string, system: string, prompt: string, tools: PetTool[], mcp: Mcp) => {
  const names = mcp ? tools.map((t) => t.name) : [];
  if (provider === 'claude') {
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
      '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--no-session-persistence', '--append-system-prompt', system];
    if (names.length && mcp) {
      args.push('--mcp-config', JSON.stringify({ mcpServers: { pet: { type: 'http', url: mcp.url, headers: { Authorization: `Bearer ${mcp.token}` } } } }));
      args.push('--allowedTools', names.map((n) => `mcp__pet__${n}`).join(','));
    }
    if (model) args.push('--model', model);
    return args;
  }
  const args = ['exec', '--json', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only'];
  if (names.length && mcp) {
    args.push('-c', `mcp_servers.pet.url=${JSON.stringify(mcp.url)}`, '-c', 'mcp_servers.pet.bearer_token_env_var="PET_MCP_TOKEN"',
      '-c', 'mcp_servers.pet.default_tools_approval_mode="approve"', '-c', `mcp_servers.pet.enabled_tools=${JSON.stringify(names)}`);
  }
  if (model) args.push('-m', model);
  args.push(`${system}\n\n${prompt}`);
  return args;
};

const labelOf = (tools: PetTool[], name: string) => tools.find((t) => t.name === name)?.label ?? name;

// One JSON line of either CLI's stream → text and tool progress.
const readLine = (provider: CliProvider, line: string, tools: PetTool[]): { text?: string; newTurn?: boolean; tool?: ChatEvent; error?: string } => {
  let m: any;
  try { m = JSON.parse(line); } catch { return {}; }
  if (provider === 'claude') {
    if (m.type === 'stream_event') {
      const e = m.event;
      if (e?.type === 'message_start') return { newTurn: true };
      if (e?.delta?.type === 'text_delta') return { text: e.delta.text };
      if (e?.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
        const name = String(e.content_block.name ?? '').replace(/^mcp__pet__/, '');
        return { tool: { type: 'tool', name, label: labelOf(tools, name) } };
      }
    }
    if (m.type === 'result' && (m.is_error || m.subtype !== 'success')) return { error: String(m.result || m.subtype) };
    return {};
  }
  if (m.type === 'item.completed' && m.item?.type === 'agent_message') return { newTurn: true, text: String(m.item.text ?? '') };
  if (m.type === 'item.completed' && m.item?.type === 'mcp_tool_call') {
    const name = String(m.item.tool ?? '');
    return { tool: { type: 'tool', name, label: labelOf(tools, name), ok: !m.item.error, detail: m.item.error?.message } };
  }
  if (m.type === 'error' || m.type === 'turn.failed') return { error: String(m.message ?? m.error?.message ?? '실패했어요') };
  return {};
};

type Deps = {
  workDir: string;
  config: () => ChatConfig;
  tools: () => PetTool[];
  mcp: () => Mcp;
  apiKey: (provider: ChatProvider) => string | null;
};

// Tools this config allows (read tools always, write tools only if allowed).
export const allowedTools = (all: PetTool[], config: ChatConfig) =>
  config.tools.enabled ? all.filter((t) => !t.mcpOnly && (!t.write || config.tools.allowWrite) && !config.tools.disabled.includes(t.name)) : [];

export const createChat = ({ workDir, config, tools, mcp, apiKey }: Deps) => {
  const running = new Map<string, { kill: () => void }>();

  const providers = async (refresh = false): Promise<ChatProviderInfo[]> => {
    if (refresh) found.clear();
    return Promise.all(CHAT_PROVIDERS.map(async (id) => {
      if (isCli(id)) {
        const where = await locate(id);
        return { id, available: Boolean(where), path: where ?? undefined };
      }
      const hasKey = Boolean(apiKey(id));
      return { id, available: !PROVIDER_INFO[id].needsKey || hasKey, hasKey };
    }));
  };

  const runCli = async (id: string, provider: CliProvider, model: string, request: ChatRequest, onEvent: (event: ChatEvent) => void) => {
    const binary = await locate(provider);
    if (!binary) throw new Error(`${PROVIDER_INFO[provider].label} CLI를 찾지 못했어요. 설치하고 한 번 로그인해 주세요.`);
    const cfg = config();
    const usable = allowedTools(tools(), cfg);
    const server = mcp();
    mkdirSync(workDir, { recursive: true });
    const child: ChildProcess = spawn(binary, cliArgs(provider, model, buildSystemPrompt(cfg, request), conversation(request), usable, server), {
      cwd: workDir,
      env: { ...process.env, PET_MCP_TOKEN: server?.token ?? '', PATH: [path.dirname(binary), ...searchDirs(), process.env.PATH ?? ''].join(':') },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    running.set(id, { kill: () => child.kill() });
    return new Promise<string>((resolve, reject) => {
      let buffer = '';
      let shown = '';
      let turnHasText = false;
      let failure: string | undefined;
      let stderr = '';
      const timer = setTimeout(() => { failure = '답이 너무 오래 걸려서 멈췄어요'; child.kill(); }, TIMEOUT_MS);
      child.stdout!.setEncoding('utf8').on('data', (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        for (const line of lines) {
          const read = readLine(provider, line, usable);
          if (read.newTurn) turnHasText = false;
          if (read.text) {
            if (!turnHasText && shown) shown += '\n';
            turnHasText = true;
            shown += read.text;
            onEvent({ type: 'delta', text: shown });
          }
          if (read.tool) onEvent(read.tool);
          if (read.error) failure = read.error;
        }
      });
      child.stderr!.setEncoding('utf8').on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-2000); });
      child.on('error', (error) => { failure = error.message; });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        running.delete(id);
        const answer = shown.trim();
        if (signal && !failure) return reject(new Error('멈췄어요'));
        if (answer && !failure) return resolve(answer);
        const hint = /log ?in|auth|credential|401/i.test(stderr + (failure ?? '')) ? ' (터미널에서 한 번 로그인해 주세요)' : '';
        reject(new Error(`${failure ?? (stderr.trim().split('\n').pop() || `종료 코드 ${code}`)}${hint}`));
      });
    });
  };

  const runApi = async (id: string, provider: ChatProvider, model: string, request: ChatRequest, onEvent: (event: ChatEvent) => void) => {
    const cfg = config();
    const abort = new AbortController();
    running.set(id, { kill: () => abort.abort() });
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const answer = await runAgent({
        model: createModel(provider, cfg, apiKey(provider), model),
        system: buildSystemPrompt(cfg, request),
        messages: request.messages,
        tools: allowedTools(tools(), cfg),
        signal: abort.signal,
        onEvent
      });
      if (!answer) throw new Error('빈 대답이 왔어요');
      return answer;
    } catch (error) {
      if (abort.signal.aborted) throw new Error('멈췄어요');
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(/401|invalid.*key|authentication/i.test(message) ? `API 키를 확인해 주세요 (${message.slice(0, 120)})` : message.slice(0, 300));
    } finally {
      clearTimeout(timer);
      running.delete(id);
    }
  };

  // Without an explicit provider the character's profile decides.
  const send = (id: string, request: ChatRequest, onEvent: (event: ChatEvent) => void, override?: ChatProvider) => {
    const { provider, model } = routeFor(config(), request.characterId, override);
    return isCli(provider) ? runCli(id, provider, model, request, onEvent) : runApi(id, provider, model, request, onEvent);
  };

  const cancel = (id: string) => running.get(id)?.kill();
  const cancelAll = () => running.forEach((r) => r.kill());

  return { providers, send, cancel, cancelAll };
};
