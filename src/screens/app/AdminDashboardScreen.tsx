import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import apiClient from '../../services/apiClient';
import { Package, ShoppingCart, Users } from 'lucide-react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AppSkeletonBlock from '../../components/common/SkeletonBlock';
import { formatProductUnit } from '../../utils/productUnit';

type Order = {
  id: string;
  status?: string;
  totalPrice?: number;
  createdAt?: string;
};

type LowStockProduct = {
  id: string;
  name: string;
  stock: number;
  unit: string;
};

type DashboardSummary = {
  totalProducts: number;
  pendingOrders: number;
  totalCustomers: number;
  lowStockProducts: LowStockProduct[];
};

const dayLabels = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];

function toLocalDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildWeeklyOrdersChart(orders: Order[] = []) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const map = new Map<string, { key: string; day: string; orders: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = toLocalDateKey(d);
    map.set(key, { key, day: dayLabels[d.getDay()], orders: 0 });
  }

  orders.forEach(o => {
    if (!o?.createdAt) return;
    const key = toLocalDateKey(new Date(o.createdAt));
    if (map.has(key)) {
      map.get(key)!.orders += 1;
    }
  });

  return Array.from(map.values()).map(v => ({ day: v.day, orders: v.orders }));
}

function getTodayStats(orders: Order[] = []) {
  const todayKey = toLocalDateKey(new Date());
  const todayOrders = orders.filter(o => o?.createdAt && toLocalDateKey(new Date(o.createdAt)) === todayKey);
  const todayRevenue = todayOrders
    .filter(o => String(o?.status || '').toUpperCase() !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.totalPrice || 0), 0);
  return { todayOrders: todayOrders.length, todayRevenue };
}

function AnimatedNumber({ value, duration = 900, fractionDigits = 0 }: { value: number; duration?: number; fractionDigits?: number }) {
  const target = Number(value || 0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setDisplay(0);
      return;
    }

    let frameId: number | null = null;
    const startedAt = Date.now();
    const from = 0;

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      const next = Math.round(from + (target - from) * eased);
      setDisplay(next);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };

    setDisplay(0);
    frameId = requestAnimationFrame(tick);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [target, duration, fractionDigits]);

  return display.toFixed(fractionDigits);
}

