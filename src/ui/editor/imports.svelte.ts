import type { ImportedCharacter, ImportedLayers } from '../../domain/character-editor/ipc';
import { matchLayers, type Matched, type NamedPicture } from '../../domain/character/layered';
import type { Pixels } from '../../domain/character/pixels';
import { customName } from '../../domain/character/placement';
import { editorApi, logEditorError } from './api';
import { editor, replaceDraft, setParts } from './draft.svelte';
import { notice } from './pictures.svelte';
import { NEW_DECORATION } from './slots';

// Bringing in many parts at once (#57): a layered file's layers, and another
// character's parts. Each lands in the draft as one undo step (setParts);
// starting from another character replaces the draft (also one step).
//
//   layered        the layered file waiting for the user's choices, or null:
//                  `matched` layers fill their standard slots, `unmatched` ones
//                  are listed in a dialog to pick a slot for or skip
//   characterPick  which character dialog is open: 'parts' (tick parts to copy
//                  into this draft), 'start' (새로 만들기 › 기존 캐릭터에서 시작), or null

export type LayeredImport = { name: string; matched: Matched[]; unmatched: NamedPicture[] };
export const imports = $state<{ layered: LayeredImport | null; characterPick: 'parts' | 'start' | null }>({ layered: null, characterPick: null });

const fail = (error: unknown) => {
  notice.text = error instanceof Error ? error.message : String(error);
};

// Puts the chosen pictures in; `choices[i]` is the layer for unmatched[i]
// ('' skips it, NEW_DECORATION makes a decoration named after the layer).
export const placeLayered = (file: LayeredImport, choices: readonly string[]) => {
  const parts: { layer: string; pixels: Pixels }[] = file.matched.map(({ layer, pixels }) => ({ layer, pixels }));
  const taken: Record<string, unknown> = { ...editor.draft.parts };
  file.unmatched.forEach(({ name, pixels }, i) => {
    const choice = choices[i];
    if (!choice) return;
    const layer = choice === NEW_DECORATION ? customName(name, taken) : choice;
    taken[layer] = true;
    parts.push({ layer, pixels });
  });
  setParts(parts);
  imports.layered = null;
  notice.text = parts.length ? `${file.name}에서 레이어 ${parts.length}개를 넣었어요` : '넣은 레이어가 없어요';
};

// A layered file read by main: straight in when every layer has a standard
// name, else the dialog asks about the rest.
export const openLayered = (file: ImportedLayers) => {
  try {
    const { matched, unmatched } = matchLayers(file.layers);
    if (!matched.length && !unmatched.length) throw new Error(`${file.name}에 그림이 있는 레이어가 없어요`);
    const pending = { name: file.name, matched, unmatched };
    if (unmatched.length) imports.layered = pending;
    else placeLayered(pending, []);
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
export const copyParts = (from: ImportedCharacter, layers: readonly string[]) => {
  setParts(layers.flatMap((layer) => (from.draft.parts[layer] ? [{ layer, pixels: from.draft.parts[layer] }] : [])));
  imports.characterPick = null;
  notice.text = layers.length ? `${from.draft.name}에서 부위 ${layers.length}개를 가져왔어요` : '';
};

// 기존 캐릭터에서 시작: the converted character as a new draft (undoable). Its
// id is cleared, so saving makes a copy and never writes over the original.
export const startFrom = (from: ImportedCharacter) => {
  replaceDraft({ ...from.draft, id: '', parts: { ...from.draft.parts }, order: [...from.draft.order] });
  imports.characterPick = null;
  notice.text = `${from.draft.name}에서 시작해요`;
};
