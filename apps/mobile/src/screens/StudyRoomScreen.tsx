import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { DialoguePanel } from '../components/DialoguePanel';
import { MockPixelScene } from '../components/MockPixelScene';
import { PlannerPanel } from '../components/PlannerPanel';
import type { SceneState } from '../domain/scene';
import {
  advanceDialogue,
  advanceTransition,
  completeFocus,
  createInitialSceneState,
  openBreakPlanner,
  startFocus
} from '../scene/sceneMachine';

const isPlannerVisible = (scene: SceneState) =>
  scene.phase === 'planning_note_open' ||
  scene.phase === 'planning_timer_set' ||
  scene.phase === 'break_planning';

export function StudyRoomScreen() {
  const [scene, setScene] = useState(createInitialSceneState);

  const handleAdvance = () => {
    setScene((current) => {
      if (current.phase === 'focus_active') return completeFocus(current);
      if (current.phase === 'break_dialogue_active') return advanceDialogue(current);
      return advanceTransition(current);
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Lofi Study Companion</Text>
        <Text style={styles.subtitle}>mobile mock · future Skia layers</Text>
      </View>

      <MockPixelScene scene={scene} />

      <View style={styles.bottom}>
        {isPlannerVisible(scene) ? (
          <PlannerPanel onStartFocus={() => setScene((current) => startFocus(current))} />
        ) : (
          <>
            <DialoguePanel scene={scene} onAdvance={() => setScene((current) => advanceDialogue(current))} />
            {scene.phase === 'break_idle_window' ? (
              <Pressable style={styles.secondaryButton} onPress={() => setScene((current) => openBreakPlanner(current))}>
                <Text style={styles.secondaryButtonText}>노트/타이머 정리하기</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.secondaryButton} disabled={scene.inputLocked} onPress={handleAdvance}>
                <Text style={styles.secondaryButtonText}>{scene.inputLocked ? '전이 중...' : '다음 장면'}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#080812',
    padding: 14,
    gap: 12
  },
  header: {
    gap: 2
  },
  title: {
    color: '#ffd1e8',
    fontSize: 20,
    fontWeight: '800'
  },
  subtitle: {
    color: '#8fc7ff'
  },
  bottom: {
    gap: 10
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#6d5aa8',
    backgroundColor: '#17142c',
    padding: 12,
    alignItems: 'center'
  },
  secondaryButtonText: {
    color: '#f4edff',
    fontWeight: '700'
  }
});
