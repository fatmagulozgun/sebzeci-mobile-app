import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Package, ShoppingBag, ShoppingCart } from 'lucide-react-native';
import apiClient from '../../services/apiClient';
import { useCart } from '../../context/cartContext';
import { formatRelativeTime as formatSharedRelativeTime, getDateTimestamp } from '../../utils/dateTime';

type Props = {
  userName: string;
  profileImageUri: string | null;
};

type Order = {
  id: string;
  status?: string;
  totalPrice?: number;
  createdAt?: string;
  updatedAt?: string;
};

type Product = {
  id: string;
};

function AnimatedNumber({
  value,
  duration = 700,
  fractionDigits = 0,
  animateKey = 0,
}: {
  value: number;
  duration?: number;
  fractionDigits?: number;
  animateKey?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value || 0);
    const startedAt = Date.now();
    let rafId: number | null = null;

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    setDisplay(0);
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [animateKey, duration, value]);

  return <Text>{display.toFixed(fractionDigits)}</Text>;
}

function formatRelativeTime(value?: string | null) {
  const relative = formatSharedRelativeTime(value);
  return relative ? `Son sipariş: ${relative}` : 'Son sipariş: henüz yok';
}

function statusLabel(status?: string) {
  if (status === 'PENDING') return 'Bekliyor';
  if (status === 'PREPARING') return 'Hazırlanıyor';
  if (status === 'SHIPPED') return 'Hazır';
  if (status === 'DELIVERED') return 'Teslim Edildi';
  if (status === 'CANCELLED') return 'İptal Edildi';
  return status || '-';
}

