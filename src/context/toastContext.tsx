import React, { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'info';
type ToastPosition = 'top' | 'center' | 'bottom';
type ToastOptions = {
  position?: ToastPosition;
};

type ToastState = {
  visible: boolean;
  message: string;
  type: ToastType;
  position: ToastPosition;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let globalToastHandler: ((message: string, type?: ToastType, options?: ToastOptions) => void) | null = null;

export const showAppToast = (message: string, type: ToastType = 'info', options?: ToastOptions) => {
  globalToastHandler?.(message, type, options);
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
    position: 'bottom',
  });
  const opacity = useRef(new Animated.Value(0)).current;

  const showToast = (message: string, type: ToastType = 'info', options?: ToastOptions) => {
    const messageLength = (message || '').trim().length;
    const computedVisibleMs = Math.min(5200, Math.max(1800, 1200 + messageLength * 45));

    setToast({
      visible: true,
      message,
      type,
      position: options?.position || 'bottom',
    });
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setToast(current => ({ ...current, visible: false }));
      });
    }, computedVisibleMs);
  };

  globalToastHandler = showToast;

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast.visible ? (
        <Animated.View
          style={[
            styles.toastWrap,
            toast.position === 'top' && styles.toastWrapTop,
            toast.position === 'center' && styles.toastWrapCenter,
            toast.position === 'bottom'
              ? {
                  bottom: Math.max(16, insets.bottom + (Platform.OS === 'android' ? 14 : 8)),
                }
              : null,
            { opacity },
          ]}
        >
          <View style={[styles.toast, toast.type === 'success' && styles.success, toast.type === 'error' && styles.error]}>
            <View style={styles.iconWrap}>
              {toast.type === 'success' ? (
                <CheckCircle2 size={16} color="#FFFFFF" />
              ) : toast.type === 'error' ? (
                <XCircle size={16} color="#FFFFFF" />
              ) : (
                <Info size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    zIndex: 9999,
  },
  toastWrapTop: {
    top: 22,
    bottom: undefined,
  },
  toastWrapCenter: {
    top: '50%',
    bottom: undefined,
    transform: [{ translateY: -24 }],
  },
  toast: {
    borderRadius: 12,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  success: {
    backgroundColor: '#166534',
  },
  error: {
    backgroundColor: '#B91C1C',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Roboto',
    flex: 1,
  },
  iconWrap: {
    width: 18,
    alignItems: 'center',
  },
});
