import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { createDrawerNavigator, type DrawerContentComponentProps } from '@react-navigation/drawer';

import AdminAppNavbarLayout from '../components/layout/AdminAppNavbarLayout';
import AdminDrawer from '../components/admin/AdminDrawer';
import SettingsScreen from '../screens/app/SettingsScreen';
import AdminDashboardScreen from '../screens/app/AdminDashboardScreen';
import AdminProductsScreen from '../screens/app/AdminProductsScreen';
import AdminOrdersScreen from '../screens/app/AdminOrdersScreen';
import AdminCustomersScreen from '../screens/app/AdminCustomersScreen';
import OrderDetailScreen from '../screens/app/OrderDetailScreen';
import apiClient from '../services/apiClient';
import { setStoredUser } from '../services/authService';
import { getProfileImageForUser, setProfileImageForUser } from '../services/profileImageStore';
import { resolveDisplayName, resolveProfileImageUri } from '../utils/profile';
import { getAdminFixedAvatar } from '../utils/avatar';
import { useAuth } from '../context/authContext';

type AppUserContextValue = {
  userName: string;
  profileImageUri: string | null;
};

const Drawer = createDrawerNavigator();
const AppUserContext = React.createContext<AppUserContextValue>({
  userName: 'Kullanici',
  profileImageUri: null,
});

