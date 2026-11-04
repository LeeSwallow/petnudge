import type { ImportedCharacter, ImportedLayers } from '../../domain/character-editor/ipc';
import { editorApi, logEditorError } from './api';
import { copyParts as copyInto, importLayered as importInto, replaceDraft } from './draft.svelte';
import { notice } from './pictures.svelte';

// Bringing in many parts at once (#57, #71): a layered file's layers, and
// another character's parts. Each lands in the draft as one undo step;
// starting from another character replaces the draft (also one step).
//
//   characterPick  which character dialog is open: 'parts' (tick parts to copy
//                  into this draft), 'start' (새로 만들기 › 기존 캐릭터에서 시작), or null

export const imports = $state<{ characterPick: 'parts' | 'start' | null }>({ characterPick: null });

const fail = (error: unknown) => {
  notice.text = error instanceof Error ? error.message : String(error);
};

// A layered file read by main: every layer goes in. A layer named like a part
// fills it, any other becomes a new part named after it (layered.ts).
export const openLayered = (file: ImportedLayers) => {
  try {
    const placed = importInto(file.layers);
    if (!placed.length) throw new Error(`${file.name}에 그림이 있는 레이어가 없어요`);
    const made = placed.filter((p) => p.created).length;
    notice.text = `${file.name}에서 레이어 ${placed.length}개를 넣었어요${made ? ` (새 부위 ${made}개)` : ''}`;
  } catch (error) {
    fail(error);
  }
};

export const importLayered = async () => {
  const result = await editorApi.importLayered();
  if (!result.ok) {
    fail(result.error.message);
    logEditorError('editor', result, 'warn');
  } else if (result.value) openLayered(result.value);
};

// Another character's parts (main converts an @2 pack).
export const loadCharacter = async (id: string): Promise<ImportedCharacter> => {
  const result = await editorApi.importCharacter(id);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

// The ticked parts of another character into this draft, one undo step.
export const copyParts = (from: ImportedCharacter, ids: readonly string[]) => {
  copyInto(from.draft, ids);
  imports.characterPick = null;
  notice.text = ids.length ? `${from.draft.name}에서 부위 ${ids.length}개를 가져왔어요` : '';
};

// 기존 캐릭터에서 시작: the converted character as a new draft (undoable). Its
// id is cleared, so saving makes a copy and never writes over the original.
export const startFrom = (from: ImportedCharacter) => {
  replaceDraft({ ...from.draft, id: '', parts: [...from.draft.parts] });
  imports.characterPick = null;
  notice.text = `${from.draft.name}에서 시작해요`;
};
