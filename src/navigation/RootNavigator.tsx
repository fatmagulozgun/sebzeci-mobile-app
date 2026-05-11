import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CommonActions, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import LoginScreen from '../screens/auth/LoginScreen';
import AppDrawerNavigator from './AppDrawerNavigator';
import AdminDrawerNavigator from './AdminDrawerNavigator';
import { AuthProvider, useAuth } from '../context/authContext';

const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const CustomerStack = createNativeStackNavigator();
const AdminStack = createNativeStackNavigator();

type AuthView = 'guest' | 'customer' | 'admin';
type RootRouteName = 'Splash' | 'AuthStack' | 'AppStack' | 'AdminStack';
type RootView = AuthView | 'splash';
const navigationRef = createNavigationContainerRef();

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function CustomerStackNavigator() {
  return (
    <CustomerStack.Navigator screenOptions={{ headerShown: false }}>
      <CustomerStack.Screen name="CustomerHome" component={AppDrawerNavigator} />
    </CustomerStack.Navigator>
  );
}

function AdminStackNavigator() {
  return (
    <AdminStack.Navigator screenOptions={{ headerShown: false }}>
      <AdminStack.Screen name="AdminDashboard" component={AdminDrawerNavigator} />
    </AdminStack.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={styles.loadingContainer}>
      <View style={styles.splashMark}>
        <Text style={styles.splashMarkText}>S</Text>
      </View>
      <Text style={styles.splashTitle}>Sebzeci</Text>
      <ActivityIndicator size="small" color="#15803d" />
    </View>
  );
}

function ProtectedRootStack() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'none',
        contentStyle: styles.sceneWrap,
      }}
    >
      <RootStack.Screen name="Splash" component={SplashScreen} />
      <RootStack.Screen name="AuthStack" component={AuthStackNavigator} />
      <RootStack.Screen name="AppStack" component={CustomerStackNavigator} />
      <RootStack.Screen name="AdminStack" component={AdminStackNavigator} />
    </RootStack.Navigator>
  );
}

function resolveViewKey({
  status,
  user,
  isInitializing,
  isRestoringSession,
  authResolved,
}: {
  status: string;
  user: { role?: string } | null;
  isInitializing: boolean;
  isRestoringSession: boolean;
  authResolved: boolean;
}): RootView {
  if (isInitializing || isRestoringSession || !authResolved || status === 'loading') {
    return 'splash';
  }
  if (status !== 'authenticated') {
    return 'guest';
  }
  return String(user?.role || '').toUpperCase() === 'ADMIN' ? 'admin' : 'customer';
}

function mapViewToRoute(view: RootView): RootRouteName {
  if (view === 'guest') return 'AuthStack';
  if (view === 'customer') return 'AppStack';
  if (view === 'admin') return 'AdminStack';
  return 'Splash';
}

function RootNavigation() {
  const { status, user, isInitializing, isRestoringSession, authResolved } = useAuth();
  const targetView = useMemo(
    () => resolveViewKey({ status, user, isInitializing, isRestoringSession, authResolved }),
    [status, user, isInitializing, isRestoringSession, authResolved],
  );
  const [isNavReady, setIsNavReady] = useState(false);
  const [activeRouteName, setActiveRouteName] = useState<RootRouteName>('Splash');
  const transitionKeyRef = useRef(0);

  useEffect(() => {
    if (!isNavReady || !navigationRef.isReady()) return;
    const nextRoute = mapViewToRoute(targetView);
    if (nextRoute === activeRouteName) return;
    transitionKeyRef.current += 1;
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: nextRoute, key: `${nextRoute}-${transitionKeyRef.current}` }],
      }),
    );
    setActiveRouteName(nextRoute);
  }, [targetView, isNavReady, activeRouteName]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        const firstRoute = mapViewToRoute(targetView);
        setIsNavReady(true);
        setActiveRouteName(firstRoute);
        navigationRef.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: firstRoute, key: `${firstRoute}-initial` }],
          }),
        );
      }}
    >
      <ProtectedRootStack />
    </NavigationContainer>
  );
}

export default function RootNavigator() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f8f4',
    gap: 14,
  },
  sceneWrap: {
    flex: 1,
    backgroundColor: '#f4f8f4',
  },
  splashMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#15803d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashMarkText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  splashTitle: {
    color: '#14532d',
    fontSize: 18,
    fontWeight: '700',
  },
});
