import React, { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { CommonActions, useNavigation, useNavigationState } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeHeader } from '../home';
import { useAuth } from '../../context/authContext';
import apiClient from '../../services/apiClient';
import ScreenWrapper from './ScreenWrapper';
import { SCREEN_HORIZONTAL_PADDING } from '../../theme/layout';
import { formatRelativeTime } from '../../utils/dateTime';

const READ_NOTIFICATIONS_KEY = 'admin_mobile_read_notifications_v1';
const ADMIN_NOTIFICATION_SETTINGS_KEY = 'admin_mobile_notification_settings_v1';

type NotificationSettings = {
  notifyNewOrder: boolean;
  notifyLowStock: boolean;
  notifyNewCustomer: boolean;
};

const defaultNotificationSettings: NotificationSettings = {
  notifyNewOrder: true,
  notifyLowStock: true,
  notifyNewCustomer: true,
};

type NotificationItem = {
  id: string;
  title: string;
  meta: string;
  isRead: boolean;
  type?: string;
  severity?: string;
  status?: string;
};

const getAdminPageTitle = (routeName?: string) => {
  if (routeName === 'AdminDashboard') return 'Kontrol Paneli';
  if (routeName === 'AdminProducts') return 'Ürün Yönetimi';
  if (routeName === 'AdminOrders') return 'Siparişler';
  if (routeName === 'AdminOrderDetail') return 'Sipariş Detayı';
  if (routeName === 'AdminCustomers') return 'Müşteriler';
  if (routeName === 'Settings') return 'Ayarlar';
  return 'Yönetim';
};

type Props = {
  userName: string;
  profileImageUri: string | null;
  cartItemCount: number;
  onCartPress: () => void;
  useScrollContainer?: boolean;
  children: ReactNode;
};

export default function AdminAppNavbarLayout({
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
  const pageTitle = getAdminPageTitle(currentRouteName);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(defaultNotificationSettings);

  const loadReadIdsFromStorage = React.useCallback(async () => {
    try {
      const rawIds = await AsyncStorage.getItem(READ_NOTIFICATIONS_KEY);
      const parsed = rawIds ? JSON.parse(rawIds) : [];
      setReadIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReadIds([]);
    }
  }, []);

  const loadNotificationSettings = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ADMIN_NOTIFICATION_SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      setNotificationSettings({
        notifyNewOrder: parsed?.notifyNewOrder ?? defaultNotificationSettings.notifyNewOrder,
        notifyLowStock: parsed?.notifyLowStock ?? defaultNotificationSettings.notifyLowStock,
        notifyNewCustomer: parsed?.notifyNewCustomer ?? defaultNotificationSettings.notifyNewCustomer,
      });
    } catch {
      setNotificationSettings(defaultNotificationSettings);
    }
  }, []);

  useEffect(() => {
    loadReadIdsFromStorage();
    loadNotificationSettings();
  }, [loadNotificationSettings, loadReadIdsFromStorage]);

  useEffect(() => {
    let mounted = true;

    const fetchNotifications = async () => {
      try {
        const { data } = await apiClient.get('/admin/notifications');
        if (!mounted) return;

        const raw = Array.isArray(data?.data) ? data.data : [];
        const filtered = raw.filter((n: any) => {
          const normalizedType = String(n.type || '').toUpperCase();
          if (normalizedType === 'ORDER' && !notificationSettings.notifyNewOrder) return false;
          if (normalizedType === 'STOCK' && !notificationSettings.notifyLowStock) return false;
          if (normalizedType === 'CUSTOMER' && !notificationSettings.notifyNewCustomer) return false;
          return true;
        });

        const mapped: NotificationItem[] = filtered.slice(0, 5).map((n: any) => {
          const id = String(n.id || '');
          const relative = formatRelativeTime(n.createdAt || null) || 'az once';

          return {
            id,
            title: n.title || 'Bildirim',
            meta: `${n.subtitle || '-'} • ${relative}`,
            isRead: readIds.includes(id),
            type: String(n.type || '').toUpperCase(),
            severity: n.severity,
            status: n.severity ? String(n.severity).toUpperCase() : undefined,
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
  }, [readIds, notificationSettings]);

  const closeHeaderMenus = () => {
    setIsNotificationOpen(false);
    setIsProfileMenuOpen(false);
  };

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', closeHeaderMenus);
    const unsubscribeFocus = navigation.addListener('focus', () => {
      closeHeaderMenus();
      loadReadIdsFromStorage();
      loadNotificationSettings();
    });

    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
    };
  }, [loadNotificationSettings, loadReadIdsFromStorage, navigation]);

  const handleLogout = async () => {
    await signOut();
    closeHeaderMenus();
  };

  const handleMarkAllNotificationsRead = async () => {
    const allIds = notifications.map(item => item.id);
    const mergedReadIds = Array.from(new Set([...readIds, ...allIds]));

    setReadIds(mergedReadIds);
    setNotifications(current => current.map(item => ({ ...item, isRead: true })));

    try {
      await AsyncStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(mergedReadIds));
    } catch {
    }
  };

  const handleNotificationItemPress = async (notificationId: string) => {
    const clickedNotification = notifications.find(item => item.id === notificationId);
    const next = Array.from(new Set([...readIds, notificationId]));
    setReadIds(next);
    setNotifications(current => current.map(item => (item.id === notificationId ? { ...item, isRead: true } : item)));
    setIsNotificationOpen(false);

    try {
      await AsyncStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(next));
    } catch {
    }

    const notificationType = String(clickedNotification?.type || '').toUpperCase();
    if (notificationType === 'ORDER') {
      navigation.navigate('AdminOrders');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar translucent={false} backgroundColor="#F7F7F7" barStyle="dark-content" />
      <View style={styles.contentWrap}>
        {isNotificationOpen || isProfileMenuOpen ? (
          <Pressable style={styles.dismissOverlay} onPress={closeHeaderMenus} />
        ) : null}

        <HomeHeader
          userName={userName}
          profileImageUri={profileImageUri}
          pageTitle={pageTitle}
          cartItemCount={cartItemCount}
          showCart={false}
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
            navigation.navigate('AdminOrders');
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

