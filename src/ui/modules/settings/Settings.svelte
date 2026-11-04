<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api } from '../../../renderer/api';
  import { pack, setCharacter } from '../../../renderer/character';
  import { chatState, onChat } from '../../../renderer/chat';
  import { data, updateSettings } from '../../../renderer/data';
  import { pixelIcon } from '../../../renderer/icons';
  import { modStatus, onModStatus } from '../../../renderer/pet/mods';
  import type { CharacterChoice } from '../../../shared/characterImport';
  import { avatarFor, type AppSettings } from '../../../shared/settings';
  import { revision } from '../../state/revision.svelte';
  import AiSettings from './AiSettings.svelte';
  import Backup from './Backup.svelte';
  import { aiSummary, stepperText, type BoolKey, type NumberKey } from './logic';

  const STEPPERS: [NumberKey, string, number][] = [
    ['focusMinutes', '집중 시간', 5],
    ['breakMinutes', '짧은 휴식', 1],
    ['longBreakMinutes', '긴 휴식', 5],
    ['longBreakEvery', '긴 휴식 주기', 1],
    ['dailyGoalSessions', '하루 목표', 1]
  ];
  const PET_TOGGLES: [BoolKey, string][] = [
    ['alwaysOnTop', '항상 다른 창 위에 표시'],
    ['eyesFollowCursor', '눈으로 마우스 커서 따라보기'],
    ['walkAround', '가끔 화면 위를 걸어다니기 (집중 중에는 쉬어요)'],
    ['reduceMotion', '움직임 줄이기 (전환 효과 끄기)']
  ];

  let root: HTMLElement;
  let aiOpen = $state(false);
  let characters = $state<CharacterChoice[]>([]);
  let characterBusy = $state(false);
  let characterStatus = $state('');
  let cloneName = $state('');
  let nickname = $state(data.settings.nickname);
  let nicknameFocused = false;
  let modsRev = $state(0);
  let chatRev = $state(0);
  let mcp = $state<{ url: string; token: string } | null | undefined>(undefined);
  let copied = $state('');

  const settings = $derived((void revision.settings, data.settings));
  const mainId = $derived((void revision.settings, void characterBusy, pack.id));

  const loadCharacters = async () => {
    try {
      characters = await api.listCharacters();
    } catch (error) {
      characterStatus = error instanceof Error ? error.message : '캐릭터 목록을 읽지 못했어요';
    }
  };

  $effect(() => {
    void revision.settings;
    void loadCharacters();
    if (!nicknameFocused) nickname = data.settings.nickname;
  });

  onMount(() => {
    // Listeners live as long as the panel; they return nothing (see Friends.svelte).
    onModStatus(() => {
      modsRev += 1;
    });
    onChat(() => {
      chatRev += 1;
    });
    api.onCharacterError((id, message) => {
      if (id === pack.id) characterStatus = `✗ 다시 반영하지 못했어요: ${message}`;
    });
    void api.getMcpInfo().then((info) => {
      mcp = info;
    });
  });

  const characterTask = async (task: () => Promise<void>) => {
    if (characterBusy) return;
    characterBusy = true;
    characterStatus = '불러오는 중…';
    try {
      await task();
      characterStatus = '적용했어요';
    } catch (error) {
      characterStatus = error instanceof Error ? error.message : '캐릭터를 적용하지 못했어요';
    } finally {
      characterBusy = false;
      await loadCharacters();
    }
  };

  const useCharacter = (id: string) =>
    characterTask(async () => {
      await setCharacter(await api.getCharacter(id));
      await updateSettings({ characterId: id });
    });

  const editable = $derived(characters.find((c) => c.id === mainId)?.editable ?? false);

  const dressUp = $derived.by(() => {
    void revision.settings, characterBusy;
    return Object.entries(pack.slots).map(([slot, def]) => {
      const chosen = avatarFor(pack, data.settings)[slot] ?? Object.keys(def.variants)[0];
      return {
        slot,
        label: def.label,
        // every outfit can be chosen from the start (unlocks were removed, #38)
        variants: Object.entries(def.variants).map(([id, variant]) => ({
          id,
          label: variant.label,
          selected: id === chosen,
          swatch: def.swatch ? variant.recolor?.map[def.swatch] ?? def.swatch : null
        }))
      };
    });
  });

  const chooseAvatar = (slot: string, id: string) => {
    if (!pack.slots[slot]?.variants[id]) return;
    void updateSettings({ characterAvatars: { ...data.settings.characterAvatars, [pack.id]: { ...avatarFor(pack, data.settings), [slot]: id } } });
  };

  const mods = $derived((void modsRev, modStatus()));

  // The AI chat settings are a page of their own over the settings list.
  const showAiPage = async (show: boolean) => {
    aiOpen = show;
    await tick();
    root.closest('.tab-body')?.scrollTo({ top: 0 });
  };

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
    copied = value;
    setTimeout(() => {
      if (copied === value) copied = '';
    }, 1500);
  };

  let diagnosticsCopied = $state(false);
  const copyDiagnostics = async () => {
    await navigator.clipboard.writeText(await api.diagnostics());
    diagnosticsCopied = true;
    setTimeout(() => (diagnosticsCopied = false), 1500);
  };

  const step = (key: NumberKey, by: number) => void updateSettings({ [key]: data.settings[key] + by } as Partial<AppSettings>);
  const toggle = (key: BoolKey, on: boolean) => void updateSettings({ [key]: on } as Partial<AppSettings>);
