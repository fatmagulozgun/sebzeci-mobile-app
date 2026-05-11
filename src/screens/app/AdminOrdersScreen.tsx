import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient, { AUTH_TOKEN_KEY, WEB_APP_BASE_URL } from '../../services/apiClient';
import { getStoredSession } from '../../services/authService';
import { showAppToast } from '../../context/toastContext';
import { formatRelativeTime } from '../../utils/dateTime';
import SkeletonBlock from '../../components/common/SkeletonBlock';
import useModalBackDismiss from '../../hooks/useModalBackDismiss';

const statusLabels: Record<string, string> = {
  PENDING: 'Bekliyor',
  PREPARING: 'Hazırlanıyor',
  SHIPPED: 'Hazır',
  READY: 'Hazır',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal Edildi',
};

const interactiveStatuses = ['PENDING', 'PREPARING', 'SHIPPED', 'DELIVERED'];
const pageSize = 4;

type OrderItem = {
  id?: string;
  quantity?: number;
  product?: { imageUrl?: string; name?: string };
};

type Order = {
  id: string;
  status?: string;
  createdAt?: string;
  totalPrice?: number;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    image?: string;
    avatarUrl?: string;
    photoUrl?: string;
    profileImageDataUrl?: string;
  };
  items?: OrderItem[];
};

