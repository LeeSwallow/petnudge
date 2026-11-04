<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api } from '../../../renderer/api';
  import { pack } from '../../../renderer/character';
  import {
    cancelChat, chatAvailable, chatState, deleteSession, friendsOnScreen, inviteToSession, membersOf, nameOf, newSession,
    onChat, onChatLive, openSession, providerLabel, removeFromSession, renameSession, sendChat, sessionById, sessionsFor, setMirror, talkTogether
  } from '../../../renderer/chat';
  import { routeFor, type ChatMessage } from '../../../shared/chat';
  import { t } from '../../i18n';
  import { providerLabel as providerName } from '../settings/logic';
  import type { CharacterChoice } from '../../../shared/characterImport';
  import TextInput from '../../components/TextInput.svelte';
  import { logError } from '../../log';
  import { revision } from '../../state/revision.svelte';
  import { followBottom, friendIds, isGroup, preview, when } from './logic';
  import Markdown from './Markdown.svelte';
  import { chatView } from './view.svelte';

  // The 대화 tab, like a messenger: each character is a friend you can unfold
  // to see your sessions with them; opening one shows the conversation.

  let friends = $state<CharacterChoice[]>([]);
  let unfolded = $state<string[]>([]);
  let confirmDelete = $state<string | null>(null);
  let chatRev = $state(0);
  let message = $state('');
  let turns = $state(6);
  let log = $state<HTMLElement>();
  let input = $state<HTMLElement>();
  let live = $state(''); // the reply so far, apart from the view
  let frame = 0;
  // whether new lines pull the view down (the reader is near the bottom);
  // not reactive: only the scroll handler and the jump button change it
  let following = true;
  let newBelow = $state(false);
  // a link in a reply waiting for "열기" (it never opens without asking)
  let askLink = $state<string | null>(null);

  onMount(() => {
    onChat(() => {
      chatRev += 1;
      live = chatState.live;
    });
    // a streamed delta redraws only the reply in progress, once a frame
    onChatLive(() => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        live = chatState.live;
      });
    });
    // her own conversations start unfolded
    unfolded = [pack.id];
    return () => cancelAnimationFrame(frame);
  });

  // the character list is read again when the main pet changes or the tab opens
  $effect(() => {
    void revision.settings, revision.shown;
    void api.listCharacters().then((list) => {
      friends = list;
    });
  });

  const view = $derived.by(() => {
    void chatRev, revision.settings, revision.shown, friends;
    // chat.ts changes sessions in place, so the view copies what it shows:
    // the same session object would not count as a change
    const session = chatView.open ? sessionById(chatView.open) : undefined;
    const nameFor = (id: string) => (id === pack.id ? pack.name : friends.find((f) => f.id === id)?.name ?? id);
    if (!session) {
      return {
        session: undefined,
        friends: friendIds(pack.id, friends.map((f) => f.id), chatState.sessions.map((s) => s.characterId)).map((id) => ({
          id,
          name: nameFor(id),
          sessions: sessionsFor(id).map((s) => ({ id: s.id, title: s.title, preview: preview(s), updatedAt: s.updatedAt }))
        }))
      } as const;
    }
    const members = membersOf(session);
    const pending = chatState.pending?.sessionId === session.id;
    const none = chatState.providers.length > 0 && !chatAvailable();
    return {
      session: { id: session.id, characterId: session.characterId, title: session.title, mirror: session.mirror, messages: [...session.messages] },
      name: nameFor(session.characterId),
      members,
      group: isGroup(members, session.messages),
      pending,
      pendingSpeaker: chatState.pending?.speaker,
      busy: chatState.busy === session.id,
      anyBusy: Boolean(chatState.busy),
      none,
      invitable: friends.filter((f) => !members.includes(f.id))
    } as const;
  });

  // a conversation deleted elsewhere (quick bar, MCP) closes
  $effect(() => {
    void chatRev;
    if (chatView.open && !sessionById(chatView.open)) chatView.open = null;
  });

  const toBottom = () => {
    following = true;
    newBelow = false;
    log?.scrollTo({ top: log.scrollHeight });
  };

  // an opened conversation starts at its newest line
  const openId = $derived(view.session?.id);
  $effect(() => {
    void openId;
    following = true;
    newBelow = false;
    askLink = null;
  });

  const openLink = async () => {
    const href = askLink;
    askLink = null;
    if (!href) return;
    const opened = await api.openLink(href).catch((error) => logError('chat:link', error, 'warn'));
    if (opened === false) logError('chat:link', new Error(`refused to open ${href.slice(0, 80)}`), 'warn');
  };

  // what moves the bottom: a new line, an edited last line, the reply so far
  const content = $derived.by(() => {
    const s = view.session;
    return s ? [s.id, s.messages.length, s.messages.at(-1)?.text, view.pending, live].join('\u0000') : '';
  });

  // new lines are followed only from near the bottom; otherwise the reader
  // keeps their place and gets a "새 메시지 ↓" button
  $effect(() => {
    if (!content) return;
    void tick().then(() => {
      if (!log) return;
      if (following) log.scrollTo({ top: log.scrollHeight });
      else newBelow = true;
    });
  });

  const scrolled = () => {
    if (!log) return;
    following = followBottom(log.scrollTop, log.scrollHeight, log.clientHeight);
    if (following) newBelow = false;
  };

  const focusInput = async () => {
    await tick();
    input?.querySelector('input')?.focus();
  };

  const fold = (id: string) => (unfolded = unfolded.includes(id) ? unfolded.filter((x) => x !== id) : [...unfolded, id]);
  const open = (id: string) => {
    chatView.open = id;
    openSession(id);
    void focusInput();
  };
  const startNew = (characterId: string) => {
    chatView.open = newSession(characterId).id;
    void focusInput();
  };

  const send = () => {
    if (chatState.busy) return cancelChat();
    const text = message;
    message = '';
    void sendChat(text, chatView.open ?? undefined);
  };

  const together = () => {
    if (!chatView.open) return;
    const topic = message;
    message = '';
    void talkTogether(chatView.open, turns, topic);
  };

  const askDelete = (id: string) => {
    if (confirmDelete === id) {
      confirmDelete = null;
      deleteSession(id);
      return;
    }
    confirmDelete = id;
    setTimeout(() => {
      if (confirmDelete === id) confirmDelete = null;
    }, 3000);
  };

  const desk = async (id: string) => {
    if (friendsOnScreen.has(id)) api.closeFriend(id);
    else await api.openFriend(id).catch((error) => logError('chat:friend', error, 'warn'));
  };
