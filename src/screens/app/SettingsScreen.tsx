import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserCircle2 } from 'lucide-react-native';
import apiClient from '../../services/apiClient';
import { setStoredUser } from '../../services/authService';
import { resolveDisplayName } from '../../utils/profile';
import { getAdminFixedAvatar, getAssignedAvatar } from '../../utils/avatar';
import { showAppToast } from '../../context/toastContext';
import { useAuth } from '../../context/authContext';

const ADMIN_NOTIFICATION_SETTINGS_KEY = 'admin_mobile_notification_settings_v1';
const CUSTOMER_NOTIFICATION_SETTINGS_KEY = 'customer_mobile_notification_settings_v1';

type Props = {
  userName: string;
  profileImageUri: string | null;
  onUserProfileUpdated?: (nextName: string, nextImageUri: string | null) => void;
};

type AdminNotificationSettings = {
  notifyNewOrder: boolean;
  notifyLowStock: boolean;
  notifyNewCustomer: boolean;
};

type CustomerNotificationSettings = {
  notifyPreparingOrders: boolean;
  notifyDeliveryUpdates: boolean;
  notifyCancelledOrders: boolean;
};

const defaultAdminNotificationSettings: AdminNotificationSettings = {
  notifyNewOrder: true,
  notifyLowStock: true,
  notifyNewCustomer: true,
};

const defaultCustomerNotificationSettings: CustomerNotificationSettings = {
  notifyPreparingOrders: true,
  notifyDeliveryUpdates: true,
  notifyCancelledOrders: true,
};

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#D1D5DB', true: '#22C55E' }} thumbColor="#FFFFFF" />
    </View>
  );
}

