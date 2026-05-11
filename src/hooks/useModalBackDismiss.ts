import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Keyboard } from 'react-native';

type UseModalBackDismissParams = {
  enabled: boolean;
  onClose: () => void;
};

export default function useModalBackDismiss({ enabled, onClose }: UseModalBackDismissParams) {
  const onCloseRef = useRef(onClose);
  const isKeyboardVisibleRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      isKeyboardVisibleRef.current = true;
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      isKeyboardVisibleRef.current = false;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const backPressSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isKeyboardVisibleRef.current || Keyboard.isVisible?.()) {
        Keyboard.dismiss();
        return true;
      }

      return false;
    });

    return () => {
      backPressSubscription.remove();
    };
  }, [enabled]);

  const dismissKeyboardOrClose = useCallback(() => {
    if (isKeyboardVisibleRef.current || Keyboard.isVisible?.()) {
      Keyboard.dismiss();
      return;
    }

    onCloseRef.current();
  }, []);

  return { dismissKeyboardOrClose };
}
