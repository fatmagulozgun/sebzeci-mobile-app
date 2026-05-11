import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { ArrowRight, Leaf, Minus, Plus, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/apiClient';
import { useCart, type CartProduct } from '../../context/cartContext';
import { showAppToast } from '../../context/toastContext';
import SkeletonBlock from '../../components/common/SkeletonBlock';

const SHIPPING_TEXT = 'Ücretsiz';

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const { items, subtotal, addItem, removeItem, changeQuantity, clearCart } = useCart();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [popularProducts, setPopularProducts] = useState<CartProduct[]>([]);
  const [loadingPopularProducts, setLoadingPopularProducts] = useState(true);

  const itemCount = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [items]);
  const averageUnitPrice = itemCount > 0 ? subtotal / itemCount : 0;
  const total = subtotal;
  const isCompact = width < 390;
  const isEmptyCart = items.length === 0;
  const suggestedCardWidth = Math.max(220, Math.min(250, Math.round(width * 0.78)));

  const suggestedProducts = useMemo(() => {
    const inCartIds = new Set(items.map(item => item.id));
    return popularProducts.filter(product => !inCartIds.has(product.id)).slice(0, 8);
  }, [items, popularProducts]);

  useEffect(() => {
    const fetchPopularProducts = async () => {
      setLoadingPopularProducts(true);
      try {
        const { data } = await apiClient.get('/products');
        const list = Array.isArray(data?.data) ? data.data : [];
        const sorted = [...list].sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
        setPopularProducts(sorted);
      } catch {
        setPopularProducts([]);
      } finally {
        setLoadingPopularProducts(false);
      }
    };

    fetchPopularProducts();
  }, []);

  const handleCreateOrder = async () => {
    if (items.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.post('/orders', {
        items: items.map(item => ({ productId: item.id, quantity: item.quantity })),
        note,
      });
      clearCart();
      setNote('');
      showAppToast('Siparişin oluşturuldu.', 'success');
    } catch {
      showAppToast('Sipariş oluşturulamadı.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderSuggestedItem = ({ item }: { item: CartProduct }) => (
    <View style={[styles.suggestedCard, { width: suggestedCardWidth }]}>
      <View style={styles.suggestedImageWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.suggestedImage} resizeMode="contain" />
        ) : (
          <Text style={styles.fallbackEmoji}>🥕</Text>
        )}
      </View>
      <Text style={styles.suggestedName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.suggestedCategory}>{item.category?.name || 'Sebze'}</Text>
      <View style={styles.suggestedPriceRow}>
        <Text style={styles.suggestedPrice}>{Number(item.price || 0).toFixed(2)} TL</Text>
        <Text style={styles.suggestedUnit}>/kg</Text>
      </View>
      <TouchableOpacity style={styles.quickAddButton} activeOpacity={0.9} onPress={() => addItem(item, 1)}>
        <Text style={styles.quickAddText}>+ Sepete ekle</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSuggestedSkeleton = (_: { item: { id: string } }) => (
    <View style={[styles.suggestedCard, styles.suggestedSkeletonCard, { width: suggestedCardWidth }]}>
      <View style={styles.suggestedImageWrap}>
        <SkeletonBlock width="64%" height={58} borderRadius={18} tone="green" />
      </View>
      <SkeletonBlock width="62%" height={16} borderRadius={8} style={styles.skeletonName} />
      <SkeletonBlock width="38%" height={12} borderRadius={999} style={styles.skeletonCategory} />
      <SkeletonBlock width="54%" height={23} borderRadius={8} tone="green" style={styles.skeletonPrice} />
      <SkeletonBlock height={34} borderRadius={8} tone="button" style={styles.skeletonButton} />
    </View>
  );

  if (isEmptyCart) {
    return (
      <View style={styles.screen}>
        <View style={styles.emptyHero}>
          <Text style={styles.emptyTitle}>Sepetin şu an{'\n'}boş görünüyor!</Text>
          <Text style={styles.emptySubtitle}>Taze meyve ve sebzeleri keşfet, alışverişe hemen başla.</Text>
          <TouchableOpacity style={styles.emptyPrimaryButton} onPress={() => navigation.navigate('Products')}>
            <Text style={styles.emptyPrimaryText}>Alışverişe Başla →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.emptySecondaryButton} onPress={() => navigation.navigate('Products')}>
            <Leaf size={14} color="#15803D" />
            <Text style={styles.emptySecondaryText}>Öne Çıkanlar</Text>
          </TouchableOpacity>
          <View style={styles.emptyImageBox}>
            <View style={styles.emptyImageSurface}>
              <Image source={require('../../images/sepet.png')} style={styles.emptyImage} resizeMode="contain" />
            </View>
          </View>
        </View>

        <View style={styles.suggestedSection}>
          <Text style={styles.suggestedTitle}>Senin için seçtiklerimiz</Text>
          {loadingPopularProducts ? (
            <FlatList
              horizontal
              data={Array.from({ length: 4 }).map((_, index) => ({ id: `skeleton-${index}` }))}
              keyExtractor={item => item.id}
              renderItem={renderSuggestedSkeleton}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestedList}
            />
          ) : (
            <>
              {suggestedProducts.length === 0 ? <Text style={styles.helperText}>Öneri bulunamadı.</Text> : null}
              <FlatList
                horizontal
                data={suggestedProducts}
                keyExtractor={item => item.id}
                renderItem={renderSuggestedItem}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestedList}
                snapToInterval={suggestedCardWidth + 12}
                snapToAlignment="start"
                decelerationRate="fast"
                disableIntervalMomentum
              />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {items.map(item => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={styles.itemImageWrap}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="contain" />
              ) : (
                <Text style={styles.fallbackEmoji}>🥬</Text>
              )}
            </View>
            <View style={styles.itemBody}>
              <View style={styles.itemHead}>
                <View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemCategory}>{item.category?.name || 'Sebze'}</Text>
                </View>
                <TouchableOpacity style={styles.deleteButton} onPress={() => removeItem(item.id)}>
                  <Trash2 size={14} color="#6B7280" />
                  <Text style={styles.deleteText}>Sil</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.itemFooter}>
                <View style={styles.qtyControl}>
                  <TouchableOpacity onPress={() => changeQuantity(item.id, -1)}>
                    <Minus size={16} color="#475569" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => changeQuantity(item.id, 1)}>
                    <Plus size={16} color="#475569" />
                  </TouchableOpacity>
                </View>
                <View>
                  <Text style={styles.priceMeta}>{Number(item.price || 0).toFixed(2)} TL / kg</Text>
                  <Text style={styles.itemPrice}>{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)} TL</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ))}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Sipariş Özeti</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Ara Toplam</Text>
          <Text style={styles.summaryValue}>{subtotal.toFixed(2)} TL</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Teslimat</Text>
          <Text style={styles.summaryShipping}>{SHIPPING_TEXT}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Ortalama Birim Fiyat</Text>
          <Text style={styles.summaryValue}>{averageUnitPrice.toFixed(2)} TL</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Toplam</Text>
          <Text style={[styles.totalValue, isCompact && styles.totalValueCompact]}>{total.toFixed(2)} TL</Text>
        </View>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteLabel}>Sipariş Notu (opsiyonel)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          placeholder="Örn: Domatesler biraz sert olsun, kapıya bırakabilirsiniz."
          placeholderTextColor="#9CA3AF"
          style={styles.noteInput}
        />
        <TouchableOpacity style={styles.submitButton} onPress={handleCreateOrder} disabled={submitting}>
          <Text style={styles.submitText}>{submitting ? 'Sipariş oluşturuluyor...' : 'Siparişi Tamamla'}</Text>
          {!submitting ? <ArrowRight size={16} color="#FFFFFF" /> : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingTop: 12,
    gap: 12,
  },
  emptyHero: {
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 15,
    overflow: 'hidden',
  },
  emptyTitle: {
    color: '#052E16',
    fontSize: 35,
    lineHeight: 42,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  emptySubtitle: {
    marginTop: 10,
    color: '#4B5563',
    fontSize: 16,
    lineHeight: 23,
    fontFamily: 'Roboto',
  },
  emptyPrimaryButton: {
    marginTop: 14,
    borderRadius: 10,
    height: 44,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  emptySecondaryButton: {
    marginTop: 11,
    borderRadius: 10,
    height: 44,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  emptySecondaryText: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  emptyImageBox: {
    marginTop: 11,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#F0FDF4',
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  emptyImageSurface: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#F8FFF9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyImage: {
    width: '100%',
    height: 155,
  },
  suggestedSection: {
    marginTop: 0,
  },
  suggestedTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Roboto',
    marginBottom: 10,
  },
  suggestedList: {
    gap: 12,
    paddingBottom: 1,
    paddingRight: 8,
  },
  suggestedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: '#EEF2F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  suggestedSkeletonCard: {
    borderColor: '#E5ECE7',
    shadowOpacity: 0.05,
  },
  suggestedImageWrap: {
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestedImage: {
    width: '90%',
    height: '90%',
  },
  fallbackEmoji: {
    fontSize: 36,
  },
  skeletonName: {
    marginTop: 8,
  },
  skeletonCategory: {
    marginTop: 6,
  },
  skeletonPrice: {
    marginTop: 8,
  },
  skeletonButton: {
    marginTop: 9,
  },
  suggestedName: {
    marginTop: 8,
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Roboto',
  },
  suggestedCategory: {
    marginTop: 1,
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  suggestedPriceRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  suggestedPrice: {
    color: '#16A34A',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
    fontFamily: 'Roboto',
  },
  suggestedUnit: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 4,
    fontFamily: 'Roboto',
  },
  quickAddButton: {
    marginTop: 9,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  helperText: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 8,
    fontFamily: 'Roboto',
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
  },
  itemImageWrap: {
    width: 74,
    height: 74,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: '90%',
    height: '90%',
  },
  itemBody: {
    flex: 1,
    gap: 10,
  },
  itemHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemName: {
    color: '#1F2937',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  itemCategory: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Roboto',
  },
  deleteButton: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Roboto',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  qtyControl: {
    minWidth: 110,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  qtyText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  priceMeta: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'right',
    fontFamily: 'Roboto',
  },
  itemPrice: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 1,
    fontFamily: 'Roboto',
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#ECFDF5',
    padding: 14,
  },
  summaryTitle: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Roboto',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#475569',
    fontSize: 16,
    fontFamily: 'Roboto',
  },
  summaryValue: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  summaryShipping: {
    color: '#15803D',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  summaryDivider: {
    borderTopWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 6,
    paddingTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  totalLabel: {
    color: '#475569',
    fontSize: 16,
    fontFamily: 'Roboto',
  },
  totalValue: {
    color: '#111827',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    fontFamily: 'Roboto',
  },
  totalValueCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
  noteCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  noteLabel: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Roboto',
    marginBottom: 8,
  },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minHeight: 88,
    textAlignVertical: 'top',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#334155',
    fontSize: 15,
    fontFamily: 'Roboto',
  },
  submitButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
});
