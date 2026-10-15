import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EXP_PER_LEVEL, getLevel, unlockables } from '../domain/progress';
import { formatRemaining, getRemainingMs } from '../domain/timer';
import { useStudyStore } from '../store/studyStore';
import { PixelIcon } from './PixelIcon';

type Props = {
  now: number;
};

const timerLabel = { idle: 'READY', focus: 'FOCUS', break: 'BREAK' } as const;

export function StudyHud({ now }: Props) {
  const timer = useStudyStore((s) => s.timer);
  const progress = useStudyStore((s) => s.progress);
  const pendingUnlockId = useStudyStore((s) => s.pendingUnlocks[0]);
  const dismissUnlock = useStudyStore((s) => s.dismissUnlock);
  const pendingUnlock = unlockables.find((item) => item.id === pendingUnlockId);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.timer}>
          {timerLabel[timer.mode]} {timer.mode === 'idle' ? '--:--' : formatRemaining(getRemainingMs(timer, now))}
        </Text>
        <View style={styles.stats}>
          <Text style={styles.stat}>Lv.{getLevel(progress.exp)} · {progress.exp % EXP_PER_LEVEL}/{EXP_PER_LEVEL} EXP ·</Text>
          <PixelIcon name="fire" label="연속 학습" />
          <Text style={styles.stat}>{progress.streakDays}</Text>
        </View>
      </View>
      {pendingUnlock ? (
        <Pressable style={styles.unlock} onPress={dismissUnlock}>
          <Text style={styles.unlockText}>
            해금! {pendingUnlock.kind === 'place' ? '장소' : '복장'}: {pendingUnlock.title} (탭해서 닫기)
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timer: {
    color: '#f7f26b',
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums']
  },
  stat: {
    color: '#b8b0d8',
    fontSize: 12
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  unlock: {
    borderWidth: 2,
    borderColor: '#f7f26b',
    backgroundColor: '#3a2a12',
    padding: 8
  },
  unlockText: {
    color: '#ffd28a',
    fontWeight: '700'
  }
});
