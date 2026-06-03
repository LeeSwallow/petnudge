import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SceneState } from '../domain/scene';
import { mockSceneLayers } from '../scene/mockLayers';
import { buildRenderableLayers, layoutPixelBlocks } from '../scene/skiaLayerModel';

type Props = {
  scene: SceneState;
};

const sceneSize = {
  width: 360,
  height: 520
};

export function SkiaStudyRoomScene({ scene }: Props) {
  const blocks = useMemo(
    () => layoutPixelBlocks(buildRenderableLayers(mockSceneLayers, scene), sceneSize),
    [scene]
  );

  return (
    <View style={styles.frame}>
      <Canvas style={styles.canvas}>
        {blocks.map((block) => (
          <Group key={block.key} opacity={block.opacity}>
            <Rect x={block.x} y={block.y} width={block.width} height={block.height} color={block.color} />
          </Group>
        ))}
      </Canvas>
      <View pointerEvents="none" style={styles.overlay}>
        <Text style={styles.phase}>{scene.phase}</Text>
        <Text style={styles.meta}>light: {scene.lightingMood}</Text>
        <Text style={styles.meta}>animation: {scene.characterAnimation}</Text>
        <View style={styles.legend}>
          {blocks.map((block) => (
            <Text key={block.key} style={styles.legendText}>
              {block.zIndex}. {block.key} · {block.opacity.toFixed(2)}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    minHeight: 420,
    borderWidth: 3,
    borderColor: '#6d5aa8',
    backgroundColor: '#0b0b18',
    overflow: 'hidden'
  },
  canvas: {
    ...sceneSize,
    alignSelf: 'center'
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 12,
    justifyContent: 'space-between'
  },
  phase: {
    color: '#ffd1e8',
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  meta: {
    color: '#f4edff',
    fontSize: 12
  },
  legend: {
    gap: 2,
    backgroundColor: '#080812cc',
    borderWidth: 2,
    borderColor: '#17142c',
    padding: 8
  },
  legendText: {
    color: '#b8b0d8',
    fontSize: 10
  }
});
