import React from 'react';
import {
  ArrowRight,
  Boxes,
  CircleDot,
  House,
  LogOut,
  Settings,
  ShoppingBag,
  ShoppingCart,
  X,
} from 'lucide-react-native';
import { ActivityIndicator, Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  userName?: string;
  cartItemCount?: number;
  activeRoute?: string;
  onHomePress: () => void;
  onProductsPress: () => void;
  onCartPress: () => void;
  onOrdersPress: () => void;
  onSettingsPress: () => void;
  onClose: () => void;
  onLogoutPress: () => void;
  isLoggingOut?: boolean;
};

export default function AppDrawer({
  userName = 'Kullanici',
  cartItemCount = 0,
  activeRoute,
  onHomePress,
  onProductsPress,
  onCartPress,
  onOrdersPress,
  onSettingsPress,
  onClose,
  onLogoutPress,
  isLoggingOut = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const isActive = (routeName: string) => activeRoute === routeName;
  const logoutOverlayOpacity = React.useRef(new Animated.Value(0)).current;
  const logoutOverlayScale = logoutOverlayOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  React.useEffect(() => {
    Animated.timing(logoutOverlayOpacity, {
      toValue: isLoggingOut ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [isLoggingOut, logoutOverlayOpacity]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.drawer}>
      <View style={styles.topSection}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={20} color="#374151" />
        </TouchableOpacity>
        <View style={styles.profileRow}>
          <View style={styles.brandAvatarWrap}>
            <Image
              source={require('../../images/logo.png')}
              style={styles.brandAvatar}
              resizeMode="contain"
            />
          </View>
          <View style={styles.profileTexts}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {userName}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>Müşteri</Text>
              </View>
            </View>
            <Text style={styles.profileSub}>Taze ürün, güvenilir hizmet</Text>
          </View>
        </View>
        <View style={styles.promoCard}>
          <View style={styles.promoLeft}>
            <View style={styles.promoIconWrap}>
              <CircleDot size={14} color="#dcfce7" />
            </View>
            <Text style={styles.promoTitle}>Bugün 5 fırsat seni bekliyor</Text>
            <Text style={styles.promoSub}>Sepeti tamamla, taze ürünleri kaçırma.</Text>
            <TouchableOpacity style={styles.promoBtn} onPress={onProductsPress}>
              <Text style={styles.promoBtnText}>Ürünleri Gör</Text>
              <ArrowRight size={15} color="#166534" />
            </TouchableOpacity>
          </View>
          <Image source={require('../../images/logo.png')} style={styles.promoImage} resizeMode="contain" />
        </View>
      </View>

      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={styles.menuScrollContent}
          showsVerticalScrollIndicator
        >
          <View style={styles.menuList}>
            <Text style={[styles.menuGroupTitle, styles.firstMenuGroupTitle]}>GENEL</Text>
            <TouchableOpacity style={[styles.menuItem, isActive('Home') && styles.menuItemActive]} onPress={onHomePress}>
              <House size={23} color={isActive('Home') ? '#2E7D32' : '#14532D'} />
              <Text style={[styles.menuText, isActive('Home') && styles.menuTextActive]}>Kontrol Paneli</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, isActive('Products') && styles.menuItemActive]} onPress={onProductsPress}>
              <Boxes size={23} color={isActive('Products') ? '#2E7D32' : '#14532D'} />
              <Text style={[styles.menuText, isActive('Products') && styles.menuTextActive]}>Ürünler</Text>
            </TouchableOpacity>

            <Text style={styles.menuGroupTitle}>ALIŞVERİŞ</Text>
            <TouchableOpacity style={[styles.menuItem, isActive('Cart') && styles.menuItemActive]} onPress={onCartPress}>
              <ShoppingCart size={23} color={isActive('Cart') ? '#2E7D32' : '#14532D'} />
              <Text style={[styles.menuText, isActive('Cart') && styles.menuTextActive]}>Sepet</Text>
              {cartItemCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, isActive('Orders') && styles.menuItemActive]} onPress={onOrdersPress}>
              <ShoppingBag size={23} color={isActive('Orders') ? '#2E7D32' : '#14532D'} />
              <Text style={[styles.menuText, isActive('Orders') && styles.menuTextActive]}>Siparişlerim</Text>
            </TouchableOpacity>

            <Text style={styles.menuGroupTitle}>HESAP</Text>
            <TouchableOpacity style={[styles.menuItem, isActive('Settings') && styles.menuItemActive]} onPress={onSettingsPress}>
              <Settings size={23} color={isActive('Settings') ? '#2E7D32' : '#14532D'} />
              <Text style={[styles.menuText, isActive('Settings') && styles.menuTextActive]}>Ayarlar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.drawerLogoutButton, isLoggingOut && styles.drawerLogoutButtonDisabled]}
          onPress={onLogoutPress}
          disabled={isLoggingOut}
        >
          <LogOut size={18} color="#D32F2F" />
          <Text style={styles.drawerLogoutText}>{isLoggingOut ? 'Çıkış Yapılıyor...' : 'Çıkış Yap'}</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        pointerEvents={isLoggingOut ? 'auto' : 'none'}
        style={[styles.logoutOverlay, { opacity: logoutOverlayOpacity }]}
      >
        <View style={styles.logoutBlurLayer} />
        <View style={styles.logoutGlowOne} />
        <View style={styles.logoutGlowTwo} />
        <Animated.View style={[styles.logoutCard, { transform: [{ scale: logoutOverlayScale }] }]}>
          <ActivityIndicator size="small" color="#ffffff" />
          <Text style={styles.logoutOverlayText}>Güvenli çıkış yapılıyor</Text>
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  drawer: {
    flex: 1,
    position: 'relative',
    width: '100%',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  topSection: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 6,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  brandAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandAvatar: {
    width: 54,
    height: 54,
  },
  profileTexts: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 36,
  },
  profileName: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
    flexShrink: 1,
  },
  roleBadge: {
    borderRadius: 999,
    backgroundColor: '#15803D',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  profileSub: {
    marginTop: 3,
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoCard: {
    marginTop: 10,
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#15803D',
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  promoLeft: {
    flex: 1,
  },
  promoIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  promoTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  promoSub: {
    marginTop: 3,
    color: '#DCFCE7',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Roboto',
  },
  promoBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    height: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoBtnText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  promoImage: {
    width: 64,
    height: 64,
    opacity: 0.95,
  },
  bottomSection: {
    flex: 1,
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingBottom: 8,
  },
  menuList: {
    gap: 8,
    marginTop: 8,
  },
  firstMenuGroupTitle: {
    marginTop: 0,
  },
  menuGroupTitle: {
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 14,
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    fontFamily: 'Roboto',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 47,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  menuItemActive: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  menuText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  menuTextActive: {
    color: '#2E7D32',
  },
  badge: {
    marginLeft: 'auto',
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  drawerLogoutButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  drawerLogoutText: {
    color: '#D32F2F',
    fontWeight: '700',
    fontSize: 16,
    fontFamily: 'Roboto',
  },
  drawerLogoutButtonDisabled: {
    opacity: 0.85,
  },
  logoutOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.64)',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  logoutBlurLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoutGlowOne: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    top: 64,
    right: -35,
  },
  logoutGlowTwo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    bottom: 56,
    left: -30,
  },
  logoutCard: {
    minWidth: 190,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    gap: 10,
  },
  logoutOverlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
});
