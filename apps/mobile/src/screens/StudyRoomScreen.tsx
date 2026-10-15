import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { DialoguePanel } from '../components/DialoguePanel';
import { SkiaStudyRoomScene } from '../components/SkiaStudyRoomScene';
import { PlannerPanel } from '../components/PlannerPanel';
import { StudyHud } from '../components/StudyHud';
import type { SceneState } from '../domain/scene';
import { useStudyStore } from '../store/studyStore';

const isPlannerVisible = (scene: SceneState) =>
  scene.phase === 'planning_note_open' ||
  scene.phase === 'planning_timer_set' ||
  scene.phase === 'break_planning';

export function StudyRoomScreen() {
  const scene = useStudyStore((s) => s.scene);
  const tick = useStudyStore((s) => s.tick);
  const advanceTransition = useStudyStore((s) => s.advanceTransition);
  const advanceDialogue = useStudyStore((s) => s.advanceDialogue);
  const openBreakPlanner = useStudyStore((s) => s.openBreakPlanner);
  const abandonFocus = useStudyStore((s) => s.abandonFocus);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      tick(current);
    }, 1000);
    return () => clearInterval(id);
  }, [tick]);

  const handleAdvance = () => {
    if (scene.phase === 'break_dialogue_active') advanceDialogue();
    else advanceTransition();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Lofi Study Companion</Text>
        <Text style={styles.subtitle}>pomodoro · planner · progress</Text>
      </View>

      <StudyHud now={now} />

      <SkiaStudyRoomScene scene={scene} />

      <View style={styles.bottom}>
        {isPlannerVisible(scene) ? (
          <PlannerPanel />
        ) : (
          <>
            <DialoguePanel scene={scene} onAdvance={advanceDialogue} />
            {scene.phase === 'focus_active' ? (
              <Pressable style={styles.secondaryButton} onPress={abandonFocus}>
                <Text style={styles.secondaryButtonText}>이번 세션 그만두기</Text>
              </Pressable>
            ) : scene.phase === 'break_idle_window' ? (
              <Pressable style={styles.secondaryButton} onPress={openBreakPlanner}>
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
