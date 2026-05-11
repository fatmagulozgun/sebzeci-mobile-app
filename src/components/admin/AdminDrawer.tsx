import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, LayoutDashboard, Boxes, ShoppingBag, Users, Settings, LogOut, X } from 'lucide-react-native';

type Props = {
  userName?: string;
  todayNewOrdersCount?: number;
  activeRoute?: string;
  onDashboardPress: () => void;
  onProductsPress: () => void;
  onOrdersPress: () => void;
  onCustomersPress: () => void;
  onSettingsPress: () => void;
  onClose: () => void;
  onLogoutPress: () => void;
};

export default function AdminDrawer({
  userName = 'Kullanici',
  todayNewOrdersCount = 0,
  activeRoute,
  onDashboardPress,
  onProductsPress,
  onOrdersPress,
  onCustomersPress,
  onSettingsPress,
  onClose,
  onLogoutPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const isActive = (routeName: string) => activeRoute === routeName;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.drawer}>
      <View style={styles.topSection}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={20} color="#374151" />
        </TouchableOpacity>
        <View style={styles.profileRow}>
          <View style={styles.brandAvatarWrap}>
            <Image source={require('../../images/logo.png')} style={styles.brandAvatar} resizeMode="contain" />
          </View>
          <View style={styles.profileTexts}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {userName}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>Satıcı</Text>
              </View>
            </View>
            <Text style={styles.profileSub}>Taze ürün, güvenilir hizmet</Text>
          </View>
        </View>
        <View style={styles.promoCard}>
          <View style={styles.promoLeft}>
            
            <Text style={styles.promoTitle}>Bugün {todayNewOrdersCount} yeni sipariş</Text>
            <Text style={styles.promoSub}>Siparişleri kontrol edip kazancı artır.</Text>
            <TouchableOpacity style={styles.promoBtn} onPress={onOrdersPress}>
              <Text style={styles.promoBtnText}>Siparişleri Gör</Text>
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
            <TouchableOpacity style={[styles.menuItem, isActive('AdminDashboard') && styles.menuItemActive]} onPress={onDashboardPress}>
              <LayoutDashboard size={23} color={isActive('AdminDashboard') ? '#2E7D32' : '#14532D'} />
              <Text style={[styles.menuText, isActive('AdminDashboard') && styles.menuTextActive]}>Kontrol Paneli</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, isActive('AdminProducts') && styles.menuItemActive]} onPress={onProductsPress}>
              <Boxes size={23} color={isActive('AdminProducts') ? '#2E7D32' : '#14532D'} />
              <Text style={[styles.menuText, isActive('AdminProducts') && styles.menuTextActive]}>Ürün Yönetimi</Text>
            </TouchableOpacity>

            <Text style={styles.menuGroupTitle}>SİPARİŞ</Text>
            <TouchableOpacity style={[styles.menuItem, isActive('AdminOrders') && styles.menuItemActive]} onPress={onOrdersPress}>
              <ShoppingBag size={23} color={isActive('AdminOrders') ? '#2E7D32' : '#14532D'} />
              <Text style={[styles.menuText, isActive('AdminOrders') && styles.menuTextActive]}>Siparişler</Text>
            </TouchableOpacity>

            <Text style={styles.menuGroupTitle}>MÜŞTERİ</Text>
            <TouchableOpacity style={[styles.menuItem, isActive('AdminCustomers') && styles.menuItemActive]} onPress={onCustomersPress}>
              <Users size={23} color={isActive('AdminCustomers') ? '#2E7D32' : '#14532D'} />
              <Text style={[styles.menuText, isActive('AdminCustomers') && styles.menuTextActive]}>Müşteriler</Text>
            </TouchableOpacity>

            <Text style={styles.menuGroupTitle}>HESAP</Text>
            <TouchableOpacity style={[styles.menuItem, isActive('Settings') && styles.menuItemActive]} onPress={onSettingsPress}>
              <Settings size={23} color={isActive('Settings') ? '#2E7D32' : '#14532D'} />
              <Text style={[styles.menuText, isActive('Settings') && styles.menuTextActive]}>Ayarlar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.drawerLogoutButton} onPress={onLogoutPress}>
          <LogOut size={18} color="#D32F2F" />
          <Text style={styles.drawerLogoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>
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
  menuList: {
    gap: 8,
    marginTop: 8,
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
  firstMenuGroupTitle: {
    marginTop: 0,
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
});

