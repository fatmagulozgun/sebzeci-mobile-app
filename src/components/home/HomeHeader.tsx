import React from 'react';
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCheck,
  Info,
  Menu,
  Package,
  ShoppingCart,
  UserCircle2,
  Users,
} from 'lucide-react-native';
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

type Props = {
  userName: string;
  profileImageUri: string | null;
  pageTitle?: string;
  cartItemCount: number;
  showCart?: boolean;
  hideProfileName?: boolean;
  compactHeaderRight?: boolean;
  isNotificationOpen: boolean;
  isProfileMenuOpen: boolean;
  onMenuPress: () => void;
  onCartPress: () => void;
  onNotificationPress: () => void;
  onProfilePress: () => void;
  onMarkAllNotificationsRead: () => void;
  notifications: Array<{
    id: string;
    title: string;
    meta: string;
    isRead: boolean;
    status?: string;
    type?: string;
  }>;
  onNotificationItemPress: (notificationId: string) => void;
  onViewAllNotificationsPress: () => void;
  onSettingsPress: () => void;
  onLogoutPress: () => void;
};

const HEADER_HEIGHT = 44;

export default function HomeHeader({
  userName,
  profileImageUri,
  pageTitle,
  cartItemCount,
  showCart = true,
  hideProfileName = false,
  compactHeaderRight = false,
  isNotificationOpen,
  isProfileMenuOpen,
  onMenuPress,
  onCartPress,
  onNotificationPress,
  onProfilePress,
  onMarkAllNotificationsRead,
  notifications,
  onNotificationItemPress,
  onViewAllNotificationsPress,
  onSettingsPress,
  onLogoutPress,
}: Props) {
  const { width, height } = useWindowDimensions();
  const showProfileName = !hideProfileName && width >= 380;
  const unreadCount = notifications.filter(item => !item.isRead).length;
  const [profileTriggerWidth, setProfileTriggerWidth] = React.useState(44);
  const [headerWidth, setHeaderWidth] = React.useState(width);
  const notificationPanelMaxHeight = Math.min(400, Math.max(280, height - 150));
  const notificationPanelWidth = Math.min(340, Math.max(280, width - 24));
  const menuAnimation = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(menuAnimation, {
      toValue: isNotificationOpen ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isNotificationOpen, menuAnimation]);

  const getStatusColor = (status?: string) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized.includes('BEKLIYOR') || normalized.includes('PENDING')) return '#C2410C';
    if (normalized.includes('TESLIM') || normalized.includes('DELIVERED')) return '#15803D';
    if (normalized.includes('IPTAL') || normalized.includes('CANCELLED')) return '#DC2626';
    if (normalized.includes('PREPARING') || normalized.includes('HAZIRLANIYOR')) return '#2563EB';
    return '#4B5563';
  };

  const localizeStatusText = (status?: string) => {
    const raw = String(status || '').trim();
    if (!raw) return '';
    const normalized = raw.toUpperCase();
    if (normalized.includes('CRITICAL')) return 'Kritik';
    if (normalized.includes('PENDING') || normalized.includes('BEKLIYOR')) return 'Bekliyor';
    if (normalized.includes('PREPARING') || normalized.includes('HAZIRLANIYOR')) return 'Hazırlanıyor';
    if (normalized.includes('SHIPPED')) return 'Yolda';
    if (normalized.includes('DELIVERED') || normalized.includes('TESLIM')) return 'Teslim Edildi';
    if (normalized.includes('CANCELLED') || normalized.includes('IPTAL')) return 'İptal Edildi';
    if (normalized.includes('OTHER')) return 'Diğer';
    return raw;
  };

  const localizeMetaText = (meta?: string) => {
    const raw = String(meta || '');
    if (!raw) return '';
    return raw
      .replace(/\bCRITICAL\b/gi, 'Kritik')
      .replace(/\bPENDING\b/gi, 'Bekliyor')
      .replace(/\bPREPARING\b/gi, 'Hazırlanıyor')
      .replace(/\bSHIPPED\b/gi, 'Yolda')
      .replace(/\bDELIVERED\b/gi, 'Teslim Edildi')
      .replace(/\bCANCELLED\b/gi, 'İptal Edildi')
      .replace(/\bOTHER\b/gi, 'Diğer');
  };

  const isCompletedStatus = (status?: string) => {
    const normalized = String(status || '').toUpperCase();
    return normalized.includes('TESLIM') || normalized.includes('DELIVERED');
  };

  const renderNotificationIcon = (type?: string) => {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'ORDER') return <Package size={16} color="#16A34A" />;
    if (normalized === 'STOCK') return <AlertCircle size={16} color="#EA580C" />;
    if (normalized === 'CUSTOMER') return <Users size={16} color="#16A34A" />;
    return <Info size={16} color="#6B7280" />;
  };

  return (
    <View style={styles.safeArea}>
      <View
        style={styles.header}
        onLayout={event => {
          const nextWidth = event.nativeEvent.layout.width;
          if (Math.abs(nextWidth - headerWidth) > 1) {
            setHeaderWidth(nextWidth);
          }
        }}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.iconButton} onPress={onMenuPress}>
            <Menu size={21} color="#374151" />
          </TouchableOpacity>
          {pageTitle ? (
            <Text style={styles.pageTitle} numberOfLines={1}>
              {pageTitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.headerRight}>
          {showCart ? (
            <TouchableOpacity style={[styles.iconButton, compactHeaderRight && styles.iconButtonCompact]} onPress={onCartPress}>
              <ShoppingCart size={20} color="#374151" />
              {cartItemCount > 0 ? (
                <View style={[styles.badge, styles.badgeGreen]}>
                  <Text style={styles.badgeText}>{cartItemCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}

          <View
            style={styles.notificationAnchor}
          >
            <TouchableOpacity style={[styles.iconButton, compactHeaderRight && styles.iconButtonCompact]} onPress={onNotificationPress}>
              <Bell size={20} color="#374151" />
              {unreadCount > 0 ? (
                <View style={[styles.badge, styles.badgeRed]}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            {isNotificationOpen && (
              <Animated.View
                style={[
                  styles.notificationMenuWide,
                  {
                    maxHeight: notificationPanelMaxHeight,
                    width: notificationPanelWidth,
                    right: 0,
                  },
                  {
                    opacity: menuAnimation,
                    transform: [
                      {
                        translateY: menuAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.notificationArrowWide} />
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>Bildirimler</Text>
                  <TouchableOpacity style={styles.notificationActionButton} onPress={onMarkAllNotificationsRead}>
                    <CheckCheck size={14} color="#15803D" />
                    <Text style={styles.notificationAction}>Okundu yap</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.notificationHeaderDivider} />
                <ScrollView
                  style={styles.notificationList}
                  contentContainerStyle={styles.notificationListContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {notifications.length === 0 ? (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyStateIcon}>
                        <BellOff size={16} color="#6B7280" />
                      </View>
                      <Text style={styles.notificationItemTitle}>Henüz bir bildirimin yok</Text>
                      <Text style={styles.notificationItemMeta}>Yeni sipariş durumları burada görünecek.</Text>
                    </View>
                  ) : (
                    notifications.slice(0, 3).map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.notificationItem, !item.isRead && styles.notificationItemUnread]}
                        onPress={() => onNotificationItemPress(item.id)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.notificationItemLeft}>
                          <View style={styles.notificationItemIcon}>{renderNotificationIcon(item.type)}</View>
                          <View style={styles.notificationItemBody}>
                            <View style={styles.notificationItemTopRow}>
                              <Text style={styles.notificationItemTitle} numberOfLines={1} ellipsizeMode="tail">
                                {item.title}
                              </Text>
                              {!item.isRead && !isCompletedStatus(item.status) ? (
                                <View style={styles.notificationUnreadDot} />
                              ) : null}
                            </View>
                            {item.status ? (
                              <Text
                                style={[styles.notificationItemStatus, { color: getStatusColor(item.status) }]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {localizeStatusText(item.status)}
                              </Text>
                            ) : null}
                            <Text style={styles.notificationItemMeta} numberOfLines={2}>
                              {localizeMetaText(item.meta)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
                {notifications.length > 0 ? (
                  <TouchableOpacity
                    style={styles.notificationViewAllButton}
                    onPress={onViewAllNotificationsPress}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.notificationViewAllText}>Tüm bildirimleri gör</Text>
                  </TouchableOpacity>
                ) : null}
              </Animated.View>
            )}
          </View>

          <View style={styles.profileAnchor}>
            <TouchableOpacity
              style={[styles.profileTrigger, compactHeaderRight && styles.profileTriggerCompact]}
              onPress={onProfilePress}
              onLayout={event => {
                const nextWidth = event.nativeEvent.layout.width || 44;
                if (Math.abs(nextWidth - profileTriggerWidth) > 1) {
                  setProfileTriggerWidth(nextWidth);
                }
              }}
            >
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.profileImage} />
              ) : (
                <View style={styles.fallbackAvatar}>
                  <UserCircle2 size={22} color="#6B7280" />
                </View>
              )}
              {showProfileName && <Text style={styles.profileName}>{userName}</Text>}
            </TouchableOpacity>

            {isProfileMenuOpen && (
              <View style={styles.profileMenu}>
                <View style={styles.profileArrow} />
                <TouchableOpacity style={styles.profileMenuItem} onPress={onSettingsPress}>
                  <Text style={styles.profileMenuText}>Ayarlar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileMenuItem} onPress={onLogoutPress}>
                  <Text style={styles.profileMenuLogout}>Çıkış Yap</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={styles.headerDivider} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'relative',
    overflow: 'visible',
    zIndex: 5,
    elevation: 0,
  },
  headerDivider: {
    marginTop: 12,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  header: {
    height: HEADER_HEIGHT,
    minHeight: HEADER_HEIGHT,
    maxHeight: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  pageTitle: {
    flexShrink: 1,
    color: '#14532D',
    fontSize: 31 / 2,
    lineHeight: 21,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'visible',
  },
  notificationAnchor: {
    position: 'relative',
    overflow: 'visible',
  },
  profileAnchor: {
    position: 'relative',
    overflow: 'visible',
    alignSelf: 'flex-start',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconButtonCompact: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeGreen: {
    backgroundColor: '#22C55E',
  },
  badgeRed: {
    backgroundColor: '#EF4444',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  profileTrigger: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  profileTriggerCompact: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 0,
    minWidth: 38,
    width: 38,
    justifyContent: 'center',
    gap: 0,
  },
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  fallbackAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  profileName: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Roboto',
    paddingRight: 4,
  },
  profileMenu: {
    position: 'absolute',
    top: 56,
    right: 0,
    minWidth: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    paddingVertical: 6,
  },
  profileArrow: {
    position: 'absolute',
    top: -6,
    right: 14,
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#E5E7EB',
  },
  notificationMenuWide: {
    position: 'absolute',
    top: 50,
    maxHeight: 340,
    backgroundColor: '#FFFFFFEE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 30,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  notificationArrowWide: {
    position: 'absolute',
    top: -6,
    right: 16,
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#E5E7EB',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  notificationHeaderDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 4,
  },
  notificationList: {
    flexGrow: 0,
  },
  notificationListContent: {
    paddingBottom: 2,
  },
  notificationTitle: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  notificationAction: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  notificationActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  notificationItem: {
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    marginTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  notificationItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notificationUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginTop: 1,
  },
  notificationItemUnread: {
    backgroundColor: '#F8FFF9',
  },
  notificationItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  notificationItemIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    marginTop: 1,
  },
  notificationItemBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  notificationItemTitle: {
    color: '#1F2937',
    fontWeight: '600',
    fontFamily: 'Roboto',
    flexShrink: 1,
    paddingRight: 4,
  },
  notificationItemStatus: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Roboto',
    lineHeight: 16,
  },
  notificationItemMeta: {
    color: '#4B5563',
    fontSize: 11.5,
    fontFamily: 'Roboto',
    lineHeight: 16,
    paddingRight: 8,
  },
  notificationViewAllButton: {
    marginTop: 8,
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    alignItems: 'center',
  },
  notificationViewAllText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  emptyStateIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  profileMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  profileMenuText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Roboto',
  },
  profileMenuLogout: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
});
