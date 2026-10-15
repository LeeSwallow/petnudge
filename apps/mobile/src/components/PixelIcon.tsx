import { View } from 'react-native';
import { pixelIcons, pixelPalette, type PixelIconName } from '../domain/pixelIcons';

export function PixelIcon({ name, label }: { name: PixelIconName; label: string }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: 16, height: 16 }}>
      {pixelIcons[name].flatMap((row, y) => [...row].map((c, x) => c === '.' ? null : (
        <View key={`${x},${y}`} style={{ position: 'absolute', left: x * 2, top: y * 2, width: 2, height: 2, backgroundColor: pixelPalette[c] }} />
      )))}
    </View>
  );
}
