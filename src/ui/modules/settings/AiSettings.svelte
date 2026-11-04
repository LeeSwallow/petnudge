<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../../renderer/api';
  import { pack } from '../../../renderer/character';
  import { chatState, clearAllSessions, onChat, refreshChatProviders, saveChatConfig, testChat } from '../../../renderer/chat';
  import { data } from '../../../renderer/data';
  import {
    CHAT_PROVIDERS, DEFAULT_BASE_PROMPT, PROVIDER_INFO, buildSystemPrompt, modelFor, profileSchema,
    type ChatProfile, type ChatProvider
  } from '../../../shared/chat';
  import type { CharacterChoice } from '../../../shared/characterImport';
  import { logError } from '../../log';
  import { revision } from '../../state/revision.svelte';
  import {
    AI_TEXT, clearAllLabel, errorLine, personaPlaceholder, profileChoices, profileIdFor, providerStatus, testResult, toggleTool, toolGroups
  } from './logic';

  // Settings › AI 대화 설정: its own page inside the settings tab, since there
  // is a lot to set — the provider and keys, which tools she may use, each
  // character's chat profile and the base prompt.

  let { open, onBack }: { open: boolean; onBack: () => void } = $props();

  const SPEECH: [string, string][] = [['', '캐릭터대로'], ['banmal', '반말'], ['jondaet', '존댓말']];
  const LENGTH: [ChatProfile['length'], string][] = [['short', '짧게'], ['normal', '보통'], ['long', '자세히']];

  let chatRev = $state(0);
  let characters = $state<CharacterChoice[]>([]);
  let profileId = $state('');
  let confirmClear = $state(false);
  let testing = $state(false);
  let status = $state<string>(AI_TEXT.keysHint);
  let keyInput = $state<HTMLInputElement>();

  onMount(() => {
    onChat(() => {
      chatRev += 1;
    });
  });

  // Each time the page opens: the character list again, and her own profile first.
  $effect(() => {
    if (!open) return;
    profileId = pack.id;
    void api.listCharacters().catch(() => [] as CharacterChoice[]).then((list) => {
      characters = list;
    });
  });

  const view = $derived.by(() => {
    void chatRev, revision.settings;
    const { config, providers } = chatState;
    const choices = profileChoices(characters, pack);
    const id = profileIdFor(profileId, choices, pack.id);
    const profile = profileSchema.parse(config.profiles[id] ?? {});
    const name = choices.find((c) => c.id === id)?.name ?? id;
    const packPersona = id === pack.id ? pack.persona : choices.find((c) => c.id === id)?.persona;
    return {
      config,
      providers: CHAT_PROVIDERS.map((provider) => {
        const info = PROVIDER_INFO[provider];
        const state = providers.find((p) => p.id === provider);
        return { id: provider, info, state, selected: config.provider === provider, status: providerStatus(info, state) };
      }),
      groups: toolGroups(chatState.tools, config.tools),
      choices,
      id,
      profile,
      modelPlaceholder: profile.provider ? modelFor(config, profile.provider) || '기본 모델' : '',
      personaPlaceholder: personaPlaceholder(packPersona),
      callPlaceholder: data.settings.nickname || '닉네임 (프로필 설정)',
      preview: buildSystemPrompt(config, {
        characterId: id, character: name, packPersona,
        nickname: data.settings.nickname || undefined, status: '(보낼 때의 시간·타이머·할 일·음악)'
      }),
      sessions: chatState.sessions.length
    };
  });

  const saveProfile = (patch: Partial<ChatProfile>) => {
    saveChatConfig({ profiles: { ...chatState.config.profiles, [view.id]: { ...view.profile, ...patch } } });
  };

  const refresh = async () => {
    status = AI_TEXT.searching;
    await refreshChatProviders(true);
    status = AI_TEXT.searched;
  };

  const test = async () => {
    testing = true;
    status = `${PROVIDER_INFO[chatState.config.provider].label}에 물어보는 중…`;
    try {
      const { reply, ms } = await testChat();
      status = testResult(reply, ms, modelFor(chatState.config));
    } catch (error) {
      logError('settings:ai-test', error, 'warn');
      status = errorLine(error);
    } finally {
      testing = false;
    }
  };

  const saveKey = async (id: ChatProvider) => {
    const input = keyInput;
    if (!input?.value.trim()) {
      status = AI_TEXT.pasteKey;
      return;
    }
    try {
      await api.setChatKey(id, input.value);
      input.value = '';
      await refreshChatProviders(false);
      status = AI_TEXT.keySaved;
    } catch (error) {
      logError('settings:ai-key', error);
      status = errorLine(error);
    }
  };

  const removeKey = async (id: ChatProvider) => {
    await api.setChatKey(id, '');
    await refreshChatProviders(false);
    status = AI_TEXT.keyRemoved;
  };

  const resetProfile = () => {
    const profiles = { ...chatState.config.profiles };
    delete profiles[view.id];
    saveChatConfig({ profiles });
  };

  const clearAll = () => {
    if (!confirmClear) {
      confirmClear = true;
      setTimeout(() => {
        confirmClear = false;
      }, 3000);
      return;
    }
    confirmClear = false;
    clearAllSessions();
  };

  const tools = (patch: Partial<typeof chatState.config.tools>) => saveChatConfig({ tools: { ...chatState.config.tools, ...patch } });
