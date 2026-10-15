import { api } from '../api';
import { esc } from '../charts';
import { pack, setCharacter } from '../character';
import { data, refreshAll, updateSettings } from '../data';
import { petStore } from '../store';
import type { BackupSummary } from '../../main/backup';
import { $, onAction } from './module';

// Settings → 데이터 백업. Main does the file dialogs and the actual work;
// this section only shows what a file holds and asks once more before
// overwriting.

export const backupSection = `
  <div class="section-title">데이터 백업 <small>JSON 파일</small></div>
  <div class="frame well setting-group" id="backup-box">
    <div class="row">
      <button type="button" class="grow" data-action="backup-export">내보내기(JSON)</button>
      <button type="button" class="grow" data-action="backup-import">가져오기(JSON)</button>
    </div>
    <div class="backup-confirm" id="backup-confirm" hidden></div>
    <div class="hint" id="backup-status" role="status" aria-live="polite">할 일·메모·집중 기록·플레이리스트·설정을 파일 하나로 옮겨요. 토큰 같은 비밀 값은 빼고 저장해요.</div>
  </div>`;

const counts = (s: BackupSummary) => `할 일 ${s.todos} · 메모 ${s.notes} · 집중 기록 ${s.sessions} · 플레이리스트 ${s.playlists}`;

const cleanError = (error: unknown) =>
  error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error);

const exportedOn = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : `${date.toLocaleDateString('ko-KR')} 백업`;
};

// The running pet keeps its progress in memory and writes it back every
// tick, so imported progress is applied to the store itself (which then
// persists it) rather than only to the database.
const applyImportedSession = (raw: string | null) => {
  if (!raw) return;
  try {
    const { state } = JSON.parse(raw) as { state?: Record<string, unknown> };
    if (!state) return;
    const store = petStore.getState();
    const activeTodoId = typeof state.activeTodoId === 'string' && data.todos.some((t) => t.id === state.activeTodoId) ? state.activeTodoId : null;
    petStore.setState({
      ...(state.progress ? { progress: state.progress as typeof store.progress } : {}),
      ...(state.planner ? { planner: state.planner as typeof store.planner } : {}),
      pendingUnlocks: [],
      activeTodoId
    });
    petStore.getState().applySettings(data.settings);
  } catch {
    // progress stays as it was
  }
};

export const mountBackup = (root: HTMLElement) => {
  const box = $(root, '#backup-box');
  const status = $(box, '#backup-status');
  const confirm = $(box, '#backup-confirm');
  const buttons = () => box.querySelectorAll<HTMLButtonElement>('button');

  const run = async (task: () => Promise<void>) => {
    buttons().forEach((b) => (b.disabled = true));
    try {
      await task();
    } catch (error) {
      status.textContent = `✗ ${cleanError(error)}`;
    } finally {
      buttons().forEach((b) => (b.disabled = false));
    }
  };

  const hideConfirm = () => {
    confirm.hidden = true;
    confirm.innerHTML = '';
  };

  onAction(box, {
    'backup-export': () =>
      void run(async () => {
        hideConfirm();
        status.textContent = '내보내는 중…';
        const result = await api.exportData();
        status.textContent = result ? `✓ ${result.file} 에 저장했어요 · ${counts(result)}` : '내보내기를 취소했어요';
      }),
    'backup-import': () =>
      void run(async () => {
        hideConfirm();
        status.textContent = '파일을 고르는 중…';
        const preview = await api.importData();
        if (!preview) {
          status.textContent = '가져오기를 취소했어요';
          return;
        }
        status.textContent = '';
        confirm.innerHTML = `
          <div><b>${esc(preview.file)}</b> <small>${esc(exportedOn(preview.exportedAt))}</small></div>
          <div class="hint">${counts(preview)}</div>
          <div class="hint">지금 데이터가 이 파일 내용으로 바뀌어요. 되돌릴 수 없으니 먼저 내보내 두면 안전해요.</div>
          <div class="row">
            <button type="button" class="danger grow" data-action="backup-apply">정말 덮어쓸까요?</button>
            <button type="button" class="ghost" data-action="backup-cancel">취소</button>
          </div>`;
        confirm.hidden = false;
      }),
    'backup-apply': () =>
      void run(async () => {
        status.textContent = '가져오는 중…';
        const characterId = data.settings.characterId;
        const { session } = await api.confirmImport();
        hideConfirm();
        await refreshAll();
        applyImportedSession(session);
        if (data.settings.characterId !== characterId && data.settings.characterId !== pack.id) {
          try {
            await setCharacter(await api.getCharacter(data.settings.characterId));
          } catch {
            await updateSettings({ characterId: pack.id });
          }
        }
        status.textContent = '✓ 가져왔어요. 모든 탭에 반영됐어요';
      }),
    'backup-cancel': () => {
      hideConfirm();
      void api.cancelImport();
      status.textContent = '가져오기를 취소했어요';
    }
  });
};
