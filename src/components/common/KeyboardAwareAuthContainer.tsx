import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomSafePadding } from '../../theme/layout';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  extraBottomPadding?: number;
};

const KeyboardAwareAuthContainer = forwardRef<ScrollView, Props>(
  (
    {
      children,
      style,
      contentContainerStyle,
      keyboardVerticalOffset = Platform.OS === 'ios' ? 20 : 0,
      extraBottomPadding = Platform.OS === 'ios' ? 48 : 36,
    },
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const [keyboardInset, setKeyboardInset] = useState(0);

    useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const showListener = Keyboard.addListener(showEvent, event => {
        setKeyboardInset(event.endCoordinates?.height || 0);
      });
      const hideListener = Keyboard.addListener(hideEvent, () => {
        setKeyboardInset(0);
      });

      return () => {
        showListener.remove();
        hideListener.remove();
      };
    }, []);

    const mergedContentContainerStyle = useMemo(
      () => [
        contentContainerStyle,
        { paddingBottom: keyboardInset + getBottomSafePadding(insets.bottom, extraBottomPadding) },
      ],
      [contentContainerStyle, extraBottomPadding, insets.bottom, keyboardInset],
    );

    return (
      <KeyboardAvoidingView
        style={style}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          ref={ref}
          style={{ flex: 1 }}
          contentContainerStyle={mergedContentContainerStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  },
);

KeyboardAwareAuthContainer.displayName = 'KeyboardAwareAuthContainer';

export default KeyboardAwareAuthContainer;