export default function SettingsScreen({ userName, profileImageUri, onUserProfileUpdated }: Props) {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const [phone, setPhone] = useState('');
  const [assignedAvatar, setAssignedAvatar] = useState(profileImageUri || '');
  const [adminNotificationSettings, setAdminNotificationSettings] = useState<AdminNotificationSettings>(
    defaultAdminNotificationSettings,
  );
  const [customerNotificationSettings, setCustomerNotificationSettings] = useState<CustomerNotificationSettings>(
    defaultCustomerNotificationSettings,
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [roleLabel, setRoleLabel] = useState('Müşteri');
  const adminFixedAvatar = getAdminFixedAvatar();
  const shimmerOpacity = useRef(new Animated.Value(0.35)).current;

  const hydrate = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      if (user) {
        setPhone((user as any).phone || '');
        setIsAdmin(user.role === 'ADMIN');
        setEmail(user.email || '');
        setRoleLabel(user.role === 'ADMIN' ? 'Mağaza Sahibi' : 'Müşteri');
        setAssignedAvatar(user.role === 'ADMIN' ? adminFixedAvatar : getAssignedAvatar(user));
      }

      try {
        const [rawAdmin, rawCustomer] = await Promise.all([
          AsyncStorage.getItem(ADMIN_NOTIFICATION_SETTINGS_KEY),
          AsyncStorage.getItem(CUSTOMER_NOTIFICATION_SETTINGS_KEY),
        ]);
        const parsedAdmin = rawAdmin ? JSON.parse(rawAdmin) : null;
        const parsedCustomer = rawCustomer ? JSON.parse(rawCustomer) : null;
        setAdminNotificationSettings({
          notifyNewOrder: parsedAdmin?.notifyNewOrder ?? defaultAdminNotificationSettings.notifyNewOrder,
          notifyLowStock: parsedAdmin?.notifyLowStock ?? defaultAdminNotificationSettings.notifyLowStock,
          notifyNewCustomer: parsedAdmin?.notifyNewCustomer ?? defaultAdminNotificationSettings.notifyNewCustomer,
        });
        setCustomerNotificationSettings({
          notifyPreparingOrders:
            parsedCustomer?.notifyPreparingOrders ?? defaultCustomerNotificationSettings.notifyPreparingOrders,
          notifyDeliveryUpdates:
            parsedCustomer?.notifyDeliveryUpdates ?? defaultCustomerNotificationSettings.notifyDeliveryUpdates,
          notifyCancelledOrders:
            parsedCustomer?.notifyCancelledOrders ?? defaultCustomerNotificationSettings.notifyCancelledOrders,
        });
      } catch {
        setAdminNotificationSettings(defaultAdminNotificationSettings);
        setCustomerNotificationSettings(defaultCustomerNotificationSettings);
      }
    } finally {
      if (asRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [adminFixedAvatar, user]);

  useEffect(() => {
    const run = async () => {
      await hydrate(false);
    };
    run();
  }, [hydrate]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmerOpacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    if (loading || refreshing) {
      loop.start();
    } else {
      shimmerOpacity.stopAnimation();
      shimmerOpacity.setValue(0.35);
    }
    return () => loop.stop();
  }, [loading, refreshing, shimmerOpacity]);

  const displayedImage = useMemo(() => {
    if (isAdmin) return adminFixedAvatar;
    return assignedAvatar?.trim() || profileImageUri || getAssignedAvatar({ email, name: userName });
  }, [adminFixedAvatar, assignedAvatar, email, isAdmin, profileImageUri, userName]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isAdmin) {
        await AsyncStorage.setItem(ADMIN_NOTIFICATION_SETTINGS_KEY, JSON.stringify(adminNotificationSettings));
      } else {
        await AsyncStorage.setItem(CUSTOMER_NOTIFICATION_SETTINGS_KEY, JSON.stringify(customerNotificationSettings));
      }

      const payload: any = {};
      if (!isAdmin) payload.phone = phone;

      const { data } = await apiClient.patch('/auth/me', payload);
      const updatedUser = data?.data;
      if (updatedUser) {
        const normalizedUser = {
          ...updatedUser,
          avatarUrl: isAdmin ? adminFixedAvatar : getAssignedAvatar(updatedUser),
        };
        await setStoredUser(normalizedUser);
        const nextName = resolveDisplayName(updatedUser);
        const nextImageUri = isAdmin ? adminFixedAvatar : getAssignedAvatar(normalizedUser);
        onUserProfileUpdated?.(nextName, nextImageUri || null);
        setAssignedAvatar(isAdmin ? adminFixedAvatar : nextImageUri || '');
      }
      showAppToast('Ayarlar kaydedildi', 'success');
    } catch (error: any) {
      const statusCode = Number(error?.response?.status || 0);
      if (statusCode === 401 || statusCode === 404) {
        await signOut();
        showAppToast('Oturum yenilendi. Lutfen tekrar giris yapin.', 'error');
      } else {
        showAppToast('Ayarlar kaydedilemedi', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => hydrate(true)}
          tintColor="#15803D"
          colors={['#15803D']}
        />
      }
    >
      {loading ? (
        <View style={styles.skeletonWrap}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Animated.View key={`settings-skeleton-${index}`} style={[styles.skeletonCard, { opacity: shimmerOpacity }]}>
              <View style={styles.skeletonLineLarge} />
              <View style={styles.skeletonLineMedium} />
              <View style={styles.skeletonLineSmall} />
            </Animated.View>
          ))}
        </View>
      ) : null}

      {refreshing ? (
        <Animated.View style={[styles.refreshHint, { opacity: shimmerOpacity }]}>
          <Text style={styles.refreshHintText}>Ayarlar yenileniyor...</Text>
        </Animated.View>
      ) : null}

      {!loading ? (
        <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profil Bilgileri</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            {displayedImage ? <Image source={{ uri: displayedImage }} style={styles.avatar} /> : <UserCircle2 size={54} color="#9CA3AF" />}
          </View>
          <View style={styles.profileText}>
            <Text style={styles.nameText}>{userName}</Text>
            <Text style={styles.emailText}>{email || 'kullanici@sebzeci.com'}</Text>
            <Text style={styles.roleText}>Rol: {roleLabel}</Text>
          </View>
        </View>
        {!isAdmin ? (
          <>
            <Text style={styles.inputLabel}>Telefon Numarası</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="05xx xxx xx xx"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bildirim Ayarları</Text>
        <View style={styles.toggleList}>
          {isAdmin ? (
            <>
              <ToggleRow
                label="Yeni sipariş geldiğinde bildir"
                description="Yeni bir sipariş geldiğinde üst bardan bildirim göster."
                value={adminNotificationSettings.notifyNewOrder}
                onChange={next =>
                  setAdminNotificationSettings(current => ({ ...current, notifyNewOrder: next }))
                }
              />
              <ToggleRow
                label="Stok bitince bildir"
                description="Stok kritik seviyeye düştüğünde bildirim oluştur."
                value={adminNotificationSettings.notifyLowStock}
                onChange={next =>
                  setAdminNotificationSettings(current => ({ ...current, notifyLowStock: next }))
                }
              />
              <ToggleRow
                label="Yeni müşteri kaydolunca bildir"
                description="Yeni kayıt olan müşterileri bildir."
                value={adminNotificationSettings.notifyNewCustomer}
                onChange={next =>
                  setAdminNotificationSettings(current => ({ ...current, notifyNewCustomer: next }))
                }
              />
            </>
          ) : (
            <>
              <ToggleRow
                label="Sipariş hazırlanırken bildir"
                description="Siparişin bekliyor veya hazırlanıyor durumuna geçtiğinde bildir."
                value={customerNotificationSettings.notifyPreparingOrders}
                onChange={next =>
                  setCustomerNotificationSettings(current => ({ ...current, notifyPreparingOrders: next }))
                }
              />
              <ToggleRow
                label="Teslimat güncellemelerini bildir"
                description="Siparişin yola çıktığında veya teslim edildiğinde bildir."
                value={customerNotificationSettings.notifyDeliveryUpdates}
                onChange={next =>
                  setCustomerNotificationSettings(current => ({ ...current, notifyDeliveryUpdates: next }))
                }
              />
              <ToggleRow
                label="İptal durumlarını bildir"
                description="Sipariş iptal edildiğinde bildirim göster."
                value={customerNotificationSettings.notifyCancelledOrders}
                onChange={next =>
                  setCustomerNotificationSettings(current => ({ ...current, notifyCancelledOrders: next }))
                }
              />
            </>
          )}
        </View>
      </View>

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</Text>
      </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F3F4F6',
  },
  screenContent: {
    paddingTop: 10,
    gap: 10,
    paddingBottom: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  cardTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  profileRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 3,
    borderColor: '#DCFCE7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  profileText: {
    flex: 1,
  },
  nameText: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  emailText: {
    marginTop: 2,
    color: '#4B5563',
    fontSize: 13,
    fontFamily: 'Roboto',
  },
  roleText: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  inputLabel: {
    marginTop: 12,
    marginBottom: 6,
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 14,
    fontFamily: 'Roboto',
  },
  toggleList: {
    marginTop: 10,
    gap: 8,
  },
  toggleRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  toggleDescription: {
    marginTop: 3,
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  saveButton: {
    borderRadius: 10,
    backgroundColor: '#15803D',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  skeletonWrap: {
    gap: 10,
  },
  skeletonCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  skeletonLineLarge: {
    height: 16,
    width: '56%',
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  skeletonLineMedium: {
    height: 12,
    width: '78%',
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  skeletonLineSmall: {
    height: 12,
    width: '42%',
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  refreshHint: {
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  refreshHintText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
});
