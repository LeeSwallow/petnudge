import { pixelIcon } from '../icons';
import { pack } from '../character';
import { activeSession, cancelChat, chatAvailable, chatState, onChat, providerLabel, sendChat } from '../chat';
import { onEnter } from '../../ui/dom';
import { onLocaleChange, t } from '../../i18n';

// The quick chat bar: the talk button in the dock beside her (src/ui/dock,
// passed in as `slot`) opens a small input right above her head; replies show in her speech bubble and go into
// her current session (the 대화 tab shows the whole conversation).
// The tray's 말 걸기 and the chat shortcut open the input too, through the
// returned function, even when the button is turned off.

export const installChatBar = (openFull: () => void, slot: HTMLElement): { openInput: () => void } => {
  const unit = document.getElementById('pet-unit')!;
  const body = document.getElementById('pet-body')!;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'chat-toggle';
  button.className = 'icon-button';
  button.dataset.hit = '';
  button.innerHTML = pixelIcon('talk');

  const bar = document.createElement('div');
  bar.id = 'chat-bar';
  bar.className = 'frame';
  bar.dataset.hit = '';
  bar.hidden = true;
  // Opened from the tray or the shortcut: stays while the button is off.
  let summoned = false;
  bar.innerHTML = `
    <input type="text" id="chat-quick" maxlength="2000" autocomplete="off" />
    <button type="button" class="icon-button" id="chat-quick-send"></button>
    <button type="button" class="icon-button" id="chat-quick-full">⤢</button>`;
  const input = bar.querySelector<HTMLInputElement>('#chat-quick')!;
  const send = bar.querySelector<HTMLButtonElement>('#chat-quick-send')!;
  const full = bar.querySelector<HTMLButtonElement>('#chat-quick-full')!;

  unit.insertBefore(bar, body);
  slot.append(button);

  const render = () => {
    const busy = Boolean(chatState.pending);
    send.innerHTML = pixelIcon(busy ? 'stop' : 'play');
    send.setAttribute('aria-label', busy ? t('chat.stop') : t('chat.send'));
    full.setAttribute('aria-label', t('chatbar.full'));
    full.dataset.tip = t('chatbar.fullTip');
    input.disabled = busy;
    input.placeholder = chatAvailable()
      ? busy ? t('chatbar.thinking', { name: pack.name }) : t('chatbar.placeholder', { name: pack.name, provider: providerLabel() })
      : t('chat.noProvider');
    button.hidden = !chatState.config.button;
    if (!chatState.config.button && !summoned) bar.hidden = true;
    button.classList.toggle('on', !bar.hidden);
    button.setAttribute('aria-label', bar.hidden ? t('chatbar.talk') : t('chatbar.closeInput'));
    button.dataset.tip = bar.hidden ? t('chatbar.talk') : t('common.close');
  };

  const open = (show: boolean) => {
    if (!show) summoned = false;
    bar.hidden = !show;
    render();
    if (show) input.focus();
  };

  const submit = () => {
    if (chatState.pending) return cancelChat();
    const text = input.value;
    input.value = '';
    void sendChat(text, activeSession().id);
  };

  button.addEventListener('click', () => open(bar.hidden === true));
  send.addEventListener('click', submit);
  full.addEventListener('click', openFull);
  onEnter(input, submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') open(false);
  });
  onChat(() => {
    render();
    if (!chatState.pending && !bar.hidden) input.focus();
  });
  onLocaleChange(render);
  render();
  return {
    openInput: () => {
      summoned = true;
      open(true);
    }
  };
};
