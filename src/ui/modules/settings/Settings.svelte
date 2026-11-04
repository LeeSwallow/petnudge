<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api } from '../../../renderer/api';
  import { pack, setCharacter } from '../../../renderer/character';
  import { chatState, onChat } from '../../../renderer/chat';
  import { data, updateSettings } from '../../../renderer/data';
  import { pixelIcon } from '../../../renderer/icons';
  import { modStatus, onModStatus } from '../../../renderer/pet/mods';
  import type { CharacterChoice } from '../../../shared/characterImport';
  import { chooseOutfit, choiceAllowed } from '../../../domain/character/outfits';
  import { avatarFor, type AppSettings } from '../../../shared/settings';
  import { revision } from '../../state/revision.svelte';
  import { LOCALE_NAMES, LOCALES, type Locale } from '../../../i18n';
  import { t, type MessageKey } from '../../i18n';
  import AiSettings from './AiSettings.svelte';
  import Backup from './Backup.svelte';
  import { aiSummary, stepperText, type BoolKey, type NumberKey } from './logic';

  const STEPPERS: [NumberKey, MessageKey, number][] = [
    ['focusMinutes', 'settings.focusMinutes', 5],
    ['breakMinutes', 'settings.breakMinutes', 1],
    ['longBreakMinutes', 'settings.longBreakMinutes', 5],
    ['longBreakEvery', 'settings.longBreakEvery', 1],
    ['dailyGoalSessions', 'settings.dailyGoal', 1]
  ];
  const PET_TOGGLES: [BoolKey, MessageKey][] = [
    ['alwaysOnTop', 'settings.alwaysOnTop'],
    ['eyesFollowCursor', 'settings.eyesFollowCursor'],
    ['walkAround', 'settings.walkAround'],
    ['reduceMotion', 'settings.reduceMotion'],
    ['chatShortcut', 'settings.chatShortcut']
  ];
  const LANGUAGES = LOCALES.map((id) => ({ id, name: LOCALE_NAMES[id] }));

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
      characterStatus = error instanceof Error ? error.message : t('settings.character.listFailed');
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
      if (id === pack.id) characterStatus = t('settings.character.reloadFailed', { message });
    });
    void api.getMcpInfo().then((info) => {
      mcp = info;
    });
  });

  const characterTask = async (task: () => Promise<void>) => {
    if (characterBusy) return;
    characterBusy = true;
    characterStatus = t('settings.loading');
    try {
      await task();
      characterStatus = t('settings.character.applied');
    } catch (error) {
      characterStatus = error instanceof Error ? error.message : t('settings.character.applyFailed');
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

  // Outfit slots only (colour slots were removed, #50). A choice with no walk
  // drawing under the slots above it is disabled; choosing one moves the
  // slots below it to the closest combination that has every drawing.
  const dressUp = $derived.by(() => {
    void revision.settings, characterBusy;
    const worn = avatarFor(pack, data.settings);
    return Object.entries(pack.slots).map(([slot, def]) => ({
      slot,
      label: def.label,
      // every outfit can be chosen from the start (unlocks were removed, #38)
      variants: Object.entries(def.variants).map(([id, variant]) => ({
        id,
        label: variant.label,
        selected: id === worn[slot],
        allowed: choiceAllowed(pack, worn, slot, id)
      }))
    }));
  });

  const chooseAvatar = (slot: string, id: string) => {
    if (!pack.slots[slot]?.variants[id]) return;
    const worn = avatarFor(pack, data.settings);
    if (!choiceAllowed(pack, worn, slot, id)) return;
    void updateSettings({ characterAvatars: { ...data.settings.characterAvatars, [pack.id]: chooseOutfit(pack, worn, slot, id) } });
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
  <div class="copy-row"><div class="hint">{label}</div><div class="row"><code class="grow">{value}</code><button type="button" onclick={() => copy(value)}>{copied === value ? t('settings.copied') : t('settings.copy')}</button></div></div>
{/snippet}

<div class="settings-root" class:ai-open={aiOpen} bind:this={root}>
  <div class="section-title">{t('settings.section.pomodoro')}</div>
  <div class="frame well setting-group">
    {#each STEPPERS as [key, label, by] (key)}{@render stepper(key, t(label), by)}{/each}
    {@render toggleRow('autoStartFocus', t('settings.autoStartFocus'))}
  </div>
  <div class="section-title">{t('settings.section.character')} <small>{(void mainId, pack.name)}</small></div>
  <div class="frame well setting-group">
    <label class="row">{t('settings.character.label')} <select class="grow" id="character-select" aria-label={t('settings.character.select')} disabled={characterBusy} onchange={(e) => useCharacter(e.currentTarget.value)}>
      {#each characters as c (c.id)}<option value={c.id} selected={c.id === mainId}>{c.name}{c.builtin ? t('settings.character.builtinSuffix') : ''}</option>{/each}
    </select></label>
    <div class="row">
      <button type="button" id="character-import" disabled={characterBusy} onclick={() => characterTask(async () => {
        const id = await api.importCharacter();
        if (!id) return;
        await setCharacter(await api.getCharacter(id));
        await updateSettings({ characterId: id });
      })}>{t('settings.character.import')}</button>
      <button type="button" id="character-edit" disabled={characterBusy || !editable} onclick={() => characterTask(async () => { await api.editCharacter(pack.id); })}>{t('settings.character.edit')}</button>
    </div>
    <button type="button" id="character-reload" disabled={characterBusy || !editable} onclick={() => characterTask(async () => {
      await setCharacter(await api.rebuildCharacter(pack.id));
      await updateSettings({ characterId: pack.id });
    })}>{t('settings.character.reload')}</button>
    <div class="row"><input type="text" id="clone-name" class="grow" maxlength="40" placeholder={t('settings.character.cloneName')} aria-label={t('settings.character.cloneName')} bind:value={cloneName} />
      <button type="button" id="character-clone" disabled={characterBusy} onclick={() => characterTask(async () => {
        const id = await api.cloneCharacter(pack.id, cloneName.trim() || t('settings.character.cloneDefault', { name: pack.name }));
        cloneName = '';
        await setCharacter(await api.getCharacter(id));
        await updateSettings({ characterId: id });
        await api.editCharacter(id);
      })}>{t('settings.character.clone')}</button></div>
    <button type="button" id="open-editor" onclick={() => api.openEditor().catch((error) => { characterStatus = error instanceof Error ? error.message : t('settings.character.editorFailed'); })}>{t('settings.character.openEditor')}</button>
    <div class="hint">{t('settings.character.hint')}</div>
    <div class="hint" id="character-status" role="status" aria-live="polite">{characterStatus}</div>
  </div>
  <div class="frame well setting-group" id="dressup">
    {#each dressUp as row (row.slot)}
      <div class="slot-row" data-slot={row.slot}><span class="slot-label">{row.label}</span><div class="swatches">
        {#each row.variants as v (v.id)}
          <button type="button" class="swatch" class:selected={v.selected} disabled={!v.allowed} data-variant={v.id} title={v.allowed ? undefined : t('settings.dressUp.noWalk')} data-tip={v.label} onclick={() => chooseAvatar(row.slot, v.id)}>{v.label}</button>
        {/each}
        {#if row.variants.some((v) => !v.allowed)}<span class="slot-why">{row.variants.filter((v) => !v.allowed).map((v) => v.label).join('·')}: {t('settings.dressUp.noWalk')}</span>{/if}
      </div></div>
    {/each}
  </div>
  <div class="section-title">{t('settings.section.pet')}</div>
  <div class="frame well setting-group">
    <div class="stepper"><span class="grow">{t('settings.petScale')}</span>
      <button type="button" onclick={() => step('petScale', -1)}>-</button>
      <output id="out-petScale">{stepperText('petScale', settings.petScale)}</output>
      <button type="button" onclick={() => step('petScale', 1)}>+</button></div>
    {#each PET_TOGGLES as [key, label] (key)}{@render toggleRow(key, t(label))}{/each}
    <div class="hint">{t('settings.shortcutHint')}</div>
  </div>
  <div class="section-title">{t('settings.section.mods')} <small>{t('settings.mods.subtitle')}</small></div>
  <div class="frame well setting-group">
    <div id="mod-list">
      {#each mods.mods as { mod, builtin, enabled, path } (mod.id)}
        <div class="row mod-row">
          <label class="toggle grow" data-tip={mod.description ?? ''}>{mod.name} <small>{builtin ? t('settings.mods.builtin') : t('settings.mods.mine')} · {t('settings.mods.behaviors', { count: mod.behaviors.length })}</small>
            <input type="checkbox" data-mod={mod.id} checked={enabled} onchange={(e) => void api.setModEnabled(mod.id, e.currentTarget.checked)} /></label>
          <button type="button" class="ghost" onclick={() => void api.openMod(path)}>{t('settings.mods.open')}</button>
        </div>
      {:else}
        <div class="hint">{t('settings.mods.none')}</div>
      {/each}
    </div>
    <div class="row"><button type="button" class="grow" onclick={() => void api.createMod()}>{t('settings.mods.create')}</button></div>
    <div class="hint">{t('settings.mods.hint')}</div>
    <div class="hint" id="mod-problems" role="status" aria-live="polite">{mods.problems.map((p) => `⚠ ${p.path.split('/').slice(-2).join('/')}: ${p.error}`).join('\n')}</div>
  </div>
  <Backup />
  <div class="section-title">{t('settings.section.profile')}</div>
  <div class="frame well setting-group">
    <label class="row" id="language-row"><span class="field-label">{t('settings.language')}</span><select class="grow" id="language-select" aria-label={t('settings.language')} onchange={(e) => void updateSettings({ locale: e.currentTarget.value as Locale })}>
      {#each LANGUAGES as l (l.id)}<option value={l.id} selected={l.id === settings.locale}>{l.name}</option>{/each}
    </select></label>
    <div class="row"><span class="field-label">{t('settings.nickname')}</span><input type="text" id="nickname" class="grow" maxlength="16" placeholder={t('settings.nicknamePlaceholder')} bind:value={nickname}
      onfocus={() => (nicknameFocused = true)} onblur={() => (nicknameFocused = false)} onchange={() => void updateSettings({ nickname })} /></div>
  </div>
  <div class="section-title">{t('settings.section.ai')} <small>{t('settings.ai.subtitle')}</small></div>
  <div class="frame well setting-group">
    <button type="button" class="ai-open-button" id="ai-open" onclick={() => showAiPage(true)}>
      <span class="grow"><b>{t('settings.ai.open')}</b><small id="ai-summary">{(void chatRev, void revision.settings, aiSummary(chatState.config, chatState.providers))}</small></span><span aria-hidden="true">›</span>
    </button>
    <div class="hint">{t('settings.ai.hint')}</div>
  </div>
  <div class="section-title">{t('settings.section.mcp')}</div>
  <div class="frame well setting-group" id="mcp-box">
    {#if mcp === undefined}
      <div class="hint">{t('settings.loading')}</div>
    {:else if mcp === null}
      <div class="hint">{t('settings.mcp.failed')}</div>
    {:else}
      <div class="hint">{t('settings.mcp.hint')}</div>
      {@render copyRow(t('settings.mcp.claudeCode'), `claude mcp add --transport http petnudge ${mcp.url} --header "Authorization: Bearer ${mcp.token}" --scope user`)}
      {@render copyRow('Cursor (~/.cursor/mcp.json)', JSON.stringify({ mcpServers: { petnudge: { url: mcp.url, headers: { Authorization: `Bearer ${mcp.token}` } } } }))}
      <div class="hint">{t('settings.mcp.tokenHint')}</div>
    {/if}
  </div>
  <div class="section-title">{t('settings.section.troubleshoot')}</div>
  <div class="frame well setting-group" id="troubleshoot">
    <div class="row">
      <button type="button" class="grow" id="open-logs" onclick={() => void api.openLogs()}>{t('settings.troubleshoot.openLogs')}</button>
      <button type="button" class="grow" id="copy-diagnostics" onclick={copyDiagnostics}>{diagnosticsCopied ? t('settings.copied') : t('settings.troubleshoot.copyDiagnostics')}</button>
    </div>
    <div class="hint">{t('settings.troubleshoot.hint')}</div>
  </div>
  <div class="row">
    <button type="button" class="grow" id="reset-position" onclick={() => api.resetPosition()}>{@html pixelIcon('home')} {t('settings.resetPosition')}</button>
    <button class="ghost" type="button" onclick={() => api.quit()}>{t('settings.quitPet')}</button>
  </div>
  <div class="hint">{t('settings.lostPetHint')}</div>
  <div id="ai-page" hidden={!aiOpen}><AiSettings open={aiOpen} onBack={() => showAiPage(false)} /></div>
</div>

<style>
  .settings-root { display: contents; }
  .field-label { flex: none; min-width: 52px; }
</style>
