import React, { useState, type ReactNode } from 'react';
import { Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { CommonActions, useNavigation, useNavigationState } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeHeader } from '../home';
import { useAuth } from '../../context/authContext';
import apiClient from '../../services/apiClient';
import ScreenWrapper from './ScreenWrapper';
import { SCREEN_HORIZONTAL_PADDING } from '../../theme/layout';
import { formatRelativeTime, getDateTimestamp } from '../../utils/dateTime';

const READ_NOTIFICATIONS_KEY = 'customer_mobile_read_notifications_v1';
const READ_NOTIFICATIONS_LAST_SEEN_AT_KEY = 'customer_mobile_notifications_last_seen_at_v1';
const CUSTOMER_NOTIFICATION_SETTINGS_KEY = 'customer_mobile_notification_settings_v1';

type CustomerNotificationSettings = {
  notifyPreparingOrders: boolean;
  notifyDeliveryUpdates: boolean;
  notifyCancelledOrders: boolean;
};

const defaultCustomerNotificationSettings: CustomerNotificationSettings = {
  notifyPreparingOrders: true,
  notifyDeliveryUpdates: true,
  notifyCancelledOrders: true,
};

type NotificationItem = {
  id: string;
  orderId: string;
  title: string;
  meta: string;
  status?: string;
  type?: 'ORDER' | 'SYSTEM';
  isRead: boolean;
};

const statusLabel = (status?: string) => {
  if (status === 'PENDING') return 'Bekliyor';
  if (status === 'PREPARING') return 'Hazirlaniyor';
  if (status === 'DELIVERED') return 'Teslim edildi';
  if (status === 'CANCELLED') return 'Iptal edildi';
  return status || '-';
};

const getCustomerPageTitle = (routeName?: string) => {
  if (routeName === 'Home') return 'Ana Sayfa';
  if (routeName === 'Products') return 'Ürünler';
  if (routeName === 'Cart') return 'Sepet';
  if (routeName === 'Orders') return 'Siparişlerim';
  if (routeName === 'OrderDetail') return 'Sipariş Detayı';
  if (routeName === 'Settings') return 'Ayarlar';
  return 'Sebzeci';
};

type Props = {
  userName: string;
  profileImageUri: string | null;
  cartItemCount: number;
  onCartPress: () => void;
  useScrollContainer?: boolean;
  children: ReactNode;
};