</script>

{#snippet bubble(m: ChatMessage, extra: string, group: boolean)}
  <li class="chat-bubble {m.role}{m.speaker?.startsWith('guest:') ? ' guest' : ''} {extra}">
    {#if group && m.role === 'pet' && m.speaker}<span class="chat-who">{nameOf(m.speaker)}</span>{/if}{#if m.role === 'pet'}<Markdown text={m.text} onlink={(href) => (askLink = href)} />{:else}{m.text}{/if}
  </li>
{/snippet}

<div id="chat-list-view" hidden={Boolean(view.session)}>
  <div class="row chat-top"><span class="hint grow">{t('chat.pickHint')}</span></div>
  <ul class="chat-friends" id="chat-friends">
    {#if !view.session}
      {#each view.friends as f (f.id)}
        {@const isOpen = unfolded.includes(f.id)}
        <li class="chat-friend" class:open={isOpen}>
          <button type="button" class="chat-friend-head" aria-expanded={isOpen} data-id={f.id} onclick={() => fold(f.id)}>
            <span class="chat-caret">{isOpen ? '▾' : '▸'}</span>
            <span class="chat-friend-name">{f.name}{#if f.id === pack.id}&nbsp;<small>{t('chat.currentPet')}</small>{/if}</span>
            <span class="chat-friend-meta">{f.sessions.length ? t('chat.sessionCount', { count: f.sessions.length }) : ''}{f.sessions[0] ? ` · ${when(f.sessions[0].updatedAt, Date.now())}` : ''}</span>
          </button>
          {#if isOpen}
            <ul class="chat-sessions">
              {#each f.sessions as s (s.id)}
                <li class="chat-session-row">
                  <button type="button" class="chat-session" onclick={() => open(s.id)}><b>{s.title}</b><span>{s.preview}</span></button>
                  <span class="chat-session-when">{when(s.updatedAt, Date.now())}</span>
                  <button type="button" class="icon-button ghost" aria-label={t('chat.deleteSession')} onclick={() => askDelete(s.id)}>{confirmDelete === s.id ? '?' : '×'}</button>
                </li>
              {/each}
              <li><button type="button" class="chat-new" onclick={() => startNew(f.id)}>+ {t('chat.newSession')}</button></li>
            </ul>
          {/if}
        </li>
      {/each}
    {/if}
  </ul>
</div>
<div id="chat-session-view" hidden={!view.session}>
  {#if view.session}
    {@const session = view.session}
    <div class="row chat-top">
      <button type="button" class="icon-button" aria-label={t('chat.backToList')} onclick={() => (chatView.open = null)}>‹</button>
      <div class="chat-title grow" id="chat-title">
        <input type="text" id="chat-title-input" value={session.title} maxlength="40" aria-label={t('chat.sessionTitle')} onchange={(e) => renameSession(session.id, e.currentTarget.value)} />
        <small>{view.name} · {providerLabel()}</small>
      </div>
    </div>
    <div class="chat-members" id="chat-members">
      <div class="chat-member-list">
        {#each view.members as id (id)}
          {@const route = routeFor(chatState.config, id)}
          <span class="chat-member" data-tip="{providerName(route.provider)}{route.model ? ` · ${route.model}` : ''}">
            {nameOf(id)}<small>{providerName(route.provider)}</small>
            {#if id !== pack.id}<button type="button" class="ghost mini" onclick={() => desk(id)}>{friendsOnScreen.has(id) ? t('friends.sendBack') : t('friends.call')}</button>{/if}
            {#if id !== session.characterId}<button type="button" class="ghost mini" aria-label={t('chat.removeMember')} onclick={() => removeFromSession(session.id, id)}>×</button>{/if}
          </span>
        {/each}
      </div>
      <div class="row">
        {#if view.invitable.length}
          <select id="chat-invite" aria-label={t('chat.invite')} onchange={(e) => { if (e.currentTarget.value) inviteToSession(session.id, e.currentTarget.value); }}>
            <option value="">＋ {t('chat.invite')}</option>
            {#each view.invitable as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
          </select>
        {/if}
        {#if view.members.length > 1}
          <select id="chat-turns" aria-label={t('chat.turns')} bind:value={turns}>
            {#each [4, 6, 10] as n (n)}<option value={n}>{t('chat.turnsN', { count: n })}</option>{/each}
          </select>
          <button type="button" disabled={view.anyBusy} data-tip={t('chat.togetherTip')} onclick={together}>{t('chat.together')}</button>
          <label class="toggle mini">{t('chat.mirror')}<input type="checkbox" id="chat-mirror" checked={session.mirror !== false} onchange={(e) => setMirror(session.id, e.currentTarget.checked)} /></label>
        {/if}
      </div>
    </div>
    <div class="chat-log-wrap">
    <ul class="chat-log" id="chat-log" aria-live="polite" bind:this={log} onscroll={scrolled}>
      {#each session.messages as m, i (`${i}:${m.text}`)}{@render bubble(m, '', view.group)}{/each}
      {#if view.pending}{@render bubble({ role: 'pet', text: live || '…', speaker: view.pendingSpeaker }, live ? '' : 'thinking', view.group)}{/if}
      {#if !session.messages.length && !view.pending}
        <li class="chat-bubble system">{t('chat.intro', { name: view.name })}</li>
      {/if}
    </ul>
    {#if newBelow}<button type="button" class="mini chat-new-below" id="chat-new-below" onclick={toBottom}>{t('chat.newBelow')}</button>{/if}
    {#if askLink}
      <div class="chat-link-confirm" id="chat-link-confirm" role="alertdialog" aria-label={t('chat.openLink')}>
        <span>{t('chat.openLinkAsk')}</span>
        <span class="chat-link-url">{askLink}</span>
        <div class="row">
          <button type="button" class="mini primary" id="chat-link-open" onclick={openLink}>{t('settings.mods.open')}</button>
          <button type="button" class="mini ghost" id="chat-link-cancel" onclick={() => (askLink = null)}>{t('common.cancel')}</button>
        </div>
      </div>
    {/if}
    </div>
    <div class="row">
      <span class="grow" bind:this={input}>
        <TextInput id="chat-input" maxlength={2000} bind:value={message} onenter={send} disabled={view.anyBusy || view.none}
          placeholder={view.none ? t('chat.noProvider') : view.members.length > 1 ? t('chat.toAll') : t('chat.toOne', { name: view.name })} />
      </span>
      <button type="button" id="chat-send" onclick={send}>{view.busy ? t('chat.stop') : t('chat.send')}</button>
    </div>
  {/if}
</div>

<style>
  .chat-log-wrap {
    position: relative;
  }

  .chat-link-confirm {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    background: var(--color-panel);
    border: 2px solid var(--color-edge-hi);
    box-shadow: 2px 2px 0 var(--color-shadow);
  }

  .chat-link-url {
    font: var(--type-small) var(--font-small);
    color: var(--color-ink-2);
    overflow-wrap: anywhere;
    user-select: text;
  }

  .chat-new-below {
    position: absolute;
    left: 50%;
    bottom: 14px;
    transform: translateX(-50%);
  }
</style>
