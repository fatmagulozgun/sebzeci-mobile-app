import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import apiClient from '../../services/apiClient';
import { showAppToast } from '../../context/toastContext';
import { getAssignedAvatar } from '../../utils/avatar';
import { formatDate } from '../../utils/dateTime';
import SkeletonBlock from '../../components/common/SkeletonBlock';

type Customer = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  totalOrders?: number;
  totalSpent?: number;
  createdAt?: string;
  image?: string;
  avatarUrl?: string;
  photoUrl?: string;
  profileImageDataUrl?: string;
};

export default function AdminCustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const fetchCustomers = async (keyword: string, { background = false }: { background?: boolean } = {}) => {
    const currentId = ++requestIdRef.current;
    if (!background) setLoading(true);
    try {
      const { data } = await apiClient.get('/admin/customers', {
        params: keyword ? { search: keyword } : {},
      });
      if (currentId !== requestIdRef.current) return;
      const list = Array.isArray(data?.data) ? data.data : [];
      setCustomers(list);
    } catch (error: any) {
      if (!mountedRef.current || currentId !== requestIdRef.current) return;
      const status = Number(error?.response?.status || 0);
      if (status === 401 || status === 403) return;
      showAppToast('Müşteriler alınamadı', 'error');
    } finally {
      if (!mountedRef.current || currentId !== requestIdRef.current) return;
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchCustomers('');
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(c => {
      const name = String(c.name || '').toLowerCase();
      const email = String(c.email || '').toLowerCase();
      const phone = String(c.phone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [customers, search]);

  const customerImageSrc = (customer: Customer) => getAssignedAvatar(customer);

  const handlePullToRefresh = async () => {
    setRefreshing(true);
    await fetchCustomers(search, { background: true });
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="İsim, e-posta veya telefon ile ara..."
        placeholderTextColor="#9CA3AF"
        style={styles.searchInput}
      />


      <View style={styles.listWrap}>
        

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor="#15803D" colors={['#15803D']} />
          }
        >
          {loading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <View key={`skeleton-${idx}`} style={styles.skeletonCard}>
                  <View style={styles.skeletonRow}>
                    <SkeletonBlock width={38} height={38} borderRadius={999} tone="green" />
                    <View style={{ flex: 1 }}>
                      <SkeletonBlock width="48%" height={16} borderRadius={8} />
                      <SkeletonBlock width="68%" height={12} borderRadius={999} style={styles.skeletonLineSub} />
                    </View>
                  </View>
                  <View style={styles.skeletonGrid}>
                    <View style={styles.skeletonBox}>
                      <SkeletonBlock width="42%" height={10} borderRadius={999} />
                      <SkeletonBlock width="64%" height={14} borderRadius={8} tone="green" style={styles.skeletonBoxValue} />
                    </View>
                    <View style={styles.skeletonBox}>
                      <SkeletonBlock width="58%" height={10} borderRadius={999} />
                      <SkeletonBlock width="34%" height={14} borderRadius={8} tone="green" style={styles.skeletonBoxValue} />
                    </View>
                    <View style={[styles.skeletonBox, styles.skeletonBoxWide]}>
                      <SkeletonBlock width="46%" height={10} borderRadius={999} />
                      <SkeletonBlock width="40%" height={14} borderRadius={8} tone="green" style={styles.skeletonBoxValue} />
                    </View>
                  </View>
                </View>
              ))
            : null}

          {!loading
            ? filtered.map(customer => (
                <View key={customer.id || customer.email} style={styles.customerCard}>
                  <View style={styles.customerTopRow}>
                    <View style={styles.avatarWrap}>
                      {customerImageSrc(customer) ? (
                        <Image source={{ uri: String(customerImageSrc(customer)) }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarFallback}>
                          {(customer.name || customer.email || '?').slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerName}>{customer.name || 'İsimsiz'}</Text>
                      <Text style={styles.customerEmail}>{customer.email || '-'}</Text>
                    </View>
                  </View>

                  <View style={styles.metaGrid}>
                    <View style={styles.metaBox}>
                      <Text style={styles.metaLabel}>Telefon</Text>
                      <Text style={styles.metaValue}>{customer.phone || '-'}</Text>
                    </View>
                    <View style={styles.metaBox}>
                      <Text style={styles.metaLabel}>Toplam Sipariş</Text>
                      <Text style={styles.metaValue}>{customer.totalOrders ?? '-'}</Text>
                    </View>
                    <View style={[styles.metaBox, styles.metaBoxWide]}>
                      <Text style={styles.metaLabel}>Toplam Harcama</Text>
                      <Text style={styles.metaValueStrong}>
                        {typeof customer.totalSpent === 'number' ? `${customer.totalSpent.toFixed(2)} TL` : '-'}
                      </Text>
                    </View>
                  </View>

                  {customer.createdAt ? (
                    <Text style={styles.registeredText}>Kayıt: {formatDate(customer.createdAt)}</Text>
                  ) : null}
                </View>
              ))
            : null}

          {!loading && filtered.length === 0 ? (
            <Text style={styles.emptyText}>Henüz müşteri bulunmuyor.</Text>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  pageTitle: { color: '#111827', fontSize: 38, lineHeight: 42, fontWeight: '700', fontFamily: 'Roboto' },
  pageSubtitle: { marginTop: 4, color: '#4B5563', fontSize: 13, lineHeight: 18, fontFamily: 'Roboto' },
  refreshBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: { color: '#111827', fontSize: 14, lineHeight: 16, fontFamily: 'Roboto' },
  searchInput: {
    marginTop: 10,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: '#111827',
    fontFamily: 'Roboto',
  },
  totalText: { marginTop: 10, color: '#4B5563', fontSize: 13, lineHeight: 18, fontFamily: 'Roboto' },
  listWrap: {
    marginTop: 10,
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  listHeader: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 12 },
  listHeaderText: { color: '#111827', fontSize: 18, lineHeight: 22, fontWeight: '700', fontFamily: 'Roboto' },
  listContent: { padding: 10, gap: 10, paddingBottom: 22 },
  customerCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  customerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { color: '#15803D', fontSize: 14, fontWeight: '700', fontFamily: 'Roboto' },
  customerName: { color: '#111827', fontSize: 19, lineHeight: 24, fontWeight: '700', fontFamily: 'Roboto' },
  customerEmail: { color: '#374151', fontSize: 13, lineHeight: 18, fontFamily: 'Roboto' },
  metaGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaBox: {
    width: '48.5%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaBoxWide: { width: '100%' },
  metaLabel: { color: '#6B7280', fontSize: 12, lineHeight: 16, fontFamily: 'Roboto' },
  metaValue: { marginTop: 2, color: '#1F2937', fontSize: 13, lineHeight: 17, fontWeight: '500', fontFamily: 'Roboto' },
  metaValueStrong: { marginTop: 2, color: '#111827', fontSize: 13, lineHeight: 17, fontWeight: '700', fontFamily: 'Roboto' },
  registeredText: { marginTop: 8, color: '#6B7280', fontSize: 12, lineHeight: 16, fontFamily: 'Roboto' },
  emptyText: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    textAlign: 'center',
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Roboto',
    paddingVertical: 18,
  },
  skeletonCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5ECE7',
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skeletonLineSub: { marginTop: 6 },
  skeletonGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skeletonBox: {
    width: '48.5%',
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7EEE9',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  skeletonBoxWide: { width: '100%' },
  skeletonBoxValue: { marginTop: 6 },
});

