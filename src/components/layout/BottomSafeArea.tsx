import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomSafePadding } from '../../theme/layout';

type BottomSafeAreaProps = {
  extraPadding?: number;
};

export default function BottomSafeArea({ extraPadding = 0 }: BottomSafeAreaProps) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: getBottomSafePadding(insets.bottom, extraPadding) }} />;
}
