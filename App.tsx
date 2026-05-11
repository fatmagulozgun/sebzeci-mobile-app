import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastProvider } from './src/context/toastContext';
import { configureGoogleSignIn } from './src/services/googleSignInBootstrap';

export default function App() {
  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <RootNavigator />
      </ToastProvider>
    </SafeAreaProvider>
  );
}
