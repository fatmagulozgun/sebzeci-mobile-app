import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import apiClient, { AUTH_TOKEN_KEY, WEB_APP_BASE_URL } from '../../services/apiClient';
import { getStoredSession } from '../../services/authService';
import { showAppToast } from '../../context/toastContext';
import SkeletonBlock from '../../components/common/SkeletonBlock';

type OrderItem = {
  id?: string;
  quantity?: number;
  price?: number;
  unitPrice?: number;
  product?: {
    name?: string;
    imageUrl?: string;
  };
};

type Order = {
  id: string;
  status?: string;
  totalPrice?: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: OrderItem[];
};

type Props = {
  route: {
    params?: {
      orderId?: string;
    };
  };
  canUpdateStatus?: boolean;
};

const statusLabels: Record<string, string> = {
  PENDING: 'Bekliyor',
  PREPARING: 'Hazırlanıyor',
  SHIPPED: 'Hazır',
  READY: 'Hazır',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal Edildi',
};

const timelineSteps = ['PENDING', 'PREPARING', 'SHIPPED', 'DELIVERED'];

export default function OrderDetailScreen({ route, canUpdateStatus = false }: Props) {
  const navigation = useNavigation<any>();
  const orderId = route?.params?.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [cancelingOrder, setCancelingOrder] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      setLoading(true);
      try {
        const { data } = await apiClient.get(`/orders/${orderId}`);
        setOrder(data?.data || null);
      } catch {
        showAppToast('Sipariş detayı alınamadı', 'error');
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  const subtotal = useMemo(
    () =>
      (order?.items || []).reduce((sum, item) => {
        const unitPrice = Number(item.price ?? item.unitPrice ?? 0);
        return sum + unitPrice * Number(item.quantity || 0);
      }, 0),
    [order?.items],
  );
  const currentStepIndex = timelineSteps.indexOf(order?.status || '');
  const statusUpdateDisabled = updatingStatus || !canUpdateStatus;

  const handleStatusUpdate = async (status: string) => {
    if (!order?.id || order.status === status) return;
    setUpdatingStatus(true);
    try {
      await apiClient.patch(`/orders/${order.id}/status`, { status });
      setOrder(prev => (prev ? { ...prev, status } : prev));
      showAppToast('Sipariş durumu güncellendi', 'success');
    } catch {
      showAppToast('Durum güncellenemedi', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePrint = async () => {
    if (!order?.id) return;
    try {
      const session = await getStoredSession();
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const tokenValue = storedToken || session?.token || '';
      if (!tokenValue) {
        showAppToast('Oturum bulunamadi. Tekrar giris yapin.', 'error');
        return;
      }
      const token = encodeURIComponent(tokenValue);
      const printUrl = `${WEB_APP_BASE_URL}/orders/${encodeURIComponent(order.id)}/print${token ? `?token=${token}` : ''}`;
      await Linking.openURL(printUrl);
    } catch {
      showAppToast('Yazdırma ekranı açılamadı', 'error');
    }
  };
  const canCancelOrder = !canUpdateStatus && (order?.status === 'PENDING' || order?.status === 'PREPARING');
  const handleBack = () => {
    if (canUpdateStatus) {
      navigation.navigate('AdminOrders');
      return;
    }
    navigation.navigate('Orders');
  };

  const handleCancelOrder = async () => {
    if (!order?.id || !canCancelOrder || cancelingOrder) return;
    setCancelingOrder(true);
    try {
      const { data } = await apiClient.patch(`/orders/${order.id}/cancel`);
      const nextOrder = data?.data;
      if (nextOrder) {
        setOrder(nextOrder);
      } else {
        setOrder(prev => (prev ? { ...prev, status: 'CANCELLED' } : prev));
      }
      showAppToast('Sipariş iptal edildi', 'success');
    } catch {
      showAppToast('Sipariş iptal edilemedi', 'error');
    } finally {
      setCancelingOrder(false);
    }
  };

  if (loading) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.skeletonCard}>
          <SkeletonBlock width={180} height={28} borderRadius={10} />
          <SkeletonBlock width={84} height={22} borderRadius={999} tone="green" />
          <View style={styles.skeletonHeaderActions}>
            <SkeletonBlock width={72} height={34} borderRadius={10} />
            <SkeletonBlock width={72} height={34} borderRadius={10} tone="button" />
          </View>
        </View>

        <View style={styles.skeletonCard}>
          <SkeletonBlock width={110} height={20} borderRadius={8} />
          {Array.from({ length: 3 }).map((_, idx) => (
            <View key={idx} style={styles.skeletonItemRow}>
              <SkeletonBlock width={44} height={44} borderRadius={12} tone="green" />
              <View style={{ flex: 1 }}>
                <SkeletonBlock width="72%" height={14} borderRadius={8} />
                <SkeletonBlock width="50%" height={12} borderRadius={999} style={styles.skeletonItemMeta} />
              </View>
              <SkeletonBlock width={58} height={14} borderRadius={8} tone="green" />
            </View>
          ))}
        </View>

        <View style={styles.skeletonCard}>
          <SkeletonBlock width={110} height={20} borderRadius={8} />
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonBlock key={idx} width="78%" height={20} borderRadius={999} tone={idx < 2 ? 'green' : 'default'} />
          ))}
        </View>
      </ScrollView>
    );
  }

  if (!order) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Sipariş detayı bulunamadı.</Text>
      </View>
    );
  }

  const items = order.items || [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Sipariş Detayı</Text>
            <View
              style={[
                styles.statusBadge,
                order.status === 'CANCELLED' ? styles.statusBadgeCancelled : styles.statusBadgeDefault,
              ]}
            >
              <Text style={styles.statusText}>{statusLabels[order.status || ''] || order.status || '-'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.ghostButton} onPress={handlePrint}>
            <Text style={styles.ghostButtonText}>Yazdır</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.darkButton} onPress={handleBack}>
            <Text style={styles.darkButtonText}>Geri</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ürünler</Text>
        {items.map((item, idx) => (
          <View key={item.id || `${order.id}-${idx}`} style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <View style={styles.imageBox}>
                {item.product?.imageUrl ? <Image source={{ uri: item.product.imageUrl }} style={styles.image} /> : <Text>🥬</Text>}
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemName}>{item.product?.name || 'Ürün'}</Text>
                <Text style={styles.itemMeta}>
                  <Text style={styles.qtyPill}>x{Number(item.quantity || 0)}</Text> • {Number(item.price ?? item.unitPrice ?? 0).toFixed(2)} TL
                </Text>
              </View>
            </View>
            <Text style={styles.itemPrice}>
              {(Number(item.price ?? item.unitPrice ?? 0) * Number(item.quantity || 0)).toFixed(2)} TL
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sipariş Akışı</Text>
        <View style={styles.timelineWrap}>
          {timelineSteps.map((step, idx) => {
            const stepIndex = timelineSteps.indexOf(step);
            const completed = currentStepIndex > -1 && currentStepIndex > stepIndex;
            const current = currentStepIndex === stepIndex;
            const active = current || completed;

            return (
              <Pressable
                key={step}
                disabled={statusUpdateDisabled}
                onPress={canUpdateStatus ? () => handleStatusUpdate(step) : undefined}
                style={({ pressed }) => [
                  styles.timelineButton,
                  pressed && canUpdateStatus && !updatingStatus ? styles.timelineButtonPressed : null,
                  updatingStatus ? styles.timelineButtonDisabled : null,
                ]}
              >
                {idx !== timelineSteps.length - 1 ? (
                  <View style={[styles.timelineConnector, completed ? styles.timelineConnectorDone : null]} />
                ) : null}
                <View
                  style={[
                    styles.timelineDot,
                    current ? styles.timelineDotCurrent : active ? styles.timelineDotDone : styles.timelineDotIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.timelineDotText,
                      current ? styles.timelineDotTextCurrent : active ? styles.timelineDotTextDone : styles.timelineDotTextIdle,
                    ]}
                  >
                    {active ? '✔' : '○'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.timelineLabel,
                    current ? styles.timelineLabelCurrent : active ? styles.timelineLabelDone : styles.timelineLabelIdle,
                  ]}
                >
                  {statusLabels[step]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {canCancelOrder ? (
        <View style={styles.section}>
          <TouchableOpacity style={[styles.cancelOrderButton, cancelingOrder ? styles.cancelOrderButtonDisabled : null]} onPress={handleCancelOrder} disabled={cancelingOrder}>
            <Text style={styles.cancelOrderButtonText}>{cancelingOrder ? 'Sipariş iptal ediliyor...' : 'Siparişi İptal Et'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {order.note ? (
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Sipariş Notu</Text>
          <Text style={styles.noteText}>{order.note}</Text>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Özet</Text>
        <View style={styles.summaryRows}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ara toplam</Text>
            <Text style={styles.summaryValue}>{subtotal.toFixed(2)} TL</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Kargo</Text>
            <Text style={styles.summaryValue}>0.00 TL</Text>
          </View>
          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalLabel}>Toplam</Text>
            <Text style={styles.summaryTotalValue}>{Number(order.totalPrice || 0).toFixed(2)} TL</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    paddingTop: 10,
    paddingBottom: 24,
    gap: 10,
  },
  skeletonCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5ECE7',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  skeletonHeaderActions: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  skeletonItemRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skeletonItemMeta: {
    marginTop: 6,
  },
  emptyWrap: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  emptyText: {
    color: '#4B5563',
    fontSize: 14,
    fontFamily: 'Roboto',
  },
  headerRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pageTitle: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  ghostButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  darkButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusBadgeDefault: {
    borderColor: '#FDE68A',
    backgroundColor: '#FEF9C3',
  },
  statusBadgeCancelled: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  statusText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  imageBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemBody: {
    flex: 1,
  },
  itemName: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  itemMeta: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  qtyPill: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  itemPrice: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  timelineWrap: {
    marginTop: 4,
    gap: 2,
  },
  timelineButton: {
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    position: 'relative',
  },
  timelineButtonPressed: {
    backgroundColor: '#F9FAFB',
  },
  timelineButtonDisabled: {
    opacity: 0.6,
  },
  timelineConnector: {
    position: 'absolute',
    left: 17,
    top: 24,
    width: 1,
    height: 18,
    backgroundColor: '#E5E7EB',
  },
  timelineConnectorDone: {
    backgroundColor: '#86EFAC',
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotCurrent: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  timelineDotDone: {
    backgroundColor: '#DCFCE7',
  },
  timelineDotIdle: {
    backgroundColor: '#F3F4F6',
  },
  timelineDotText: {
    fontSize: 10,
    fontFamily: 'Roboto',
  },
  timelineDotTextCurrent: {
    color: '#15803D',
    fontWeight: '700',
  },
  timelineDotTextDone: {
    color: '#15803D',
  },
  timelineDotTextIdle: {
    color: '#6B7280',
  },
  timelineLabel: {
    fontSize: 13,
    fontFamily: 'Roboto',
  },
  timelineLabelCurrent: {
    color: '#166534',
    fontWeight: '700',
  },
  timelineLabelDone: {
    color: '#111827',
    fontWeight: '600',
  },
  timelineLabelIdle: {
    color: '#6B7280',
  },
  cancelOrderButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelOrderButtonDisabled: {
    opacity: 0.7,
  },
  cancelOrderButtonText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  noteCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 14,
  },
  noteTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  noteText: {
    marginTop: 6,
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Roboto',
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#ECFDF5',
    padding: 14,
  },
  summaryRows: {
    marginTop: 12,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#4B5563',
    fontSize: 13,
    fontFamily: 'Roboto',
  },
  summaryValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  summaryTotalRow: {
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTotalLabel: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  summaryTotalValue: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Roboto',
  },
});
