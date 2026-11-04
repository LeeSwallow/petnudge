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
    aiText, clearAllLabel, errorLine, personaPlaceholder, profileChoices, profileIdFor, providerHint, providerLabel, providerStatus, testResult, toggleTool, toolGroups
  } from './logic';
  import { t, type MessageKey } from '../../i18n';
  import { localizedText } from '../../../i18n';

  // Settings › AI 대화 설정: its own page inside the settings tab, since there
  // is a lot to set — the provider and keys, which tools she may use, each
  // character's chat profile and the base prompt.

  let { open, onBack }: { open: boolean; onBack: () => void } = $props();

  const SPEECH: [string, MessageKey][] = [['', 'ai.speech.asCharacter'], ['banmal', 'ai.speech.banmal'], ['jondaet', 'ai.speech.jondaet']];
  const LENGTH: [ChatProfile['length'], MessageKey][] = [['short', 'ai.length.short'], ['normal', 'ai.length.normal'], ['long', 'ai.length.long']];

  let chatRev = $state(0);
  let characters = $state<CharacterChoice[]>([]);
  let profileId = $state('');
  let confirmClear = $state(false);
  let testing = $state(false);
  // null: the hint about keys, in the current language
  let status = $state<string | null>(null);
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
    const packPersona = id === pack.id ? localizedText(pack.persona, pack.lang) : choices.find((c) => c.id === id)?.persona;
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
      modelPlaceholder: profile.provider ? modelFor(config, profile.provider) || t('ai.defaultModel') : '',
      personaPlaceholder: personaPlaceholder(packPersona),
      callPlaceholder: data.settings.nickname || t('ai.callPlaceholder'),
      preview: buildSystemPrompt(config, {
        characterId: id, character: name, packPersona,
        nickname: data.settings.nickname || undefined, status: t('ai.previewStatus')
      }),
      sessions: chatState.sessions.length
    };
  });

  const saveProfile = (patch: Partial<ChatProfile>) => {
    saveChatConfig({ profiles: { ...chatState.config.profiles, [view.id]: { ...view.profile, ...patch } } });
  };

  const refresh = async () => {
    status = aiText('searching');
    await refreshChatProviders(true);
    status = aiText('searched');
  };

  const test = async () => {
    testing = true;
    status = t('ai.asking', { provider: providerLabel(chatState.config.provider) });
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
      status = aiText('pasteKey');
      return;
    }
    try {
      await api.setChatKey(id, input.value);
      input.value = '';
      await refreshChatProviders(false);
      status = aiText('keySaved');
    } catch (error) {
      logError('settings:ai-key', error);
      status = errorLine(error);
    }
  };

  const removeKey = async (id: ChatProvider) => {
    await api.setChatKey(id, '');
    await refreshChatProviders(false);
    status = aiText('keyRemoved');
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

<div class="row chat-top"><button type="button" class="icon-button" data-action="ai-back" aria-label={t('ai.back')} onclick={onBack}>‹</button><b class="grow">{t('ai.title')}</b></div>

<div class="section-title">{t('ai.section.connection')} <small>{t('ai.section.connectionSub')}</small></div>
<div class="frame well setting-group">
  <ul class="ai-providers" id="ai-providers">
    {#each view.providers as { id, info, state, selected, status: line } (id)}
      <li class="ai-provider" class:selected>
        <label class="ai-provider-head">
          <input type="radio" name="ai-provider" value={id} checked={selected} onchange={() => saveChatConfig({ provider: id })} />
          <b>{providerLabel(id)}</b><small class:ok={state?.available}>{line}</small>
        </label>
        {#if selected}
          <div class="hint">{providerHint(id)}</div>
          <div class="row"><span class="ai-label">{t('ai.model')}</span><input type="text" data-model={id} class="grow" value={view.config.models[id] ?? ''} placeholder={info.model || t('ai.defaultModel')}
            onchange={(e) => saveChatConfig({ models: { ...chatState.config.models, [id]: e.currentTarget.value.trim() } })} /></div>
          {#if id === 'custom'}
            <div class="row"><span class="ai-label">{t('ai.address')}</span><input type="text" id="ai-base-url" class="grow" value={view.config.baseUrl}
              onchange={(e) => saveChatConfig({ baseUrl: e.currentTarget.value.trim() })} /></div>
          {/if}
          {#if info.kind === 'api'}
            <div class="row"><span class="ai-label">{t('ai.apiKey')}</span><input type="password" data-key={id} class="grow" bind:this={keyInput}
              placeholder={state?.hasKey ? t('ai.keyPlaceholderSaved') : t('ai.keyPlaceholder')} autocomplete="off" /><button type="button" data-action="save-key" data-id={id} onclick={() => saveKey(id)}>{t('common.save')}</button>{#if state?.hasKey}<button type="button" class="ghost" data-action="remove-key" data-id={id} onclick={() => removeKey(id)}>{t('common.delete')}</button>{/if}</div>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
  <div class="row">
    <button type="button" data-action="ai-refresh" class="grow" onclick={refresh}>{t('ai.refresh')}</button>
    <button type="button" data-action="ai-test" class="grow" disabled={testing} onclick={test}>{t('ai.test')}</button>
  </div>
  <div class="hint" id="ai-status" role="status" aria-live="polite">{status ?? aiText('keysHint')}</div>
</div>

<div class="section-title">{t('ai.section.tools')} <small>{t('ai.section.toolsSub')}</small></div>
<div class="frame well setting-group">
  <label class="toggle">{t('ai.toolsOn')}<input type="checkbox" id="ai-tools-on" checked={view.config.tools.enabled} onchange={(e) => tools({ enabled: e.currentTarget.checked })} /></label>
  <label class="toggle">{t('ai.toolsWrite')}<input type="checkbox" id="ai-tools-write" checked={view.config.tools.allowWrite} onchange={(e) => tools({ allowWrite: e.currentTarget.checked })} /></label>
  <div id="ai-tool-list" class="ai-tool-list">
    {#each view.groups as group (group.group)}
      <div class="ai-tool-group"><div class="ai-tool-title">{group.title}</div>
        {#each group.tools as tool (tool.name)}
          <label class="ai-tool" class:off={tool.off} data-tip={tool.description}>
            <input type="checkbox" data-tool={tool.name} checked={tool.checked} disabled={!view.config.tools.enabled}
              onchange={(e) => tools({ disabled: toggleTool(chatState.config.tools.disabled, tool.name, e.currentTarget.checked) })} />
            {tool.label}{#if tool.write}&nbsp;<small>{t('ai.toolWrites')}</small>{/if}</label>
        {/each}
      </div>
    {/each}
  </div>
  <div class="hint">{t('ai.toolsHint')}</div>
</div>

<div class="section-title">{t('ai.section.profile')} <small>{t('ai.section.profileSub')}</small></div>
<div class="frame well setting-group">
  <div class="row"><span class="ai-label">{t('settings.character.label')}</span><select id="ai-profile-character" class="grow" onchange={(e) => (profileId = e.currentTarget.value)}>
    {#each view.choices as c (c.id)}<option value={c.id} selected={c.id === view.id}>{c.name}</option>{/each}
  </select></div>
  <div class="row"><span class="ai-label">{t('ai.profileProvider')}</span><select id="ai-profile-provider" class="grow"
    onchange={(e) => saveProfile({ provider: (e.currentTarget.value || undefined) as ChatProvider | undefined, model: undefined })}>
    <option value="" selected={!view.profile.provider}>{t('ai.profileProviderDefault', { provider: providerLabel(view.config.provider) })}</option>
    {#each CHAT_PROVIDERS as id (id)}<option value={id} selected={view.profile.provider === id}>{providerLabel(id)}</option>{/each}
  </select></div>
  <div class="row" id="ai-profile-model-row" hidden={!view.profile.provider}><span class="ai-label">{t('ai.model')}</span><input type="text" id="ai-profile-model" class="grow" maxlength="120"
    value={view.profile.model ?? ''} placeholder={view.modelPlaceholder} onchange={(e) => saveProfile({ model: e.currentTarget.value.trim() || undefined })} /></div>
  <div class="hint">{t('ai.profileHint')}</div>
  <label class="ai-field">{t('ai.persona')}<textarea id="ai-persona" rows="3" maxlength="800" value={view.profile.persona ?? ''} placeholder={view.personaPlaceholder}
    onchange={(e) => saveProfile({ persona: e.currentTarget.value.trim() || undefined })}></textarea></label>
  <div class="row"><span class="ai-label">{t('ai.speech')}</span>
    <div class="segmented grow">{#each SPEECH as [speech, label] (speech)}<button type="button" data-action="speech" data-speech={speech} aria-pressed={speech === (view.profile.speech ?? '')}
      onclick={() => saveProfile({ speech: (speech || undefined) as ChatProfile['speech'] })}>{t(label)}</button>{/each}</div></div>
  <div class="row"><span class="ai-label">{t('ai.length')}</span>
    <div class="segmented grow">{#each LENGTH as [length, label] (length)}<button type="button" data-action="length" data-length={length} aria-pressed={length === view.profile.length}
      onclick={() => saveProfile({ length })}>{t(label)}</button>{/each}</div></div>
  <div class="row"><span class="ai-label">{t('ai.callUser')}</span><input type="text" id="ai-call" class="grow" maxlength="40" value={view.profile.callUser ?? ''} placeholder={view.callPlaceholder}
    onchange={(e) => saveProfile({ callUser: e.currentTarget.value.trim() || undefined })} /></div>
  <label class="toggle">{t('ai.emoji')}<input type="checkbox" id="ai-emoji" checked={view.profile.emoji} onchange={(e) => saveProfile({ emoji: e.currentTarget.checked })} /></label>
  <label class="ai-field">{t('ai.extra')}<textarea id="ai-extra" rows="2" maxlength="2000" placeholder={t('ai.extraPlaceholder')} value={view.profile.extra ?? ''}
    onchange={(e) => saveProfile({ extra: e.currentTarget.value.trim() || undefined })}></textarea></label>
  <div class="row"><button type="button" class="ghost grow" data-action="profile-reset" onclick={resetProfile}>{t('ai.profileReset')}</button></div>
  <details class="ai-preview-box"><summary>{t('ai.preview')}</summary><pre id="ai-preview">{view.preview}</pre></details>
</div>

<div class="section-title">{t('ai.section.base')} <small>{t('ai.section.baseSub')}</small></div>
<div class="frame well setting-group">
  <textarea id="ai-base" rows="6" maxlength="4000" aria-label={t('ai.section.base')} value={view.config.basePrompt} onchange={(e) => saveChatConfig({ basePrompt: e.currentTarget.value })}></textarea>
  <div class="row"><button type="button" class="ghost grow" data-action="base-reset" onclick={() => saveChatConfig({ basePrompt: DEFAULT_BASE_PROMPT })}>{t('ai.baseReset')}</button></div>
</div>

<div class="section-title">{t('ai.section.chat')}</div>
<div class="frame well setting-group">
  <label class="toggle">{t('ai.chatButton')}<input type="checkbox" id="ai-button" checked={view.config.button} onchange={(e) => saveChatConfig({ button: e.currentTarget.checked })} /></label>
  <div class="row"><span class="hint grow" id="ai-sessions">{t('ai.savedChats', { count: view.sessions })}</span><button type="button" class="ghost" id="ai-clear" data-action="clear-all" onclick={clearAll}>{clearAllLabel(confirmClear)}</button></div>
</div>
