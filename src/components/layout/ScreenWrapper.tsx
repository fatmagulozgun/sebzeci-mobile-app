import React, { type ReactNode } from 'react';
import { ScrollView, type ScrollViewProps, StyleSheet, type ViewStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomSafePadding } from '../../theme/layout';

type ScreenWrapperProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  extraBottomPadding?: number;
  includeBottomPadding?: boolean;
  onTouchStart?: () => void;
};

export default function ScreenWrapper({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  extraBottomPadding = 0,
  includeBottomPadding = true,
  onTouchStart,
}: ScreenWrapperProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = includeBottomPadding ? getBottomSafePadding(insets.bottom, extraBottomPadding) : 0;

  if (!scroll) {
    return (
      <View style={[styles.viewWrap, { paddingBottom: bottomPadding }, style]} onTouchStart={onTouchStart}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onTouchStart={onTouchStart}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  viewWrap: {
    flex: 1,
  },
});