export default function HomeScreen({ userName, profileImageUri }: Props) {
  const navigation = useNavigation<any>();
  const { items } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [animationSeed, setAnimationSeed] = useState(0);
  const [refreshSpin] = useState(() => new Animated.Value(0));

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aTime = getDateTimestamp(a.updatedAt || a.createdAt || null);
      const bTime = getDateTimestamp(b.updatedAt || b.createdAt || null);
      return bTime - aTime;
    });
  }, [orders]);

  const fetchDashboardData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([apiClient.get('/orders'), apiClient.get('/products')]);
      const fetchedOrders = Array.isArray(ordersRes?.data?.data) ? ordersRes.data.data : [];
      const fetchedProducts = Array.isArray(productsRes?.data?.data) ? productsRes.data.data : [];
      setOrders(fetchedOrders);
      setProducts(fetchedProducts);
    } catch {
      setOrders([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchDashboardData();
      setAnimationSeed(seed => seed + 1);
    }, [fetchDashboardData]),
  );

  useEffect(() => {
    if (!refreshing) {
      refreshSpin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(refreshSpin, {
        toValue: 1,
        duration: 850,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      refreshSpin.setValue(0);
    };
  }, [refreshSpin, refreshing]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchDashboardData();
    }, 10000);
    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  const cartCount = useMemo(
    () => items.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0),
    [items],
  );
  const cartTotal = useMemo(
    () => items.reduce((sum: number, item: any) => sum + Number(item?.price || 0) * Number(item?.quantity || 0), 0),
    [items],
  );
  const lastOrders = useMemo(() => sortedOrders.slice(0, 4), [sortedOrders]);
  const latestOrderDate = sortedOrders?.[0]?.updatedAt || sortedOrders?.[0]?.createdAt || null;
  const latestOrderDays = useMemo(() => {
    const timestamp = getDateTimestamp(latestOrderDate);
    if (!timestamp) return 0;
    return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
  }, [latestOrderDate]);

  const handlePullToRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setAnimationSeed(seed => seed + 1);
    setRefreshing(false);
  }, [fetchDashboardData]);

  const refreshSpinInterpolate = refreshSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullToRefresh}
          tintColor="#16A34A"
          colors={['#16A34A']}
          progressBackgroundColor="#F0FDF4"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {refreshing ? (
        <View style={styles.refreshBadge}>
          <Animated.View style={{ transform: [{ rotate: refreshSpinInterpolate }] }}>
            <ShoppingBag size={14} color="#166534" />
          </Animated.View>
          <Text style={styles.refreshBadgeText}>Veriler yenileniyor...</Text>
        </View>
      ) : null}

      <View style={styles.metricCard}>
        <View style={[styles.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
          <ShoppingCart size={18} color="#B45309" />
        </View>
        <Text style={styles.metricLabel}>Sepet</Text>
        <Text style={styles.metricValue}>
          <AnimatedNumber value={cartCount} animateKey={animationSeed} /> ürün
        </Text>
        <Text style={styles.metricSub}>
          Toplam: <AnimatedNumber value={cartTotal} fractionDigits={2} animateKey={animationSeed} /> TL
        </Text>
        <Pressable onPress={() => navigation.navigate('Cart')}>
          <Text style={styles.metricLink}>Sepeti görüntüle {'->'}</Text>
        </Pressable>
      </View>

      <View style={styles.metricCard}>
        <View style={[styles.metricIconWrap, { backgroundColor: '#DBEAFE' }]}>
          <Package size={18} color="#1D4ED8" />
        </View>
        <Text style={styles.metricLabel}>Alışverişe devam et</Text>
        <Text style={styles.metricValue}>Ürünler</Text>
        <Text style={styles.metricSub}>
          <AnimatedNumber value={products.length} animateKey={animationSeed} /> ürün mevcut
        </Text>
        <Pressable onPress={() => navigation.navigate('Products')}>
          <Text style={styles.metricLink}>Ürün listesine git {'->'}   </Text>
        </Pressable>
      </View>

      <View style={styles.metricCard}>
        <View style={[styles.metricIconWrap, { backgroundColor: '#D1FAE5' }]}>
          <ShoppingBag size={18} color="#047857" />
        </View>
        <Text style={styles.metricLabel}>Toplam sipariş</Text>
        <Text style={styles.metricValue}>
          <AnimatedNumber value={orders.length} animateKey={animationSeed} />
        </Text>
        <Text style={styles.metricSub}>{formatRelativeTime(latestOrderDate)}</Text>
        <Pressable onPress={() => navigation.navigate('Orders')}>
          <Text style={styles.metricLink}>Siparişleri görüntüle {'->'} </Text>
        </Pressable>
      </View>

      <View style={styles.ordersCard}>
        <View style={styles.ordersHeader}>
          <Text style={styles.ordersTitle}>Son Verdiğin Siparişler</Text>
          <Pressable onPress={() => navigation.navigate('Orders')}>
            <Text style={styles.ordersAll}>Tüm siparişler</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color="#16A34A" />
            <Text style={styles.loaderText}>Yükleniyor...</Text>
          </View>
        ) : lastOrders.length === 0 ? (
          <Text style={styles.emptyText}>Henüz siparişin yok.</Text>
        ) : (
          lastOrders.map(order => (
            <Pressable
              key={order.id}
              style={styles.orderRow}
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
            >
              <Text style={styles.orderId}>Sipariş #{order.id.slice(0, 8)}</Text>
              <Text style={styles.orderMeta}>
                {statusLabel(order.status)} - {Number(order.totalPrice || 0).toFixed(2)} TL
              </Text>
            </Pressable>
          ))
        )}
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
    gap: 12,
    paddingTop: 6,
    paddingBottom: 14,
  },
  refreshBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 10,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshBadgeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F0FDF4',
    padding: 16,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  heroAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    color: '#166534',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    color: '#047857',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  heroSubtitle: {
    marginTop: 3,
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Roboto',
  },
  heroOrderInfo: {
    marginTop: 5,
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  heroButton: {
    marginTop: 14,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  metricCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 13,
    fontFamily: 'Roboto',
  },
  metricValue: {
    marginTop: 4,
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    fontFamily: 'Roboto',
  },
  metricSub: {
    marginTop: 3,
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Roboto',
  },
  metricLink: {
    marginTop: 12,
    color: '#15803D',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  ordersCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 12,
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  ordersTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  ordersAll: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  loaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loaderText: {
    color: '#6B7280',
    fontSize: 13,
    fontFamily: 'Roboto',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    fontFamily: 'Roboto',
  },
  orderRow: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingVertical: 11,
  },
  orderId: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  orderMeta: {
    marginTop: 3,
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Roboto',
  },
});
