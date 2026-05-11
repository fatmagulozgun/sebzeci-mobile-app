import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, ViewStyle } from 'react-native';

type Props = {
  width?: number | `${number}%` | '100%';
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'green' | 'button';
};

const toneStyles = {
  default: { backgroundColor: '#EEF2F0', borderColor: '#E3EAE5' },
  green: { backgroundColor: '#EAF8EF', borderColor: '#D2F0DC' },
  button: { backgroundColor: '#DCEFE3', borderColor: '#C8E8D2' },
};

export default function SkeletonBlock({ width = '100%', height, borderRadius = 10, style, tone = 'default' }: Props) {
  const opacity = useRef(new Animated.Value(0.72)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.72, duration: 850, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        toneStyles[tone],
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    borderWidth: 1,
  },
});
