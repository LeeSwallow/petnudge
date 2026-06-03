import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createMockPlannerState } from '../domain/planner';

type Props = {
  onStartFocus: () => void;
};

const planner = createMockPlannerState();

export function PlannerPanel({ onStartFocus }: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Pixel Planner Note</Text>
      <Text style={styles.goal}>오늘 목표: {planner.currentGoal}</Text>
      {planner.todos.map((todo) => (
        <Text key={todo.id} style={styles.todo}>[{todo.status === 'done' ? '✓' : ' '}] {todo.title}</Text>
      ))}
      <Text style={styles.timer}>Desk Timer {planner.timer.focusMinutes}:00 / break {planner.timer.breakMinutes}:00</Text>
      <Pressable style={styles.button} onPress={onStartFocus}>
        <Text style={styles.buttonText}>타이머 누르기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 3,
    borderColor: '#ffb86b',
    backgroundColor: '#2a1d33',
    padding: 14,
    gap: 6
  },
  title: {
    color: '#ffd1e8',
    fontWeight: '700'
  },
  goal: {
    color: '#f4edff'
  },
  todo: {
    color: '#f4edff'
  },
  timer: {
    color: '#8fc7ff'
  },
  button: {
    alignSelf: 'flex-end',
    borderWidth: 2,
    borderColor: '#f7f26b',
    backgroundColor: '#ffb86b',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    color: '#1a1024',
    fontWeight: '700'
  }
});