export default function AppNavbarLayout({
  userName,
  profileImageUri,
  cartItemCount,
  onCartPress,
  useScrollContainer = true,
  children,
}: Props) {
  const navigation = useNavigation<any>();
  const { signOut } = useAuth();
  const currentRouteName = useNavigationState(state => state.routes[state.index]?.name);
  const pageTitle = getCustomerPageTitle(currentRouteName);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<number>(0);
  const [notificationSettings, setNotificationSettings] = useState<CustomerNotificationSettings>(
    defaultCustomerNotificationSettings,
  );

  const shouldIncludeOrderStatus = React.useCallback(
    (status?: string) => {
      if (status === 'CANCELLED') return notificationSettings.notifyCancelledOrders;
      if (status === 'SHIPPED' || status === 'DELIVERED') return notificationSettings.notifyDeliveryUpdates;
      return notificationSettings.notifyPreparingOrders;
    },
    [notificationSettings],
  );

  const loadReadIdsFromStorage = React.useCallback(async () => {
    try {
      const [rawIds, rawLastSeenAt] = await Promise.all([
        AsyncStorage.getItem(READ_NOTIFICATIONS_KEY),
        AsyncStorage.getItem(READ_NOTIFICATIONS_LAST_SEEN_AT_KEY),
      ]);
      const parsed = rawIds ? JSON.parse(rawIds) : [];
      const parsedLastSeenAt = Number(rawLastSeenAt || 0);
      setReadIds(Array.isArray(parsed) ? parsed : []);
      setLastSeenAt(Number.isFinite(parsedLastSeenAt) ? parsedLastSeenAt : 0);
    } catch {
      setReadIds([]);
      setLastSeenAt(0);
    }
  }, []);

  React.useEffect(() => {
    loadReadIdsFromStorage();
  }, [loadReadIdsFromStorage]);

  React.useEffect(() => {
    const loadCustomerNotificationSettings = async () => {
      try {
        const raw = await AsyncStorage.getItem(CUSTOMER_NOTIFICATION_SETTINGS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        setNotificationSettings({
          notifyPreparingOrders: parsed?.notifyPreparingOrders ?? defaultCustomerNotificationSettings.notifyPreparingOrders,
          notifyDeliveryUpdates: parsed?.notifyDeliveryUpdates ?? defaultCustomerNotificationSettings.notifyDeliveryUpdates,
          notifyCancelledOrders: parsed?.notifyCancelledOrders ?? defaultCustomerNotificationSettings.notifyCancelledOrders,
        });
      } catch {
        setNotificationSettings(defaultCustomerNotificationSettings);
      }
    };
    loadCustomerNotificationSettings();
  }, []);

  React.useEffect(() => {
    let mounted = true;
    const fetchNotifications = async () => {
      try {
        const { data } = await apiClient.get('/orders');
        if (!mounted) return;
        const orders = Array.isArray(data?.data) ? data.data : [];
        const mapped: NotificationItem[] = orders
          .filter((order: any) => shouldIncludeOrderStatus(order.status))
          .slice(0, 20)
          .map((order: any) => {
          const id = String(order.id || '');
          const orderTimestamp = getDateTimestamp(order.updatedAt || order.createdAt || null);
          const readByTimestamp = Number.isFinite(orderTimestamp) && orderTimestamp > 0 && orderTimestamp <= lastSeenAt;
          const relative = formatRelativeTime(order.updatedAt || order.createdAt) || 'az once';
          return {
            id,
            orderId: id,
            title: `Sipariş #${id.slice(0, 4)}`,
            meta: `${Number(order.totalPrice || 0).toFixed(2)} TL • ${relative}`,
            status: statusLabel(order.status),
            type: 'ORDER',
            isRead: readIds.includes(id) || readByTimestamp,
          };
          });
        setNotifications(mapped);
      } catch {
        if (!mounted) return;
        setNotifications([]);
      }
    };

    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 10000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [lastSeenAt, readIds, shouldIncludeOrderStatus]);

  const closeHeaderMenus = () => {
    setIsNotificationOpen(false);
    setIsProfileMenuOpen(false);
  };

  React.useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', closeHeaderMenus);
    const unsubscribeFocus = navigation.addListener('focus', () => {
      closeHeaderMenus();
      loadReadIdsFromStorage();
      AsyncStorage.getItem(CUSTOMER_NOTIFICATION_SETTINGS_KEY)
        .then(raw => {
          const parsed = raw ? JSON.parse(raw) : null;
          setNotificationSettings({
            notifyPreparingOrders:
              parsed?.notifyPreparingOrders ?? defaultCustomerNotificationSettings.notifyPreparingOrders,
            notifyDeliveryUpdates:
              parsed?.notifyDeliveryUpdates ?? defaultCustomerNotificationSettings.notifyDeliveryUpdates,
            notifyCancelledOrders:
              parsed?.notifyCancelledOrders ?? defaultCustomerNotificationSettings.notifyCancelledOrders,
          });
        })
        .catch(() => {
          setNotificationSettings(defaultCustomerNotificationSettings);
        });
    });
    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
    };
  }, [loadReadIdsFromStorage, navigation]);

  const handleLogout = async () => {
    await signOut();
    closeHeaderMenus();
  };

  const handleMarkAllNotificationsRead = async () => {
    const allIds = notifications.map(item => item.id);
    const mergedReadIds = Array.from(new Set([...readIds, ...allIds]));
    const nextLastSeenAt = Date.now();
    setReadIds(mergedReadIds);
    setLastSeenAt(nextLastSeenAt);
    setNotifications(current => current.map(item => ({ ...item, isRead: true })));
    try {
      await Promise.all([
        AsyncStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(mergedReadIds)),
        AsyncStorage.setItem(READ_NOTIFICATIONS_LAST_SEEN_AT_KEY, String(nextLastSeenAt)),
      ]);
    } catch {
    }
  };

  const handleNotificationItemPress = async (notificationId: string) => {
    const next = Array.from(new Set([...readIds, notificationId]));
    setReadIds(next);
    setNotifications(current => current.map(item => (item.id === notificationId ? { ...item, isRead: true } : item)));
    try {
      await AsyncStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(next));
    } catch {
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar translucent={false} backgroundColor="#F7F7F7" barStyle="dark-content" />
      <View style={styles.contentWrap}>
        {(isNotificationOpen || isProfileMenuOpen) ? <Pressable style={styles.dismissOverlay} onPress={closeHeaderMenus} /> : null}
        <HomeHeader
          userName={userName}
          profileImageUri={profileImageUri}
          pageTitle={pageTitle}
          cartItemCount={cartItemCount}
          hideProfileName
          compactHeaderRight
          isNotificationOpen={isNotificationOpen}
          isProfileMenuOpen={isProfileMenuOpen}
          onMenuPress={() => navigation.openDrawer()}
          onCartPress={onCartPress}
          onNotificationPress={() => {
            setIsProfileMenuOpen(false);
            setIsNotificationOpen(current => !current);
          }}
          onProfilePress={() => {
            setIsNotificationOpen(false);
            setIsProfileMenuOpen(current => !current);
          }}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          notifications={notifications}
          onNotificationItemPress={handleNotificationItemPress}
          onViewAllNotificationsPress={() => {
            setIsNotificationOpen(false);
            navigation.navigate('Orders');
          }}
          onSettingsPress={() => {
            setIsProfileMenuOpen(false);
            navigation.navigate('Settings');
          }}
          onLogoutPress={handleLogout}
        />
        {useScrollContainer ? (
          <ScreenWrapper
            scroll
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            onTouchStart={() => {
              if (isNotificationOpen || isProfileMenuOpen) {
                closeHeaderMenus();
              }
            }}
          >
            {children}
          </ScreenWrapper>
        ) : (
          <ScreenWrapper
            scroll={false}
            includeBottomPadding={false}
            style={styles.nonScrollContent}
            onTouchStart={() => {
              if (isNotificationOpen || isProfileMenuOpen) {
                closeHeaderMenus();
              }
            }}
          >
            {children}
          </ScreenWrapper>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    overflow: 'visible',
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 12,
    overflow: 'visible',
    zIndex: 5,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  nonScrollContent: {
    flex: 1,
  },
});
