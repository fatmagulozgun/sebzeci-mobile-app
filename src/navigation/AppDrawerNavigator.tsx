import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createDrawerNavigator, type DrawerContentComponentProps } from '@react-navigation/drawer';
import AppDrawer from '../components/home/AppDrawer';
import AppNavbarLayout from '../components/layout/AppNavbarLayout';
import HomeScreen from '../screens/app/HomeScreen';
import ProductsScreen from '../screens/app/ProductsScreen';
import CartScreen from '../screens/app/CartScreen';
import OrdersScreen from '../screens/app/OrdersScreen';
import OrderDetailScreen from '../screens/app/OrderDetailScreen';
import SettingsScreen from '../screens/app/SettingsScreen';
import apiClient from '../services/apiClient';
import { setStoredUser } from '../services/authService';
import { getProfileImageForUser, setProfileImageForUser } from '../services/profileImageStore';
import { resolveDisplayName, resolveProfileImageUri } from '../utils/profile';
import { getAssignedAvatar } from '../utils/avatar';
import { CartProvider, useCart } from '../context/cartContext';
import { useAuth } from '../context/authContext';

const Drawer = createDrawerNavigator();
const AppUserContext = React.createContext<{
  userName: string;
  profileImageUri: string | null;
  onUserProfileUpdated: (nextName: string, nextImageUri: string | null) => void;
}>({
  userName: 'Kullanici',
  profileImageUri: null,
  onUserProfileUpdated: () => undefined,
});

function HomeRouteScreen() {
  const { userName, profileImageUri } = React.useContext(AppUserContext);
  const { itemCount } = useCart();
  const navigation = useNavigation<any>();

  return (
    <AppNavbarLayout
      userName={userName}
      profileImageUri={profileImageUri}
      cartItemCount={itemCount}
      onCartPress={() => navigation?.navigate?.('Cart')}
      useScrollContainer={false}
    >
      <HomeScreen userName={userName} profileImageUri={profileImageUri} />
    </AppNavbarLayout>
  );
}

function ProductsRouteScreen() {
  const { userName, profileImageUri } = React.useContext(AppUserContext);
  const { itemCount } = useCart();
  const navigation = useNavigation<any>();

  return (
    <AppNavbarLayout
      userName={userName}
      profileImageUri={profileImageUri}
      cartItemCount={itemCount}
      onCartPress={() => navigation?.navigate?.('Cart')}
      useScrollContainer={false}
    >
      <ProductsScreen />
    </AppNavbarLayout>
  );
}

function CartRouteScreen() {
  const { userName, profileImageUri } = React.useContext(AppUserContext);
  const { itemCount } = useCart();
  const navigation = useNavigation<any>();

  return (
    <AppNavbarLayout
      userName={userName}
      profileImageUri={profileImageUri}
      cartItemCount={itemCount}
      onCartPress={() => navigation?.navigate?.('Cart')}
    >
      <CartScreen />
    </AppNavbarLayout>
  );
}

function OrdersRouteScreen() {
  const { userName, profileImageUri } = React.useContext(AppUserContext);
  const { itemCount } = useCart();
  const navigation = useNavigation<any>();

  return (
    <AppNavbarLayout
      userName={userName}
      profileImageUri={profileImageUri}
      cartItemCount={itemCount}
      onCartPress={() => navigation?.navigate?.('Cart')}
      useScrollContainer={false}
    >
      <OrdersScreen />
    </AppNavbarLayout>
  );
}

function OrderDetailRouteScreen(props: any) {
  const { userName, profileImageUri } = React.useContext(AppUserContext);
  const { itemCount } = useCart();
  const navigation = useNavigation<any>();

  return (
    <AppNavbarLayout
      userName={userName}
      profileImageUri={profileImageUri}
      cartItemCount={itemCount}
      onCartPress={() => navigation?.navigate?.('Cart')}
    >
      <OrderDetailScreen route={props.route} canUpdateStatus={false} />
    </AppNavbarLayout>
  );
}

function SettingsRouteScreen() {
  const { userName, profileImageUri, onUserProfileUpdated } = React.useContext(AppUserContext);
  const { itemCount } = useCart();
  const navigation = useNavigation<any>();

  return (
    <AppNavbarLayout
      userName={userName}
      profileImageUri={profileImageUri}
      cartItemCount={itemCount}
      onCartPress={() => navigation?.navigate?.('Cart')}
    >
      <SettingsScreen userName={userName} profileImageUri={profileImageUri} onUserProfileUpdated={onUserProfileUpdated} />
    </AppNavbarLayout>
  );
}

function DrawerContent(props: DrawerContentComponentProps & { userName: string }) {
  const { navigation, state } = props;
  const { itemCount } = useCart();
  const activeRoute = state.routeNames[state.index] || 'Home';
  const { signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    navigation.closeDrawer();
    try {
      await signOut();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={styles.drawerContainer}>
      <AppDrawer
        userName={props.userName}
        cartItemCount={itemCount}
        activeRoute={activeRoute}
        onHomePress={() => navigation.navigate('Home')}
        onProductsPress={() => navigation.navigate('Products')}
        onCartPress={() => navigation.navigate('Cart')}
        onOrdersPress={() => navigation.navigate('Orders')}
        onSettingsPress={() => navigation.navigate('Settings')}
        onClose={() => navigation.closeDrawer()}
        onLogoutPress={handleLogout}
        isLoggingOut={isLoggingOut}
      />
    </View>
  );
}

export default function AppDrawerNavigator() {
  const [userName, setUserName] = useState('Kullanici');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const { user } = useAuth();

  const handleUserProfileUpdated = (nextName: string, nextImageUri: string | null) => {
    setUserName(nextName || 'Kullanici');
    setProfileImageUri(nextImageUri || null);
  };

  useEffect(() => {
    const hydrateUserData = async () => {
      if (!user) {
        return;
      }

      setUserName(resolveDisplayName(user));
      const cachedAvatar = resolveProfileImageUri(user) || getAssignedAvatar(user);
      setProfileImageUri(cachedAvatar || null);

      let resolvedUser = user;
      try {
        const meResponse = await apiClient.get('/auth/me');
        const serverUser = meResponse?.data?.data;
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

      setUserName(resolveDisplayName(resolvedUser));
      const resolvedImageUri = resolveProfileImageUri(userWithLocalImage) || getAssignedAvatar(userWithLocalImage);
      setProfileImageUri(resolvedImageUri || null);

      if (userKey && resolvedImageUri) {
        await setProfileImageForUser(userKey, resolvedImageUri);
      }
    };

    hydrateUserData();
  }, [user]);

  return (
    <CartProvider>
      <AppUserContext.Provider value={{ userName, profileImageUri, onUserProfileUpdated: handleUserProfileUpdated }}>
        <Drawer.Navigator
          screenOptions={{
            headerShown: false,
            drawerType: 'front',
            overlayColor: 'rgba(15, 23, 42, 0.5)',
            swipeEnabled: true,
            drawerStyle: {
              width: '70%',
            },
          }}
          drawerContent={props => <DrawerContent {...props} userName={userName} />}
        >
          <Drawer.Screen name="Home" component={HomeRouteScreen} />
          <Drawer.Screen name="Products" component={ProductsRouteScreen} />
          <Drawer.Screen name="Cart" component={CartRouteScreen} />
          <Drawer.Screen name="Orders" component={OrdersRouteScreen} />
          <Drawer.Screen name="OrderDetail" component={OrderDetailRouteScreen} />
          <Drawer.Screen name="Settings" component={SettingsRouteScreen} />
        </Drawer.Navigator>
      </AppUserContext.Provider>
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
  },
});
