import { pixelIcon } from '../icons';
import { pack } from '../character';
import { activeSession, cancelChat, chatAvailable, chatState, onChat, providerLabel, sendChat } from '../chat';
import { onEnter } from '../modules/module';

// The quick chat bar: a talk button beside her (shown on hover) opens a small
// input right above her head; replies show in her speech bubble and go into
// her current session (the 대화 tab shows the whole conversation).

export const installChatBar = (openFull: () => void) => {
  const unit = document.getElementById('pet-unit')!;
  const canvas = document.getElementById('pet')!;

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
  bar.innerHTML = `
    <input type="text" id="chat-quick" maxlength="2000" autocomplete="off" />
    <button type="button" class="icon-button" id="chat-quick-send"></button>
    <button type="button" class="icon-button" id="chat-quick-full" aria-label="대화 크게 보기" data-tip="크게 보기">⤢</button>`;
  const input = bar.querySelector<HTMLInputElement>('#chat-quick')!;
  const send = bar.querySelector<HTMLButtonElement>('#chat-quick-send')!;

  // The button sits on her shoulder, so it wraps the canvas.
  const body = document.createElement('div');
  body.id = 'pet-body';
  unit.insertBefore(bar, canvas);
  unit.insertBefore(body, canvas);
  body.append(canvas, button);

  const render = () => {
    const busy = Boolean(chatState.pending);
    send.innerHTML = pixelIcon(busy ? 'stop' : 'play');
    send.setAttribute('aria-label', busy ? '멈춤' : '보내기');
    input.disabled = busy;
    input.placeholder = chatAvailable()
      ? busy ? `${pack.name}가 생각 중…` : `${pack.name}에게 말하기 (${providerLabel()})`
      : '설정 › AI 대화 설정에서 연결해 주세요';
    button.hidden = !chatState.config.button;
    if (!chatState.config.button) bar.hidden = true;
    button.classList.toggle('on', !bar.hidden);
    button.setAttribute('aria-label', bar.hidden ? '말 걸기' : '입력창 닫기');
    button.dataset.tip = bar.hidden ? '말 걸기' : '닫기';
  };

  const open = (show: boolean) => {
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
  bar.querySelector('#chat-quick-full')!.addEventListener('click', openFull);
  onEnter(input, submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') open(false);
  });
  onChat(() => {
    render();
    if (!chatState.pending && !bar.hidden) input.focus();
  });
  render();
};
