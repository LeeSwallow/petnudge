import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SceneState } from '../domain/scene';

type Props = {
  scene: SceneState;
  onAdvance: () => void;
};

export function DialoguePanel({ scene, onAdvance }: Props) {
  if (scene.phase !== 'break_dialogue_active') {
    return null;
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.name}>Companion</Text>
      <Text style={styles.text}>...수고했어. 이번 세션은 조금 길게 느껴졌지?</Text>
      <Text style={styles.turn}>reward talk {scene.dialogueTurn}/{scene.maxRewardDialogueTurns}</Text>
      <Pressable style={styles.button} onPress={onAdvance}>
        <Text style={styles.buttonText}>짧게 답하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 3,
    borderColor: '#ff6fae',
    backgroundColor: '#17142c',
    padding: 14,
    gap: 8
  },
  name: {
    color: '#ffb86b',
    fontWeight: '700'
  },
  text: {
    color: '#f4edff',
    lineHeight: 22
  },
  turn: {
    color: '#b8b0d8',
    fontSize: 12
  },
  button: {
    alignSelf: 'flex-end',
    borderWidth: 2,
    borderColor: '#ffd1e8',
    backgroundColor: '#ff6fae',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    color: '#1a1024',
    fontWeight: '700'
  }
});
