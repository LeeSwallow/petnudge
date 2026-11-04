<script lang="ts">
  import { api } from '../../../renderer/api';
  import { pack, setCharacter } from '../../../renderer/character';
  import { data, refreshAll, updateSettings } from '../../../renderer/data';
  import { petStore } from '../../../renderer/store';
  import { logError } from '../../log';
  import { BACKUP_TEXT, backupCounts, errorLine, exportResult, exportedOn, importedSession } from './logic';

  // Settings → 데이터 백업. Main does the file dialogs and the actual work;
  // this section only shows what a file holds and asks once more before
  // overwriting.

  type Preview = { file: string; exportedAt: string; todos: number; notes: number; sessions: number; playlists: number };

  let busy = $state(false);
  let status = $state<string>(BACKUP_TEXT.intro);
  let preview = $state<Preview | null>(null);

  const run = async (task: () => Promise<void>) => {
    busy = true;
    try {
      await task();
    } catch (error) {
      logError('settings:backup', error);
      status = errorLine(error);
    } finally {
      busy = false;
    }
  };

  // The running pet keeps its progress in memory, so imported progress is
  // applied to the store itself (which then persists it).
  const applyImportedSession = (raw: string | null) => {
    const patch = importedSession(raw, data.todos.map((t) => t.id));
    if (!patch) return;
    const store = petStore.getState();
    petStore.setState(patch as Partial<typeof store>);
    petStore.getState().applySettings(data.settings);
  };

  const exportData = () =>
    run(async () => {
      preview = null;
      status = BACKUP_TEXT.exporting;
      status = exportResult(await api.exportData());
    });

  const importData = () =>
    run(async () => {
      preview = null;
      status = BACKUP_TEXT.picking;
      const picked = await api.importData();
      if (!picked) {
        status = BACKUP_TEXT.importCancelled;
        return;
      }
      status = '';
      preview = picked;
    });

  const apply = () =>
    run(async () => {
      status = BACKUP_TEXT.importing;
      const characterId = data.settings.characterId;
      const { session } = await api.confirmImport();
      preview = null;
      await refreshAll();
      applyImportedSession(session);
      if (data.settings.characterId !== characterId && data.settings.characterId !== pack.id) {
        try {
          await setCharacter(await api.getCharacter(data.settings.characterId));
        } catch {
          await updateSettings({ characterId: pack.id });
        }
      }
      status = BACKUP_TEXT.imported;
    });

  const cancel = () => {
    preview = null;
    void api.cancelImport();
    status = BACKUP_TEXT.importCancelled;
  };
</script>

<div class="section-title">데이터 백업 <small>JSON 파일</small></div>
<div class="frame well setting-group" id="backup-box">
  <div class="row">
    <button type="button" class="grow" data-action="backup-export" disabled={busy} onclick={exportData}>내보내기(JSON)</button>
    <button type="button" class="grow" data-action="backup-import" disabled={busy} onclick={importData}>가져오기(JSON)</button>
  </div>
  <div class="backup-confirm" id="backup-confirm" hidden={!preview}>
    {#if preview}
      <div><b>{preview.file}</b> <small>{exportedOn(preview.exportedAt)}</small></div>
      <div class="hint">{backupCounts(preview)}</div>
      <div class="hint">{BACKUP_TEXT.overwrite}</div>
      <div class="row">
        <button type="button" class="danger grow" data-action="backup-apply" disabled={busy} onclick={apply}>정말 덮어쓸까요?</button>
        <button type="button" class="ghost" data-action="backup-cancel" disabled={busy} onclick={cancel}>취소</button>
      </div>
    {/if}
  </div>
  <div class="hint" id="backup-status" role="status" aria-live="polite">{status}</div>
</div>
