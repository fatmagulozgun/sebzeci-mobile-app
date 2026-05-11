import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CheckCircle2, ChevronRight, Clock3, PackageOpen, RefreshCw, Truck, XCircle } from 'lucide-react-native';
import apiClient from '../../services/apiClient';
import { showAppToast } from '../../context/toastContext';
import { getBottomSafePadding } from '../../theme/layout';
import { formatDateTime } from '../../utils/dateTime';

type OrderItem = {
  id?: string;
  quantity?: number;
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

const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_STEP = 4;

function statusMeta(status?: string) {
  if (status === 'PENDING') {
    return {
      label: 'Bekliyor',
      color: '#EA580C',
      bg: '#FFF7ED',
      border: '#FED7AA',
      Icon: Clock3,
    };
  }
  if (status === 'PREPARING') {
    return {
      label: 'Yolda',
      color: '#1D4ED8',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      Icon: Truck,
    };
  }
  if (status === 'DELIVERED') {
    return {
      label: 'Teslim Edildi',
      color: '#047857',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      Icon: CheckCircle2,
    };
  }
  if (status === 'CANCELLED') {
    return {
      label: 'İptal Edildi',
      color: '#B91C1C',
      bg: '#FEF2F2',
      border: '#FECACA',
      Icon: XCircle,
    };
  }
  return {
    label: status || '-',
    color: '#374151',
    bg: '#F3F4F6',
    border: '#E5E7EB',
    Icon: PackageOpen,
  };
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [loadingMore, setLoadingMore] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const loadMoreSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const fetchOrders = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const { data } = await apiClient.get('/orders');
      const list = Array.isArray(data?.data) ? data.data : [];
      setOrders(list);
      setVisibleCount(prev => (mode === 'initial' ? INITIAL_VISIBLE_COUNT : Math.max(prev, INITIAL_VISIBLE_COUNT)));
    } catch {
      showAppToast('Siparişler alınamadı', 'error');
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders('initial');
  }, [fetchOrders]);

  useEffect(() => {
    if (!refreshing) {
      spinValue.stopAnimation();
      spinValue.setValue(0);
      return;
    }
    const spinLoop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinLoop.start();
    return () => spinLoop.stop();
  }, [refreshing, spinValue]);

  const spinInterpolate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const loadMoreSpinInterpolate = loadMoreSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleRefresh = () => {
    if (refreshing || loading) return;
    fetchOrders('refresh');
  };

  const cancelOrder = async (orderId: string) => {
    setCancelingOrderId(orderId);
    try {
      const { data } = await apiClient.patch(`/orders/${orderId}/cancel`);
      setOrders(prev => prev.map(order => (order.id === orderId ? data?.data : order)));
      showAppToast('Sipariş iptal edildi', 'success');
    } catch {
      showAppToast('Sipariş iptal edilemedi', 'error');
    } finally {
      setCancelingOrderId(null);
    }
  };

  const visibleOrders = useMemo(() => orders.slice(0, visibleCount), [orders, visibleCount]);
  const hasMoreOrders = visibleCount < orders.length;

  useEffect(() => {
    if (!loadingMore) {
      loadMoreSpin.stopAnimation();
      loadMoreSpin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(loadMoreSpin, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [loadMoreSpin, loadingMore]);

  const handleLoadMore = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMoreOrders) return;
    setLoadingMore(true);
    setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_STEP, orders.length));
      setLoadingMore(false);
    }, 260);
  }, [hasMoreOrders, loading, loadingMore, orders.length, refreshing]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={loading ? [] : visibleOrders}
        keyExtractor={item => item.id}
        onEndReachedThreshold={0.35}
        onEndReached={handleLoadMore}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#16A34A', '#22C55E']} tintColor="#16A34A" progressBackgroundColor="#ECFDF5" />
        }
        ListHeaderComponent={
          <>
        <Text style={styles.pageTitle}>Siparişlerim</Text>

        {refreshing ? (
          <View style={styles.refreshHint}>
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <RefreshCw size={14} color="#15803D" />
            </Animated.View>
            <Text style={styles.refreshHintText}>Siparişler yenileniyor...</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color="#16A34A" />
            <Text style={styles.loaderText}>Siparişler yükleniyor...</Text>
          </View>
        ) : null}

        {!loading && orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <PackageOpen size={28} color="#15803D" />
            </View>
            <Text style={styles.emptyTitle}>Henüz siparişin yok</Text>
            <Text style={styles.emptyText}>Taze ürünlerimizi keşfetmek için alışverişe başlayabilirsin.</Text>
          </View>
        ) : null}
          </>
        }
        renderItem={({ item: order }) => {
          const meta = statusMeta(order.status);
          const previewItems = (order.items || []).slice(0, 4);
          const remainCount = Math.max(0, (order.items || []).length - previewItems.length);
          const StatusIcon = meta.Icon;

          return (
            <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}>
              <View style={styles.cardHead}>
                <View style={styles.cardHeadText}>
                  <Text style={styles.orderNo}>Sipariş #{order.id.slice(0, 8)}</Text>
                  <Text style={styles.orderDate}>{formatDateTime(order.createdAt || order.updatedAt)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                  <StatusIcon size={13} color={meta.color} />
                  <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>

              <View style={styles.previewRow}>
                {previewItems.map((item, idx) => (
                  <View key={item.id || `${order.id}-item-${idx}`} style={styles.previewImageBox}>
                    {item.product?.imageUrl ? (
                      <Image source={{ uri: item.product.imageUrl }} style={styles.previewImage} />
                    ) : (
                      <View style={styles.previewFallback}>
                        <Text>🥬</Text>
                      </View>
                    )}
                  </View>
                ))}
                {remainCount > 0 ? <Text style={styles.moreText}>+{remainCount} ürün daha</Text> : null}
              </View>

              {order.note ? <Text style={styles.noteText}>Not: {order.note}</Text> : null}

              <View style={styles.cardFooter}>
                <Text style={styles.totalText}>Toplam: {Number(order.totalPrice || 0).toFixed(2)} TL</Text>
                <View style={styles.actions}>
                  {order.status === 'PENDING' || order.status === 'PREPARING' ? (
                    <TouchableOpacity disabled={cancelingOrderId === order.id} onPress={() => cancelOrder(order.id)}>
                      <Text style={styles.cancelAction}>{cancelingOrderId === order.id ? 'İptal ediliyor...' : 'İptal et'}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <ChevronRight size={16} color="#94A3B8" />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          !loading && loadingMore ? (
            <View style={styles.loadingMoreWrap}>
              <Animated.View style={{ transform: [{ rotate: loadMoreSpinInterpolate }] }}>
                <RefreshCw size={14} color="#15803D" />
              </Animated.View>
              <Text style={styles.loadingMoreText}>Daha fazla sipariş getiriliyor...</Text>
            </View>
          ) : !loading && hasMoreOrders ? (
            <View style={styles.loadingMoreIdleWrap}>
              <Text style={styles.loadingMoreIdleText}>Daha fazlası için aşağı kaydır</Text>
            </View>
          ) : (
            <View style={styles.listBottomSpacer} />
          )
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: getBottomSafePadding(insets.bottom, 8) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingTop: 10,
  },
  listContent: {
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 38,
    lineHeight: 44,
    color: '#111827',
    fontWeight: '700',
    fontFamily: 'Roboto',
    marginBottom: 12,
  },
  refreshHint: {
    marginTop: -2,
    marginBottom: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshHintText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  loaderWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Roboto',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 20,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 10,
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  emptyText: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Roboto',
  },
  card: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHeadText: {
    flex: 1,
  },
  orderNo: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  orderDate: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  previewRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewImageBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Roboto',
  },
  noteText: {
    marginTop: 10,
    color: '#4B5563',
    fontSize: 14,
    fontFamily: 'Roboto',
  },
  cardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  totalText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelAction: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  loadingMoreWrap: {
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#ECFDF5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingMoreText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  loadingMoreIdleWrap: {
    marginTop: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  loadingMoreIdleText: {
    color: '#64748B',
    fontSize: 13,
    fontFamily: 'Roboto',
  },
  listBottomSpacer: {
    height: 8,
  },
});