export default function AdminDrawerNavigator() {
  const adminFixedAvatar = getAdminFixedAvatar();
  const [userName, setUserName] = useState('Kullanici');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [todayNewOrdersCount, setTodayNewOrdersCount] = useState(0);
  const { user, signOut } = useAuth();

  const fetchTodayNewOrdersCount = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/orders');
      const orders = Array.isArray(data?.data) ? data.data : [];
      const now = new Date();
      const count = orders.filter((order: any) => {
        if (!order?.createdAt) return false;
        const createdAt = new Date(order.createdAt);
        if (Number.isNaN(createdAt.getTime())) return false;
        return (
          createdAt.getFullYear() === now.getFullYear() &&
          createdAt.getMonth() === now.getMonth() &&
          createdAt.getDate() === now.getDate()
        );
      }).length;
      setTodayNewOrdersCount(count);
    } catch {
      setTodayNewOrdersCount(0);
    }
  }, []);

  useEffect(() => {
    const hydrateUserData = async () => {
      if (!user) return;

      const roleCached = String(user?.role || '').toUpperCase();
      setUserName(roleCached === 'ADMIN' ? 'Hasan Özgün' : resolveDisplayName(user));
      setProfileImageUri(adminFixedAvatar);

      let resolvedUser = user;
      let serverUser: typeof user | null = null;
      try {
        const meResponse = await apiClient.get('/auth/me');
        serverUser = meResponse?.data?.data;
        if (serverUser) {
          resolvedUser = { ...user, ...serverUser };
          await setStoredUser(resolvedUser);
        }
      } catch {
      }

      const userKey = resolvedUser.id || resolvedUser.email;
      const localProfileImageDataUrl = await getProfileImageForUser(userKey);
      const userWithLocalImage = {
        ...resolvedUser,
        profileImageDataUrl: localProfileImageDataUrl || resolvedUser.profileImageDataUrl,
      };

      const displayUser = serverUser || resolvedUser;
      const role = String(displayUser?.role || '').toUpperCase();
      setUserName(role === 'ADMIN' ? 'Hasan Özgün' : resolveDisplayName(displayUser));
      const resolvedImageUri = resolveProfileImageUri(userWithLocalImage);
      setProfileImageUri(adminFixedAvatar);

      if (userKey) {
        await setProfileImageForUser(userKey, adminFixedAvatar || resolvedImageUri || null);
      }
    };

    hydrateUserData();
    fetchTodayNewOrdersCount();
  }, [fetchTodayNewOrdersCount, user]);

  const handleLogout = async () => {
    await signOut();
  };

  const handleUserProfileUpdated = (nextName: string) => {
    setUserName(nextName || 'Kullanici');
    setProfileImageUri(adminFixedAvatar);
  };

  const DrawerContent = (props: DrawerContentComponentProps) => {
    const { navigation, state } = props;
    const activeRoute = state.routeNames[state.index] || 'AdminDashboard';
    const navigationTyped = navigation as any;

    useEffect(() => {
      const unsubscribe = navigation.addListener('drawerOpen', () => {
        fetchTodayNewOrdersCount();
      });
      return unsubscribe;
    }, [navigation, fetchTodayNewOrdersCount]);

    const handleLogoutPress = async () => {
      await handleLogout();
    };

    return (
      <View style={styles.drawerContainer}>
        <AdminDrawer
          userName={userName}
          todayNewOrdersCount={todayNewOrdersCount}
          activeRoute={activeRoute}
          onDashboardPress={() => {
            navigationTyped.navigate('AdminDashboard');
            navigationTyped.closeDrawer();
          }}
          onProductsPress={() => {
            navigationTyped.navigate('AdminProducts');
            navigationTyped.closeDrawer();
          }}
          onOrdersPress={() => {
            navigationTyped.navigate('AdminOrders');
            navigationTyped.closeDrawer();
          }}
          onCustomersPress={() => {
            navigationTyped.navigate('AdminCustomers');
            navigationTyped.closeDrawer();
          }}
          onSettingsPress={() => {
            navigationTyped.navigate('Settings');
            navigationTyped.closeDrawer();
          }}
          onClose={() => navigationTyped.closeDrawer()}
          onLogoutPress={handleLogoutPress}
        />
      </View>
    );
  };

  function DashboardRouteScreen() {
    const { userName: uName, profileImageUri: pUri } = React.useContext(AppUserContext);
    return (
      <AdminAppNavbarLayout
        userName={uName}
        profileImageUri={pUri}
        cartItemCount={0}
        onCartPress={() => {}}
        useScrollContainer={false}
      >
        <AdminDashboardScreen userName={uName} />
      </AdminAppNavbarLayout>
    );
  }

  function AdminProductsRouteScreen() {
    const { userName: uName, profileImageUri: pUri } = React.useContext(AppUserContext);
    return (
      <AdminAppNavbarLayout
        userName={uName}
        profileImageUri={pUri}
        cartItemCount={0}
        onCartPress={() => {}}
        useScrollContainer={false}
      >
        <AdminProductsScreen />
      </AdminAppNavbarLayout>
    );
  }

  function AdminOrdersRouteScreen() {
    const { userName: uName, profileImageUri: pUri } = React.useContext(AppUserContext);
    return (
      <AdminAppNavbarLayout
        userName={uName}
        profileImageUri={pUri}
        cartItemCount={0}
        onCartPress={() => {}}
        useScrollContainer={false}
      >
        <AdminOrdersScreen />
      </AdminAppNavbarLayout>
    );
  }

  function AdminOrderDetailRouteScreen(props: any) {
    const { userName: uName, profileImageUri: pUri } = React.useContext(AppUserContext);
    return (
      <AdminAppNavbarLayout userName={uName} profileImageUri={pUri} cartItemCount={0} onCartPress={() => {}}>
        <OrderDetailScreen route={props.route} canUpdateStatus />
      </AdminAppNavbarLayout>
    );
  }

  function AdminCustomersRouteScreen() {
    const { userName: uName, profileImageUri: pUri } = React.useContext(AppUserContext);
    return (
      <AdminAppNavbarLayout userName={uName} profileImageUri={pUri} cartItemCount={0} onCartPress={() => {}}>
        <AdminCustomersScreen />
      </AdminAppNavbarLayout>
    );
  }

  function SettingsRouteScreen() {
    const { userName: uName, profileImageUri: pUri } = React.useContext(AppUserContext);
    return (
      <AdminAppNavbarLayout userName={uName} profileImageUri={pUri} cartItemCount={0} onCartPress={() => {}}>
        <SettingsScreen userName={uName} profileImageUri={pUri} onUserProfileUpdated={handleUserProfileUpdated} />
      </AdminAppNavbarLayout>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AppUserContext.Provider value={{ userName, profileImageUri }}>
        <Drawer.Navigator
          screenOptions={{
            headerShown: false,
            drawerType: 'front',
            overlayColor: 'rgba(15, 23, 42, 0.5)',
            swipeEnabled: true,
            drawerStyle: { width: '70%' },
          }}
          drawerContent={props => <DrawerContent {...props} />}
        >
          <Drawer.Screen name="AdminDashboard" component={DashboardRouteScreen} />
          <Drawer.Screen name="AdminProducts" component={AdminProductsRouteScreen} />
          <Drawer.Screen name="AdminOrders" component={AdminOrdersRouteScreen} />
          <Drawer.Screen name="AdminOrderDetail" component={AdminOrderDetailRouteScreen} />
          <Drawer.Screen name="AdminCustomers" component={AdminCustomersRouteScreen} />
          <Drawer.Screen name="Settings" component={SettingsRouteScreen} />
        </Drawer.Navigator>
      </AppUserContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
  },
  placeholderWrap: {
    flex: 1,
    padding: 18,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Roboto',
    color: '#111827',
  },
});