</script>

<div class="row chat-top"><button type="button" class="icon-button" data-action="ai-back" aria-label="설정으로" onclick={onBack}>‹</button><b class="grow">AI 대화 설정</b></div>

<div class="section-title">연결 <small>누가 대답할지</small></div>
<div class="frame well setting-group">
  <ul class="ai-providers" id="ai-providers">
    {#each view.providers as { id, info, state, selected, status: line } (id)}
      <li class="ai-provider" class:selected>
        <label class="ai-provider-head">
          <input type="radio" name="ai-provider" value={id} checked={selected} onchange={() => saveChatConfig({ provider: id })} />
          <b>{info.label}</b><small class:ok={state?.available}>{line}</small>
        </label>
        {#if selected}
          <div class="hint">{info.hint}</div>
          <div class="row"><span class="ai-label">모델</span><input type="text" data-model={id} class="grow" value={view.config.models[id] ?? ''} placeholder={info.model || '기본 모델'}
            onchange={(e) => saveChatConfig({ models: { ...chatState.config.models, [id]: e.currentTarget.value.trim() } })} /></div>
          {#if id === 'custom'}
            <div class="row"><span class="ai-label">주소</span><input type="text" id="ai-base-url" class="grow" value={view.config.baseUrl}
              onchange={(e) => saveChatConfig({ baseUrl: e.currentTarget.value.trim() })} /></div>
          {/if}
          {#if info.kind === 'api'}
            <div class="row"><span class="ai-label">API 키</span><input type="password" data-key={id} class="grow" bind:this={keyInput}
              placeholder={state?.hasKey ? '저장됨 · 바꾸려면 새로 입력' : '붙여넣기'} autocomplete="off" /><button type="button" data-action="save-key" data-id={id} onclick={() => saveKey(id)}>저장</button>{#if state?.hasKey}<button type="button" class="ghost" data-action="remove-key" data-id={id} onclick={() => removeKey(id)}>삭제</button>{/if}</div>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
  <div class="row">
    <button type="button" data-action="ai-refresh" class="grow" onclick={refresh}>다시 찾기</button>
    <button type="button" data-action="ai-test" class="grow" disabled={testing} onclick={test}>연결 테스트</button>
  </div>
  <div class="hint" id="ai-status" role="status" aria-live="polite">{status}</div>
</div>

<div class="section-title">도구 <small>대화로 앱 다루기</small></div>
<div class="frame well setting-group">
  <label class="toggle">도구 사용<input type="checkbox" id="ai-tools-on" checked={view.config.tools.enabled} onchange={(e) => tools({ enabled: e.currentTarget.checked })} /></label>
  <label class="toggle">추가·수정·삭제 허용<input type="checkbox" id="ai-tools-write" checked={view.config.tools.allowWrite} onchange={(e) => tools({ allowWrite: e.currentTarget.checked })} /></label>
  <div id="ai-tool-list" class="ai-tool-list">
    {#each view.groups as group (group.group)}
      <div class="ai-tool-group"><div class="ai-tool-title">{group.title}</div>
        {#each group.tools as t (t.name)}
          <label class="ai-tool" class:off={t.off} data-tip={t.description}>
            <input type="checkbox" data-tool={t.name} checked={t.checked} disabled={!view.config.tools.enabled}
              onchange={(e) => tools({ disabled: toggleTool(chatState.config.tools.disabled, t.name, e.currentTarget.checked) })} />
            {t.label}{#if t.write}&nbsp;<small>변경</small>{/if}</label>
        {/each}
      </div>
    {/each}
  </div>
  <div class="hint">"할 일에 미적분 추가해 줘", "오늘 메모 정리해 줘", "25분 집중 시작" 처럼 부탁하면 직접 처리해요.</div>
</div>

<div class="section-title">캐릭터 프로필 <small>말투·성격</small></div>
<div class="frame well setting-group">
  <div class="row"><span class="ai-label">캐릭터</span><select id="ai-profile-character" class="grow" onchange={(e) => (profileId = e.currentTarget.value)}>
    {#each view.choices as c (c.id)}<option value={c.id} selected={c.id === view.id}>{c.name}</option>{/each}
  </select></div>
  <div class="row"><span class="ai-label">대답할 AI</span><select id="ai-profile-provider" class="grow"
    onchange={(e) => saveProfile({ provider: (e.currentTarget.value || undefined) as ChatProvider | undefined, model: undefined })}>
    <option value="" selected={!view.profile.provider}>기본 ({PROVIDER_INFO[view.config.provider].label})</option>
    {#each CHAT_PROVIDERS as id (id)}<option value={id} selected={view.profile.provider === id}>{PROVIDER_INFO[id].label}</option>{/each}
  </select></div>
  <div class="row" id="ai-profile-model-row" hidden={!view.profile.provider}><span class="ai-label">모델</span><input type="text" id="ai-profile-model" class="grow" maxlength="120"
    value={view.profile.model ?? ''} placeholder={view.modelPlaceholder} onchange={(e) => saveProfile({ model: e.currentTarget.value.trim() || undefined })} /></div>
  <div class="hint">캐릭터마다 다른 AI를 정하면, 그룹 대화나 "서로 대화"에서 서로 다른 LLM끼리 이야기해요.</div>
  <label class="ai-field">성격·말투<textarea id="ai-persona" rows="3" maxlength="800" value={view.profile.persona ?? ''} placeholder={view.personaPlaceholder}
    onchange={(e) => saveProfile({ persona: e.currentTarget.value.trim() || undefined })}></textarea></label>
  <div class="row"><span class="ai-label">높임</span>
    <div class="segmented grow">{#each SPEECH as [speech, label] (speech)}<button type="button" data-action="speech" data-speech={speech} aria-pressed={speech === (view.profile.speech ?? '')}
      onclick={() => saveProfile({ speech: (speech || undefined) as ChatProfile['speech'] })}>{label}</button>{/each}</div></div>
  <div class="row"><span class="ai-label">길이</span>
    <div class="segmented grow">{#each LENGTH as [length, label] (length)}<button type="button" data-action="length" data-length={length} aria-pressed={length === view.profile.length}
      onclick={() => saveProfile({ length })}>{label}</button>{/each}</div></div>
  <div class="row"><span class="ai-label">부를 이름</span><input type="text" id="ai-call" class="grow" maxlength="40" value={view.profile.callUser ?? ''} placeholder={view.callPlaceholder}
    onchange={(e) => saveProfile({ callUser: e.currentTarget.value.trim() || undefined })} /></div>
  <label class="toggle">이모지 쓰기<input type="checkbox" id="ai-emoji" checked={view.profile.emoji} onchange={(e) => saveProfile({ emoji: e.currentTarget.checked })} /></label>
  <label class="ai-field">추가 지시<textarea id="ai-extra" rows="2" maxlength="2000" placeholder="예: 영어 단어는 예문과 함께 알려 줘" value={view.profile.extra ?? ''}
    onchange={(e) => saveProfile({ extra: e.currentTarget.value.trim() || undefined })}></textarea></label>
  <div class="row"><button type="button" class="ghost grow" data-action="profile-reset" onclick={resetProfile}>이 캐릭터 프로필 초기화</button></div>
  <details class="ai-preview-box"><summary>프롬프트 미리보기</summary><pre id="ai-preview">{view.preview}</pre></details>
</div>

<div class="section-title">기본 프롬프트 <small>모든 캐릭터 공통</small></div>
<div class="frame well setting-group">
  <textarea id="ai-base" rows="6" maxlength="4000" aria-label="기본 프롬프트" value={view.config.basePrompt} onchange={(e) => saveChatConfig({ basePrompt: e.currentTarget.value })}></textarea>
  <div class="row"><button type="button" class="ghost grow" data-action="base-reset" onclick={() => saveChatConfig({ basePrompt: DEFAULT_BASE_PROMPT })}>기본값으로</button></div>
</div>

<div class="section-title">대화</div>
<div class="frame well setting-group">
  <label class="toggle">펫 옆 말 걸기 버튼<input type="checkbox" id="ai-button" checked={view.config.button} onchange={(e) => saveChatConfig({ button: e.currentTarget.checked })} /></label>
  <div class="row"><span class="hint grow" id="ai-sessions">저장된 대화 {view.sessions}개</span><button type="button" class="ghost" id="ai-clear" data-action="clear-all" onclick={clearAll}>{clearAllLabel(confirmClear)}</button></div>
</div>
