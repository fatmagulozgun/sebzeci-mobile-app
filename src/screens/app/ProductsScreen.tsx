import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUpDown, Check, ChevronDown, Plus, ShoppingCart, SlidersHorizontal } from 'lucide-react-native';
import apiClient from '../../services/apiClient';
import { useCart } from '../../context/cartContext';
import { getBottomSafePadding } from '../../theme/layout';
import SkeletonBlock from '../../components/common/SkeletonBlock';
import { formatProductUnit } from '../../utils/productUnit';
import useModalBackDismiss from '../../hooks/useModalBackDismiss';

type Category = {
  name?: string;
};

type Product = {
  id: string;
  name: string;
  category?: Category;
  price?: number | string;
  stock?: number | string;
  imageUrl?: string;
  unit?: string;
  customUnit?: string;
};
type SkeletonProduct = Product & { __skeleton: true };

type SortOption = '' | 'priceAsc' | 'priceDesc' | 'popular';
type SheetType = null | 'filter' | 'sort';

const DEFAULT_CATEGORIES = ['Sebze', 'Meyve', 'Yeşillik'];

const normalizeCategoryKey = (value: string) =>
  value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getCategoryIcon = (name: string) => {
  const normalized = normalizeCategoryKey(name || '');
  if (normalized.includes('sebze')) return '🥬';
  if (normalized.includes('meyve')) return '🍎';
  if (normalized.includes('yesillik')) return '🧺';
  if (normalized.includes('patates')) return '🥔';
  return '🛒';
};

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [allCategoryNames, setAllCategoryNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const addToCartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedQuickCategories, setSelectedQuickCategories] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>('');
  const [sheet, setSheet] = useState<SheetType>(null);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [burstProductId, setBurstProductId] = useState<string | null>(null);
  const { dismissKeyboardOrClose: dismissKeyboardOrCloseSheet } = useModalBackDismiss({
    enabled: sheet !== null,
    onClose: () => setSheet(null),
  });

  useEffect(() => {
    const fetchProducts = async () => {
      const currentRequestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const { data } = await apiClient.get('/products', {
          params: {
            ...(searchQuery ? { search: searchQuery } : {}),
            ...(selectedCategory ? { category: selectedCategory } : {}),
          },
        });
        if (currentRequestId !== requestIdRef.current) return;
        const list = (data?.data || []) as Product[];
        setProducts(Array.isArray(list) ? list : []);
      } catch {
        if (currentRequestId !== requestIdRef.current) return;
        setProducts([]);
      } finally {
        if (currentRequestId !== requestIdRef.current) return;
        setLoading(false);
      }
    };

    fetchProducts();
  }, [searchQuery, selectedCategory]);

  const categories = useMemo(() => {
    const source = allCategoryNames.length > 0 ? allCategoryNames : DEFAULT_CATEGORIES;
    const categoryMap = new Map<string, string>();

    source.forEach(name => {
      const key = normalizeCategoryKey(name);
      if (!categoryMap.has(key)) {
        categoryMap.set(key, name);
      }
    });

    return Array.from(categoryMap.values());
  }, [allCategoryNames]);

  useEffect(() => {
    const fetchAllCategories = async () => {
      try {
        const { data } = await apiClient.get('/products');
        const names = ((data?.data || []) as Product[]).map(item => item.category?.name?.trim()).filter(Boolean) as string[];
        setAllCategoryNames(Array.from(new Set(names)));
      } catch {
        setAllCategoryNames([]);
      }
    };

    fetchAllCategories();
  }, []);

  useEffect(() => {
    return () => {
      if (addToCartTimerRef.current) {
        clearTimeout(addToCartTimerRef.current);
      }
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const selectedQuickCategoryKeys = selectedQuickCategories.map(name => normalizeCategoryKey(name));
    const quickFilteredProducts =
      selectedQuickCategoryKeys.length === 0
        ? products
        : products.filter(product => {
            const productCategoryKey = normalizeCategoryKey(product.category?.name || '');
            return selectedQuickCategoryKeys.includes(productCategoryKey);
          });

    const sorted = [...quickFilteredProducts];
    if (sort === 'priceAsc') {
      sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sort === 'priceDesc') {
      sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sort === 'popular') {
      sorted.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
    }
    return sorted;
  }, [products, selectedQuickCategories, sort]);
  const skeletonProducts = useMemo<SkeletonProduct[]>(
    () =>
      Array.from({ length: 6 }).map((_, index) => ({
        id: `skeleton-${index}`,
        name: '',
        __skeleton: true,
      })),
    [],
  );

  const filterLabel = selectedCategory || 'Filtrele';
  const sortLabel =
    sort === 'priceAsc'
      ? 'Fiyat artan'
      : sort === 'priceDesc'
        ? 'Fiyat azalan'
        : sort === 'popular'
          ? 'En popüler'
          : 'Siralama';

  const handleAddToCart = (product: Product) => {
    if (Number(product.stock || 0) < 1) return;
    addItem(product, 1);
    setAddedProductId(product.id);
    setBurstProductId(product.id);
    if (addToCartTimerRef.current) clearTimeout(addToCartTimerRef.current);
    addToCartTimerRef.current = setTimeout(() => {
      setAddedProductId(null);
      setBurstProductId(null);
    }, 1500);
  };

  const renderProductCard = ({ item }: { item: Product | SkeletonProduct }) => {
    if ('__skeleton' in item) {
      return (
        <View style={[styles.card, styles.skeletonCard]}>
          <View style={styles.imageContainer}>
            <SkeletonBlock width="74%" height={96} borderRadius={18} tone="green" />
          </View>
          <View style={styles.cardBody}>
            <SkeletonBlock width="72%" height={17} borderRadius={8} />
            <SkeletonBlock width="44%" height={12} borderRadius={999} style={styles.skeletonSubtitle} />
            <SkeletonBlock width="60%" height={22} borderRadius={8} tone="green" style={styles.skeletonPrice} />
            <SkeletonBlock width={78} height={24} borderRadius={999} tone="green" style={styles.skeletonStock} />
          </View>
          <SkeletonBlock height={42} borderRadius={12} tone="button" style={styles.skeletonButton} />
        </View>
      );
    }

    const price = Number(item.price || 0).toFixed(2);
    const inStock = Number(item.stock || 0) > 0;
    const unit = formatProductUnit(item);

    return (
      <View style={styles.card}>
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="contain" />
          ) : (
            <View style={styles.fallbackImage}>
              <Text style={styles.fallbackInitial}>{(item.name || '?').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.productCategory} numberOfLines={1}>
            {item.category?.name || 'Kategori yok'}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>{price} TL</Text>
            <Text style={styles.priceUnit}>/{unit}</Text>
          </View>

          <View style={styles.stockBadge}>
            <View style={styles.stockDot} />
            <Text style={[styles.stockText, !inStock && styles.stockTextMuted]}>{inStock ? 'Stokta' : 'Tükendi'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addToCartButton, addedProductId === item.id && styles.addedButton, !inStock && styles.addToCartButtonDisabled]}
          activeOpacity={0.9}
          onPress={() => handleAddToCart(item)}
          disabled={!inStock}
        >
          {addedProductId === item.id ? (
            <>
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.addToCartText}>Sepete eklendi</Text>
            </>
          ) : (
            <>
              <ShoppingCart size={16} color="#FFFFFF" />
              <Plus size={16} color="#FFFFFF" />
              {burstProductId === item.id ? <Text style={styles.addBurstText}>+1</Text> : null}
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={loading ? skeletonProducts : visibleProducts}
        keyExtractor={item => item.id}
        renderItem={renderProductCard}
        numColumns={2}
        stickyHeaderIndices={[0]}
        contentContainerStyle={[styles.listContent, { paddingBottom: getBottomSafePadding(insets.bottom, 10) }]}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <View style={styles.stickyHeader}>
              <Text style={styles.title}>Ürün Listesi</Text>

              <TextInput
                style={styles.searchInput}
                placeholder="Ürün ara..."
                placeholderTextColor="#9CA3AF"
                value={searchInput}
                onChangeText={next => {
                  setSearchInput(next);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  searchDebounceRef.current = setTimeout(() => {
                    setSearchQuery(next.trim());
                  }, 250);
                }}
              />

              <View style={styles.dropdownRow}>
                <TouchableOpacity style={styles.dropdown} onPress={() => setSheet('filter')} activeOpacity={0.85}>
                  <SlidersHorizontal size={16} color="#94A3B8" />
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {filterLabel}
                  </Text>
                  <ChevronDown size={18} color="#334155" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.dropdown} onPress={() => setSheet('sort')} activeOpacity={0.85}>
                  <ArrowUpDown size={16} color="#94A3B8" />
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {sortLabel}
                  </Text>
                  <ChevronDown size={18} color="#334155" />
                </TouchableOpacity>
              </View>

              <FlatList
                data={categories}
                keyExtractor={item => item}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
                renderItem={({ item }) => {
                  const active = selectedQuickCategories.some(name => normalizeCategoryKey(name) === normalizeCategoryKey(item));
                  return (
                    <TouchableOpacity
                      style={[styles.categoryPill, active && styles.categoryPillActive]}
                      onPress={() =>
                        setSelectedQuickCategories(current => {
                          const exists = current.some(name => normalizeCategoryKey(name) === normalizeCategoryKey(item));
                          if (exists) {
                            return current.filter(name => normalizeCategoryKey(name) !== normalizeCategoryKey(item));
                          }
                          return [...current, item];
                        })
                      }
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                        {getCategoryIcon(item)} {item}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            {!loading && visibleProducts.length === 0 ? <Text style={styles.helperText}>Ürün bulunamadi.</Text> : null}
          </View>
        }
      />

      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={dismissKeyboardOrCloseSheet}>
        <Pressable style={styles.modalOverlay} onPress={() => setSheet(null)}>
          <View style={styles.modalCard}>
            {sheet === 'filter' ? (
              <>
                <Text style={styles.modalTitle}>Filtrele</Text>
                <TouchableOpacity style={styles.modalOption} onPress={() => setSelectedCategory('')}>
                  <Text style={styles.modalOptionText}>Tüm kategoriler</Text>
                </TouchableOpacity>
                {categories.map(name => (
                  <TouchableOpacity
                    key={name}
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedCategory(name);
                      setSheet(null);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Sıralama</Text>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setSort('');
                    setSheet(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>Varsayılan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setSort('priceAsc');
                    setSheet(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>Fiyat artan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setSort('priceDesc');
                    setSheet(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>Fiyat azalan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setSort('popular');
                    setSheet(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>En popüler</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerSection: {
    marginBottom: 12,
  },
  stickyHeader: {
    backgroundColor: '#F3F4F6',
    paddingTop: 10,
    paddingBottom: 10,
    zIndex: 10,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Roboto',
  },
  searchInput: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Roboto',
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  dropdown: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  dropdownText: {
    flex: 1,
    color: '#475569',
    fontSize: 16,
    fontFamily: 'Roboto',
  },
  categoryRow: {
    marginTop: 10,
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  categoryPillActive: {
    borderColor: '#15803D',
    backgroundColor: '#15803D',
  },
  categoryText: {
    color: '#475569',
    fontSize: 15,
    fontFamily: 'Roboto',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  helperText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Roboto',
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 14,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  skeletonCard: {
    borderColor: '#E5ECE7',
    shadowOpacity: 0.05,
  },
  imageContainer: {
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '88%',
    height: '88%',
  },
  fallbackImage: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackInitial: {
    color: '#15803D',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  skeletonSubtitle: {
    marginTop: 8,
  },
  skeletonPrice: {
    marginTop: 10,
  },
  skeletonStock: {
    marginTop: 10,
  },
  skeletonButton: {
    marginTop: 9,
  },
  cardBody: {
    marginTop: 10,
  },
  productName: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  productCategory: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Roboto',
  },
  priceRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  priceText: {
    color: '#16A34A',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    fontFamily: 'Roboto',
  },
  priceUnit: {
    marginBottom: 3,
    color: '#9CA3AF',
    fontSize: 16,
    fontFamily: 'Roboto',
  },
  stockBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stockDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  stockText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  stockTextMuted: {
    color: '#6B7280',
  },
  addToCartButton: {
    marginTop: 10,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addToCartButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  addedButton: {
    backgroundColor: '#16A34A',
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  addBurstText: {
    position: 'absolute',
    top: -8,
    right: 10,
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Roboto',
    marginBottom: 8,
  },
  modalOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalOptionText: {
    color: '#334155',
    fontSize: 15,
    fontFamily: 'Roboto',
  },
});
