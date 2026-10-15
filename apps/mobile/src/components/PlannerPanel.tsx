import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_TODOS } from '../domain/planner';
import { useStudyStore } from '../store/studyStore';

export function PlannerPanel() {
  const planner = useStudyStore((s) => s.planner);
  const setGoal = useStudyStore((s) => s.setGoal);
  const addTodo = useStudyStore((s) => s.addTodo);
  const toggleTodo = useStudyStore((s) => s.toggleTodo);
  const removeTodo = useStudyStore((s) => s.removeTodo);
  const adjustFocusMinutes = useStudyStore((s) => s.adjustFocusMinutes);
  const startFocus = useStudyStore((s) => s.startFocus);
  const [draft, setDraft] = useState('');

  const submitDraft = () => {
    addTodo(draft);
    setDraft('');
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Pixel Planner Note</Text>
      <TextInput
        style={styles.input}
        value={planner.currentGoal}
        onChangeText={setGoal}
        placeholder="오늘 목표"
        placeholderTextColor="#7d7399"
      />
      {planner.todos.map((todo) => (
        <View key={todo.id} style={styles.todoRow}>
          <Pressable style={styles.todoMain} onPress={() => toggleTodo(todo.id)}>
            <Text style={[styles.todo, todo.status === 'done' && styles.todoDone]}>
              [{todo.status === 'done' ? '✓' : ' '}] {todo.title}
            </Text>
          </Pressable>
          <Pressable onPress={() => removeTodo(todo.id)} hitSlop={8}>
            <Text style={styles.remove}>×</Text>
          </Pressable>
        </View>
      ))}
      {planner.todos.length < MAX_TODOS ? (
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submitDraft}
          placeholder={`할 일 추가 (${planner.todos.length}/${MAX_TODOS})`}
          placeholderTextColor="#7d7399"
          returnKeyType="done"
        />
      ) : null}
      <View style={styles.timerRow}>
        <Pressable style={styles.stepper} onPress={() => adjustFocusMinutes(-5)}>
          <Text style={styles.stepperText}>-5</Text>
        </Pressable>
        <Text style={styles.timer}>
          Desk Timer {planner.timer.focusMinutes}:00 / break {planner.timer.breakMinutes}:00
        </Text>
        <Pressable style={styles.stepper} onPress={() => adjustFocusMinutes(5)}>
          <Text style={styles.stepperText}>+5</Text>
        </Pressable>
      </View>
      <Pressable style={styles.button} onPress={startFocus}>
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
  input: {
    borderWidth: 2,
    borderColor: '#6d5aa8',
    backgroundColor: '#17142c',
    color: '#f4edff',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  todoMain: {
    flex: 1
  },
  todo: {
    color: '#f4edff'
  },
  todoDone: {
    color: '#9a90b8',
    textDecorationLine: 'line-through'
  },
  remove: {
    color: '#ff6fae',
    fontWeight: '700',
    paddingHorizontal: 6
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  timer: {
    flex: 1,
    color: '#8fc7ff',
    textAlign: 'center'
  },
  stepper: {
    borderWidth: 2,
    borderColor: '#8fc7ff',
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  stepperText: {
    color: '#8fc7ff',
    fontWeight: '700'
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