</script>

{#snippet stepper(key: NumberKey, label: string, by: number)}
  <div class="stepper"><span class="grow">{label}</span>
    <button type="button" onclick={() => step(key, -by)}>-</button>
    <output id="out-{key}">{#if key === 'dailyGoalSessions'}{@html pixelIcon('tomato')}&nbsp;{/if}{stepperText(key, settings[key])}</output>
    <button type="button" onclick={() => step(key, by)}>+</button></div>
{/snippet}

{#snippet toggleRow(key: BoolKey, label: string)}
  <label class="toggle">{label}<input type="checkbox" data-bool={key} checked={settings[key]} onchange={(e) => toggle(key, e.currentTarget.checked)} /></label>
{/snippet}

{#snippet copyRow(label: string, value: string)}
  <div class="copy-row"><div class="hint">{label}</div><div class="row"><code class="grow">{value}</code><button type="button" onclick={() => copy(value)}>{copied === value ? '복사됨!' : '복사'}</button></div></div>
{/snippet}

<div class="settings-root" class:ai-open={aiOpen} bind:this={root}>
  <div class="section-title">뽀모도로</div>
  <div class="frame well setting-group">
    {#each STEPPERS as [key, label, by] (key)}{@render stepper(key, label, by)}{/each}
    {@render toggleRow('autoStartFocus', '휴식이 끝나면 바로 다음 집중 시작')}
  </div>
  <div class="section-title">캐릭터 꾸미기 <small>{(void mainId, pack.name)}</small></div>
  <div class="frame well setting-group">
    <label class="row">캐릭터 <select class="grow" id="character-select" aria-label="캐릭터 선택" disabled={characterBusy} onchange={(e) => useCharacter(e.currentTarget.value)}>
      {#each characters as c (c.id)}<option value={c.id} selected={c.id === mainId}>{c.name}{c.builtin ? ' (기본)' : ''}</option>{/each}
    </select></label>
    <div class="row">
      <button type="button" id="character-import" disabled={characterBusy} onclick={() => characterTask(async () => {
        const id = await api.importCharacter();
        if (!id) return;
        await setCharacter(await api.getCharacter(id));
        await updateSettings({ characterId: id });
      })}>팩 가져오기</button>
      <button type="button" id="character-edit" disabled={characterBusy || !editable} onclick={() => characterTask(async () => { await api.editCharacter(pack.id); })}>원본 편집</button>
    </div>
    <button type="button" id="character-reload" disabled={characterBusy || !editable} onclick={() => characterTask(async () => {
      await setCharacter(await api.rebuildCharacter(pack.id));
      await updateSettings({ characterId: pack.id });
    })}>저장한 원본 다시 적용</button>
    <div class="row"><input type="text" id="clone-name" class="grow" maxlength="40" placeholder="새 캐릭터 이름" aria-label="새 캐릭터 이름" bind:value={cloneName} />
      <button type="button" id="character-clone" disabled={characterBusy} onclick={() => characterTask(async () => {
        const id = await api.cloneCharacter(pack.id, cloneName.trim() || `${pack.name} 2`);
        cloneName = '';
        await setCharacter(await api.getCharacter(id));
        await updateSettings({ characterId: id });
        await api.editCharacter(id);
      })}>이 캐릭터로 새로 만들기</button></div>
    <div class="hint">원본 편집을 누르면 저장할 때마다 자동으로 반영돼요. 새로 만들면 지금 캐릭터의 그림·표정·동작이 복사돼요.</div>
    <div class="hint" id="character-status" role="status" aria-live="polite">{characterStatus}</div>
  </div>
  <div class="frame well setting-group" id="dressup">
    {#each dressUp as row (row.slot)}
      <div class="slot-row"><span class="slot-label">{row.label}</span><div class="swatches">
        {#each row.variants as v (v.id)}
          <button type="button" class="swatch" class:selected={v.selected} data-tip={v.label} onclick={() => chooseAvatar(row.slot, v.id)}>{#if v.swatch}<i style:background={v.swatch}></i>{/if}{v.label}</button>
        {/each}
      </div></div>
    {/each}
  </div>
  <div class="section-title">펫</div>
  <div class="frame well setting-group">
    <div class="stepper"><span class="grow">크기</span>
      <button type="button" onclick={() => step('petScale', -1)}>-</button>
      <output id="out-petScale">{stepperText('petScale', settings.petScale)}</output>
      <button type="button" onclick={() => step('petScale', 1)}>+</button></div>
    {#each PET_TOGGLES as [key, label] (key)}{@render toggleRow(key, label)}{/each}
  </div>
  <div class="section-title">모드 <small>행동 스크립트</small></div>
  <div class="frame well setting-group">
    <div id="mod-list">
      {#each mods.mods as { mod, builtin, enabled, path } (mod.id)}
        <div class="row mod-row">
          <label class="toggle grow" data-tip={mod.description ?? ''}>{mod.name} <small>{builtin ? '기본' : '내 모드'} · 행동 {mod.behaviors.length}개</small>
            <input type="checkbox" data-mod={mod.id} checked={enabled} onchange={(e) => void api.setModEnabled(mod.id, e.currentTarget.checked)} /></label>
          <button type="button" class="ghost" onclick={() => void api.openMod(path)}>열기</button>
        </div>
      {:else}
        <div class="hint">모드가 없어요.</div>
      {/each}
    </div>
    <div class="row"><button type="button" class="grow" onclick={() => void api.createMod()}>새 모드 만들기</button></div>
    <div class="hint">모드는 블록(JSON)으로 "언제 → 무엇을"을 적어요. 저장하면 바로 다시 불러와요.</div>
    <div class="hint" id="mod-problems" role="status" aria-live="polite">{mods.problems.map((p) => `⚠ ${p.path.split('/').slice(-2).join('/')}: ${p.error}`).join('\n')}</div>
  </div>
  <Backup />
  <div class="section-title">프로필</div>
  <div class="frame well setting-group">
    <div class="row"><span style="width:52px">닉네임</span><input type="text" id="nickname" class="grow" maxlength="16" placeholder="방·랭킹에 표시될 이름" bind:value={nickname}
      onfocus={() => (nicknameFocused = true)} onblur={() => (nicknameFocused = false)} onchange={() => void updateSettings({ nickname })} /></div>
  </div>
  <div class="section-title">AI 대화 <small>펫과 말하기</small></div>
  <div class="frame well setting-group">
    <button type="button" class="ai-open-button" id="ai-open" onclick={() => showAiPage(true)}>
      <span class="grow"><b>AI 대화 설정 열기</b><small id="ai-summary">{(void chatRev, void revision.settings, aiSummary(chatState.config, chatState.providers))}</small></span><span aria-hidden="true">›</span>
    </button>
    <div class="hint">연결할 AI(Claude Code·Codex·Anthropic·OpenAI·OpenRouter·로컬), 도구 권한, 캐릭터별 말투와 프롬프트를 정해요.</div>
  </div>
  <div class="section-title">AI 연결 (MCP)</div>
  <div class="frame well setting-group" id="mcp-box">
    {#if mcp === undefined}
      <div class="hint">불러오는 중…</div>
    {:else if mcp === null}
      <div class="hint">MCP 서버를 시작하지 못했어요.</div>
    {:else}
      <div class="hint">Claude·Cursor 같은 AI가 할 일·메모·통계를 읽고, 타이머를 켤 수 있어요. 앱이 켜져 있을 때만 동작해요.</div>
      {@render copyRow('Claude Code (터미널에 붙여넣기)', `claude mcp add --transport http petnudge ${mcp.url} --header "Authorization: Bearer ${mcp.token}" --scope user`)}
      {@render copyRow('Cursor (~/.cursor/mcp.json)', JSON.stringify({ mcpServers: { petnudge: { url: mcp.url, headers: { Authorization: `Bearer ${mcp.token}` } } } }))}
      <div class="hint">토큰은 이 컴퓨터에만 저장돼요. 다른 사람에게 공유하지 마세요.</div>
    {/if}
  </div>
  <div class="section-title">문제 해결</div>
  <div class="frame well setting-group" id="troubleshoot">
    <div class="row">
      <button type="button" class="grow" id="open-logs" onclick={() => void api.openLogs()}>로그 폴더 열기</button>
      <button type="button" class="grow" id="copy-diagnostics" onclick={copyDiagnostics}>{diagnosticsCopied ? '복사됨!' : '진단 정보 복사'}</button>
    </div>
    <div class="hint">문제가 생기면 진단 정보를 복사해 버그 신고에 붙여 주세요. 버전과 최근 오류만 담기고, 대화·메모·키는 담기지 않아요.</div>
  </div>
  <div class="row">
    <button type="button" class="grow" id="reset-position" onclick={() => api.resetPosition()}>{@html pixelIcon('home')} 펫 위치 초기화</button>
    <button class="ghost" type="button" onclick={() => api.quit()}>펫 종료</button>
  </div>
  <div class="hint">펫을 잃어버렸다면 ⌘/Ctrl + Alt + P 로 오른쪽 아래로 불러올 수 있어요.</div>
  <div id="ai-page" hidden={!aiOpen}><AiSettings open={aiOpen} onBack={() => showAiPage(false)} /></div>
</div>

<style>
  .settings-root { display: contents; }
</style>