function WeeklyOrdersBarChart({ data }: { data: { day: string; orders: number }[] }) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(248, Math.min(width - 44, 356));
  const chartHeight = 128;
  const padLeft = 20;
  const padRight = 12;
  const padTop = 8;
  const padBottom = 24;

  const maxVal = Math.max(1, ...data.map(d => Number(d.orders || 0)));
  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;
  const step = innerW / Math.max(1, data.length);
  const barW = step * 0.5;

  const yLines = 4;

  return (
    <View style={styles.chartWrap}>
      <Svg width={chartWidth} height={chartHeight}>
        {Array.from({ length: yLines + 1 }).map((_, i) => {
          const t = i / yLines;
          const y = padTop + innerH * t;
          return <Line key={i} x1={padLeft} x2={chartWidth - padRight} y1={y} y2={y} stroke="#E5E7EB" strokeDasharray="4 4" />;
        })}

        {data.map((d, i) => {
          const val = Number(d.orders || 0);
          const barH = (val / maxVal) * innerH;
          const x = padLeft + step * i + (step - barW) / 2;
          const y = padTop + innerH - barH;

          return (
            <React.Fragment key={d.day + i}>
              <Rect x={x} y={y} width={barW} height={barH} rx={10} fill="#16A34A" />
              <SvgText
                x={x + barW / 2}
                y={chartHeight - 10}
                fontSize={11}
                fill="#6B7280"
                textAnchor="middle"
              >
                {d.day}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function DashboardCard({
  Icon,
  title,
  value,
  suffix,
  subtitle,
  iconBg,
}: {
  Icon: React.ComponentType<any>;
  title: string;
  value: number;
  suffix?: string;
  subtitle: string;
  iconBg: string;
}) {
  return (
    <View style={styles.dashboardCard}>
      <View style={styles.dashboardCardRow}>
        <View style={styles.cardTextCol}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardValue}>
            <AnimatedNumber value={value} />
            {suffix ? <Text style={styles.cardSuffix}> {suffix}</Text> : null}
          </Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Icon width={20} height={20} color="#0F172A" />
        </View>
      </View>
    </View>
  );
}

function SkeletonBlock({
  height,
  width = '100%',
  borderRadius = 12,
  tone = 'default',
}: {
  height: number;
  width?: number | `${number}%` | '100%';
  borderRadius?: number;
  tone?: 'default' | 'green' | 'button';
}) {
  return <AppSkeletonBlock height={height} width={width} borderRadius={borderRadius} tone={tone} />;
}

function DashboardSkeleton() {
  return (
    <View style={styles.dashboardLayout}>
      <View style={styles.upperSection}>
        <View style={styles.cardsCol}>
          <View style={styles.dashboardCard}>
            <SkeletonBlock height={14} width="42%" />
            <View style={styles.skeletonSpacerSm} />
            <SkeletonBlock height={30} width="36%" tone="green" />
            <View style={styles.skeletonSpacerXs} />
            <SkeletonBlock height={12} width="30%" />
          </View>
          <View style={styles.dashboardCard}>
            <SkeletonBlock height={14} width="42%" />
            <View style={styles.skeletonSpacerSm} />
            <SkeletonBlock height={30} width="36%" tone="green" />
            <View style={styles.skeletonSpacerXs} />
            <SkeletonBlock height={12} width="30%" />
          </View>
          <View style={styles.dashboardCard}>
            <SkeletonBlock height={14} width="42%" />
            <View style={styles.skeletonSpacerSm} />
            <SkeletonBlock height={30} width="36%" tone="green" />
            <View style={styles.skeletonSpacerXs} />
            <SkeletonBlock height={12} width="30%" />
          </View>
        </View>

        <View style={styles.stockCard}>
          <View style={styles.stockHeader}>
            <View style={{ flex: 1 }}>
              <SkeletonBlock height={16} width="36%" />
              <View style={styles.skeletonSpacerXs} />
              <SkeletonBlock height={12} width="54%" />
            </View>
            <SkeletonBlock height={32} width={108} borderRadius={10} tone="button" />
          </View>
          <View style={styles.stockList}>
            <SkeletonBlock height={48} borderRadius={12} />
          </View>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <SkeletonBlock height={16} width="34%" />
        <View style={styles.skeletonSpacerXs} />
        <SkeletonBlock height={12} width="46%" />
        <View style={styles.summaryTiles}>
          <View style={styles.tile}>
            <SkeletonBlock height={12} width="52%" />
            <View style={styles.skeletonSpacerXs} />
            <SkeletonBlock height={18} width="32%" tone="green" />
          </View>
          <View style={styles.tile}>
            <SkeletonBlock height={12} width="52%" />
            <View style={styles.skeletonSpacerXs} />
            <SkeletonBlock height={18} width="44%" tone="green" />
          </View>
        </View>
        <View style={styles.chartWrap}>
          <SkeletonBlock height={120} borderRadius={10} tone="green" />
        </View>
      </View>
    </View>
  );
}

export default function AdminDashboardScreen({ userName: _userName }: { userName: string }) {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const [dashRes, ordersRes] = await Promise.all([apiClient.get('/admin/dashboard'), apiClient.get('/orders')]);

        const dash = dashRes?.data?.data as DashboardSummary | undefined;
        const list = Array.isArray(ordersRes?.data?.data) ? (ordersRes.data.data as Order[]) : [];

        setSummary(dash || null);
        setOrders(list);
      } catch {
        if (!silent) {
          setSummary(null);
          setOrders([]);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData({ silent: true });
    }, [fetchData]),
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchData({ silent: true });
    }, 15000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const weeklyOrdersChart = useMemo(() => buildWeeklyOrdersChart(orders), [orders]);
  const todayStats = useMemo(() => getTodayStats(orders), [orders]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentHost}>
        {loading ? (
          <DashboardSkeleton />
        ) : summary ? (
        <View style={styles.dashboardLayout}>
          <View style={styles.upperSection}>
            <View style={styles.cardsCol}>
              <DashboardCard Icon={Package} title="Toplam Ürün" value={summary.totalProducts} suffix="ürün" subtitle="Son 7 gün" iconBg="#D1FAE5" />
              <DashboardCard Icon={ShoppingCart} title="Yeni Sipariş" value={summary.pendingOrders} suffix="adet" subtitle="Son 7 gün" iconBg="#DBEAFE" />
              <DashboardCard Icon={Users} title="Müşteri Sayısı" value={summary.totalCustomers} suffix="müşteri" subtitle="Son 7 gün" iconBg="#E9D5FF" />
            </View>

            <View style={styles.stockCard}>
              <View style={styles.stockHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stockTitle}>⚠️ Stok Uyarısı</Text>
                  <Text style={styles.stockSub}>Stok seviyesi düşük ürünler.</Text>
                </View>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate('AdminProducts')}
                >
                  <Text style={styles.primaryButtonText}>Stoğu Güncelle</Text>
                </Pressable>
              </View>

              <View style={styles.stockList}>
                {(summary.lowStockProducts || []).length === 0 ? (
                  <View style={styles.dashedCard}>
                    <Text style={styles.dashedText}>Düşük stok ürünü yok.</Text>
                  </View>
                ) : (
                  (summary.lowStockProducts || []).map(p => (
                    <View key={p.id} style={[styles.stockRow, p.stock <= 0 ? styles.stockRowOut : null]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stockName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={[styles.stockMeta, p.stock <= 0 ? styles.stockMetaOut : null]}>
                          {p.stock <= 0 ? 'Stok bitti' : 'Kalan stok'}
                        </Text>
                      </View>
                      <View style={[styles.stockPill, p.stock <= 0 ? styles.stockPillOut : null]}>
                        <Text style={[styles.stockPillText, p.stock <= 0 ? styles.stockPillTextOut : null]}>
                          {p.stock} {formatProductUnit({ unit: p.unit })}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Haftalık Özet</Text>
            <Text style={styles.summarySub}>Son 7 gün sipariş trendi.</Text>

            <View style={styles.summaryTiles}>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Bugün sipariş</Text>
                <Text style={styles.tileValue}>{todayStats.todayOrders}</Text>
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Bugün ciro</Text>
                <Text style={styles.tileValue}>
                  {todayStats.todayRevenue ? `${Number(todayStats.todayRevenue).toFixed(0)}` : '-'} TL
                </Text>
              </View>
            </View>

            <WeeklyOrdersBarChart data={weeklyOrdersChart} />
          </View>
        </View>
        ) : (
          <View style={styles.dashboardLayout}>
            <View style={styles.summaryCard}>
              <Text style={styles.emptyText}>Panel verileri alınamadı.</Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 2,
  },
  scrollContent: {
    paddingBottom: 0,
    flexGrow: 1,
    minHeight: 620,
  },
  h1: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
    fontFamily: 'Roboto',
  },
  contentHost: {
    flex: 1,
    minHeight: 620,
  },
  dashboardLayout: {
    flex: 1,
    gap: 12,
  },
  upperSection: {
    gap: 12,
  },
  cardsCol: {
    gap: 12,
  },
  dashboardCard: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5ECE7',
    minHeight: 98,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  dashboardCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  cardValue: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    fontFamily: 'Roboto',
    lineHeight: 32,
  },
  cardSuffix: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  cardSubtitle: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 11,
    fontFamily: 'Roboto',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  stockCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    minHeight: 122,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  stockHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  stockTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    fontFamily: 'Roboto',
  },
  stockSub: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  primaryButton: {
    height: 32,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Roboto',
  },
  stockList: {
    marginTop: 10,
    gap: 8,
  },
  dashedCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    padding: 12,
  },
  dashedText: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  stockRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFBEB',
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  stockRowOut: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  stockName: {
    fontWeight: '700',
    color: '#111827',
    fontSize: 13,
    fontFamily: 'Roboto',
  },
  stockMeta: {
    marginTop: 1,
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  stockMetaOut: {
    color: '#B91C1C',
  },
  stockPill: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  stockPillOut: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  stockPillText: {
    fontWeight: '800',
    color: '#92400E',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  stockPillTextOut: {
    color: '#991B1B',
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 13,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    fontFamily: 'Roboto',
  },
  summarySub: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  summaryTiles: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  tileLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  tileValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    fontFamily: 'Roboto',
  },
  chartWrap: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Roboto',
  },
  skeletonBlock: {
    backgroundColor: '#E5E7EB',
  },
  skeletonSpacerSm: {
    height: 10,
  },
  skeletonSpacerXs: {
    height: 6,
  },
});
