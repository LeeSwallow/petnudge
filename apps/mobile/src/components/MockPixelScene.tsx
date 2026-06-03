import { StyleSheet, Text, View } from 'react-native';
import type { SceneState } from '../domain/scene';
import { mockSceneLayers } from '../scene/mockLayers';

type Props = {
  scene: SceneState;
};

export function MockPixelScene({ scene }: Props) {
  return (
    <View style={styles.scene}>
      <Text style={styles.phase}>{scene.phase}</Text>
      <Text style={styles.meta}>light: {scene.lightingMood} · anim: {scene.characterAnimation}</Text>
      <View style={styles.layerStack}>
        {mockSceneLayers.map((layer) => (
          <View
            key={layer.key}
            style={[
              styles.layer,
              {
                borderColor: layer.mockColor,
                backgroundColor: `${layer.mockColor}33`,
                opacity: layer.opacity
              }
            ]}
          >
            <Text style={styles.layerText}>{layer.zIndex}. {layer.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    borderWidth: 3,
    borderColor: '#6d5aa8',
    backgroundColor: '#0b0b18',
    padding: 12,
    justifyContent: 'space-between'
  },
  phase: {
    color: '#ffd1e8',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  meta: {
    color: '#b8b0d8',
    fontSize: 12
  },
  layerStack: {
    gap: 6
  },
  layer: {
    borderWidth: 2,
    padding: 6
  },
  layerText: {
    color: '#f4edff',
    fontSize: 11
  }
});