export default function AdminOrdersScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);

  const firstLoadRef = useRef(true);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const { dismissKeyboardOrClose: dismissKeyboardOrCloseDeleteModal } = useModalBackDismiss({
    enabled: Boolean(deleteCandidateId),
    onClose: () => setDeleteCandidateId(null),
  });

  const fetchOrders = async ({ background = false }: { background?: boolean } = {}) => {
    if (!background) setLoading(true);
    try {
      const { data } = await apiClient.get('/orders');
      const list = Array.isArray(data?.data) ? (data.data as Order[]) : [];
      if (firstLoadRef.current) {
        knownOrderIdsRef.current = new Set(list.map(item => item.id));
        firstLoadRef.current = false;
      } else {
        const known = knownOrderIdsRef.current;
        const incoming = list.filter(item => !known.has(item.id));
        if (incoming.length > 0) {
          showAppToast('Yeni sipariş geldi', 'success');
          knownOrderIdsRef.current = new Set(list.map(item => item.id));
        }
      }
      setOrders(list);
      setCurrentPage(prev => {
        const maxPage = Math.max(1, Math.ceil(list.length / pageSize));
        return Math.min(prev, maxPage);
      });
    } catch (error: any) {
      if (!mountedRef.current) return;
      const status = Number(error?.response?.status || 0);
      if (status === 401 || status === 403) return;
      showAppToast('Siparişler alınamadı', 'error');
    } finally {
      if (!mountedRef.current) return;
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchOrders();
    const timer = setInterval(() => {
      fetchOrders({ background: true });
    }, 15000);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, []);

  const handlePullToRefresh = async () => {
    setRefreshing(true);
    await fetchOrders({ background: true });
    setRefreshing(false);
  };

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await apiClient.patch(`/orders/${orderId}/status`, { status });
      showAppToast('Sipariş durumu güncellendi', 'success');
      fetchOrders();
    } catch {
      showAppToast('Durum güncellenemedi', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await apiClient.delete(`/orders/${orderId}`);
      showAppToast('Sipariş silindi', 'success');
      setDeleteCandidateId(null);
      fetchOrders();
    } catch {
      showAppToast('Sipariş silinemedi', 'error');
    }
  };

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return orders.filter(order => {
      const matchesTab = activeTab === 'ALL' ? true : order.status === activeTab;
      const haystack = `${order.id}`.toLowerCase();
      const matchesSearch = query ? haystack.includes(query) : true;
      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, searchTerm]);

  const tabCounts = useMemo(
    () => ({
      ALL: orders.length,
      PENDING: orders.filter(o => o.status === 'PENDING').length,
      PREPARING: orders.filter(o => o.status === 'PREPARING').length,
      DELIVERED: orders.filter(o => o.status === 'DELIVERED').length,
      CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
    }),
    [orders],
  );

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const visiblePageNumbers = useMemo(
    () => Array.from({ length: Math.min(4, totalPages) }, (_, idx) => idx + 1),
    [totalPages],
  );
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedOrders = filteredOrders.slice(startIdx, startIdx + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  const handlePrintOrder = async (orderId: string) => {
    try {
      const session = await getStoredSession();
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const tokenValue = storedToken || session?.token || '';
      if (!tokenValue) {
        showAppToast('Oturum bulunamadi. Tekrar giris yapin.', 'error');
        return;
      }
      const token = encodeURIComponent(tokenValue);
      const printUrl = `${WEB_APP_BASE_URL}/orders/${encodeURIComponent(orderId)}/print${token ? `?token=${token}` : ''}`;
      await Linking.openURL(printUrl);
    } catch {
      showAppToast('Yazdırma ekranı açılamadı', 'error');
    }
  };

  const stopCardPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
  };

  return (
    <View style={styles.screen}>
      

      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {[
            { key: 'ALL', label: 'Tümü' },
            { key: 'PENDING', label: 'Bekleyen' },
            { key: 'PREPARING', label: 'Hazırlanan' },
            { key: 'DELIVERED', label: 'Teslim' },
            { key: 'CANCELLED', label: 'İptal' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label} ({(tabCounts as any)[tab.key] ?? 0})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Sipariş ara"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: 22 + insets.bottom + 10 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor="#15803D" colors={['#15803D']} />
        }
      >
        {refreshing ? (
          <View style={styles.refreshSkeletonWrap}>
            {Array.from({ length: 2 }).map((_, index) => (
              <View key={`refresh-${index}`} style={styles.refreshSkeletonCard}>
                <View style={styles.refreshSkeletonTopRow}>
                  <SkeletonBlock width="58%" height={18} borderRadius={8} />
                  <SkeletonBlock width={74} height={24} borderRadius={999} tone="green" />
                </View>
                <View style={styles.refreshSkeletonAvatarRow}>
                  <SkeletonBlock width={30} height={30} borderRadius={999} tone="green" />
                  <SkeletonBlock width={30} height={30} borderRadius={999} tone="green" />
                  <SkeletonBlock width={30} height={30} borderRadius={999} tone="green" />
                </View>
                <View style={styles.refreshSkeletonActionCard}>
                  <SkeletonBlock width={78} height={30} borderRadius={8} />
                  <SkeletonBlock width="42%" height={26} borderRadius={8} tone="green" />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {loading && orders.length === 0 ? (
          <View style={styles.refreshSkeletonWrap}>
            {Array.from({ length: 3 }).map((_, index) => (
              <View key={`initial-${index}`} style={styles.refreshSkeletonCard}>
                <View style={styles.refreshSkeletonTopRow}>
                  <SkeletonBlock width="58%" height={18} borderRadius={8} />
                  <SkeletonBlock width={74} height={24} borderRadius={999} tone="green" />
                </View>
                <View style={styles.refreshSkeletonAvatarRow}>
                  <SkeletonBlock width={30} height={30} borderRadius={999} tone="green" />
                  <SkeletonBlock width={30} height={30} borderRadius={999} tone="green" />
                  <SkeletonBlock width={30} height={30} borderRadius={999} tone="green" />
                </View>
                <View style={styles.refreshSkeletonActionCard}>
                  <SkeletonBlock width={78} height={30} borderRadius={8} />
                  <SkeletonBlock width="42%" height={26} borderRadius={8} tone="green" />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {paginatedOrders.map(order => (
          <Pressable
            key={order.id}
            onPress={() => navigation.navigate('AdminOrderDetail', { orderId: order.id })}
            style={({ pressed }) => [styles.orderCard, pressed && styles.orderCardPressed]}
          >
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <View style={styles.orderHeadRow}>
                  <Text style={styles.orderNo}>Sipariş #{order.id.slice(0, 8)}</Text>
                  <View style={[styles.statusBadge, order.status === 'CANCELLED' ? styles.badgeCancelled : styles.badgeNormal]}>
                    <Text style={styles.statusText}>{statusLabels[order.status || ''] || order.status || '-'}</Text>
                  </View>
                </View>
                <View style={styles.itemsPreviewRow}>
                  {(order.items || []).slice(0, 4).map(item => (
                    <View key={item.id || `${order.id}-${item.product?.name}`} style={styles.itemPreview}>
                      {item.product?.imageUrl ? <Image source={{ uri: item.product.imageUrl }} style={styles.itemPreviewImg} /> : <Text>🥬</Text>}
                    </View>
                  ))}
                  {(order.items || []).length > 4 ? (
                    <Text style={styles.moreText}>+{(order.items || []).length - 4}</Text>
                  ) : null}
                </View>
                <View style={styles.linkRow}>
                  <TouchableOpacity
                    onPress={event => {
                      stopCardPress(event);
                      navigation.navigate('AdminOrderDetail', { orderId: order.id });
                    }}
                  >
                    <Text style={styles.linkPrimary}>Detayı gör</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={event => {
                      stopCardPress(event);
                      handlePrintOrder(order.id);
                    }}
                  >
                    <Text style={styles.linkMuted}>Yazdır</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={event => {
                      stopCardPress(event);
                      setDeleteCandidateId(order.id);
                    }}
                  >
                    <Text style={styles.linkDelete}>Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.actionsCard}>
              <View style={styles.topActionRow}>
                <TouchableOpacity
                  disabled={updatingId === order.id || order.status === 'CANCELLED'}
                  onPress={event => {
                    stopCardPress(event);
                    updateStatus(order.id, 'CANCELLED');
                  }}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>İptal Et</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.totalPrice}>{Number(order.totalPrice || 0).toFixed(2)} TL</Text>
                  <View style={styles.totalMetaRow}>
                    <Text style={styles.totalSub}>
                      {(order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} ürün
                    </Text>
                    <Text style={styles.totalSub}>{formatRelativeTime(order.createdAt) || '-'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.statusRow}>
                {interactiveStatuses.map(status => (
                  <TouchableOpacity
                    key={status}
                    disabled={updatingId === order.id}
                    onPress={event => {
                      stopCardPress(event);
                      updateStatus(order.id, status);
                    }}
                    style={[styles.statusActionBtn, order.status === status && styles.statusActionBtnActive]}
                  >
                    <Text style={[styles.statusActionText, order.status === status && styles.statusActionTextActive]}>
                      {statusLabels[status]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

            </View>
          </Pressable>
        ))}

        {!loading && !refreshing && paginatedOrders.length === 0 ? <Text style={styles.emptyText}>Sipariş bulunamadı.</Text> : null}

        {filteredOrders.length > pageSize ? (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
              disabled={currentPage === 1}
              onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <Text style={styles.pageBtnText}>Geri</Text>
            </TouchableOpacity>
            {visiblePageNumbers.map(p => {
              const active = p === currentPage;
              return (
                <TouchableOpacity key={p} style={[styles.pageNumBtn, active && styles.pageNumBtnActive]} onPress={() => setCurrentPage(p)}>
                  <Text style={[styles.pageNumText, active && styles.pageNumTextActive]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
              disabled={currentPage === totalPages}
              onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <Text style={styles.pageBtnText}>İleri</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(deleteCandidateId)} transparent animationType="fade" onRequestClose={dismissKeyboardOrCloseDeleteModal}>
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteCandidateId(null)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>Siparişi silmek istiyor musun?</Text>
            <Text style={styles.modalText}>Bu işlem geri alınamaz.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setDeleteCandidateId(null)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDelete}
                onPress={() => {
                  if (deleteCandidateId) handleDeleteOrder(deleteCandidateId);
                }}
              >
                <Text style={styles.modalDeleteText}>Sil</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  headerRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' },
  pageTitle: { fontSize: 34, fontWeight: '700', color: '#111827', fontFamily: 'Roboto' },
  filterWrap: { marginTop: 10 },
  tabsRow: { gap: 8, paddingBottom: 8 },
  tabBtn: { borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6 },
  tabBtnActive: { borderColor: '#86efac', backgroundColor: '#dcfce7' },
  tabText: { fontSize: 12, color: '#374151', fontFamily: 'Roboto' },
  tabTextActive: { color: '#166534', fontWeight: '700' },
  searchInput: { marginTop: 6, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff', paddingHorizontal: 12, color: '#111827', fontFamily: 'Roboto' },
  listContent: { paddingTop: 10, paddingBottom: 22, gap: 10 },
  orderCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  orderCardPressed: { opacity: 0.92 },
  cardTop: {},
  orderHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  orderNo: { color: '#0F172A', fontSize: 18, fontWeight: '700', fontFamily: 'Roboto' },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  badgeNormal: { borderColor: '#BBF7D0', backgroundColor: '#ECFDF5' },
  badgeCancelled: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  statusText: { color: '#374151', fontSize: 12, fontWeight: '700', fontFamily: 'Roboto' },
  itemsPreviewRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemPreviewImg: { width: '100%', height: '100%' },
  moreText: { color: '#6B7280', fontSize: 11, fontFamily: 'Roboto' },
  actionsCard: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F8FAFC', padding: 10 },
  topActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cancelBtn: { borderRadius: 8, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', paddingHorizontal: 8, height: 30, justifyContent: 'center' },
  cancelBtnText: { color: '#B91C1C', fontSize: 12, fontWeight: '600', fontFamily: 'Roboto' },
  totalPrice: { color: '#0F172A', fontSize: 34, fontWeight: '700', fontFamily: 'Roboto' },
  totalSub: { marginTop: 1, color: '#6B7280', fontSize: 11, fontFamily: 'Roboto' },
  totalMetaRow: { marginTop: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 4 },
  statusActionBtn: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#F8FAFC' },
  statusActionBtnActive: { backgroundColor: '#dcfce7' },
  statusActionText: { color: '#475569', fontSize: 11, fontFamily: 'Roboto' },
  statusActionTextActive: { color: '#166534', fontWeight: '700' },
  linkRow: { marginTop: 10, flexDirection: 'row', gap: 14 },
  linkPrimary: { color: '#15803D', fontSize: 13, fontWeight: '700', fontFamily: 'Roboto' },
  linkMuted: { color: '#4B5563', fontSize: 12, fontFamily: 'Roboto' },
  linkDelete: { color: '#B91C1C', fontSize: 12, fontFamily: 'Roboto' },
  emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 16, fontFamily: 'Roboto' },
  refreshSkeletonWrap: { gap: 10 },
  refreshSkeletonCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5ECE7',
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  refreshSkeletonTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  refreshSkeletonAvatarRow: { marginTop: 10, flexDirection: 'row', gap: 6 },
  refreshSkeletonActionCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5ECE7',
    backgroundColor: '#F8FAFC',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  paginationRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pageBtn: { borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', paddingHorizontal: 10, height: 34, justifyContent: 'center' },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { color: '#334155', fontSize: 12, fontWeight: '600', fontFamily: 'Roboto' },
  pageNumBtn: { borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  pageNumBtnActive: { borderColor: '#86efac', backgroundColor: '#dcfce7' },
  pageNumText: { color: '#334155', fontSize: 12, fontFamily: 'Roboto' },
  pageNumTextActive: { color: '#166534', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 18 },
  modalCard: { borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', padding: 14 },
  modalTitle: { color: '#111827', fontSize: 16, fontWeight: '700', fontFamily: 'Roboto' },
  modalText: { marginTop: 6, color: '#4B5563', fontSize: 13, fontFamily: 'Roboto' },
  modalActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalCancel: { borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 12, height: 34, justifyContent: 'center' },
  modalCancelText: { color: '#374151', fontSize: 12, fontFamily: 'Roboto' },
  modalDelete: { borderRadius: 8, backgroundColor: '#DC2626', paddingHorizontal: 12, height: 34, justifyContent: 'center' },
  modalDeleteText: { color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: 'Roboto' },
});

