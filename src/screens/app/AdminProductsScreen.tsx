import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { Check, Grid2x2, List, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react-native';
import apiClient from '../../services/apiClient';
import { showAppToast } from '../../context/toastContext';
import { getBottomSafePadding } from '../../theme/layout';
import BottomSafeArea from '../../components/layout/BottomSafeArea';
import SkeletonBlock from '../../components/common/SkeletonBlock';
import { formatProductUnit } from '../../utils/productUnit';
import useModalBackDismiss from '../../hooks/useModalBackDismiss';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price?: number;
  stock?: number;
  unit?: string;
  customUnit?: string | null;
  isActive?: boolean;
  category?: { id?: string; name?: string };
};

type Option = { id: string; name: string };
const DEFAULT_UNITS = ['kg', 'adet', 'paket', 'gr', 'ml', 'lt'] as const;
const defaultUnitOptions: Option[] = DEFAULT_UNITS.map(name => ({ id: `default-${name}`, name }));
const INPUT_PLACEHOLDER_COLOR = '#94A3B8';

type ProductForm = {
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  stock: string;
  unit: string;
  categoryName: string;
};

const initialForm: ProductForm = {
  name: '',
  description: '',
  imageUrl: '',
  price: '',
  stock: '',
  unit: '',
  categoryName: '',
};

const categoryFilters = [
  { id: 'ALL', label: 'Tümü' },
  { id: 'FRUIT', label: 'Meyve' },
  { id: 'VEGETABLE', label: 'Sebze' },
  { id: 'GREEN', label: 'Yeşillik' },
] as const;

const stockFilters = [
  { id: 'LOW', label: 'Stok Azalan' },
  { id: 'OUT', label: 'Stok Biten' },
] as const;

type CategoryQuickFilter = (typeof categoryFilters)[number]['id'];
type StockQuickFilter = 'ALL' | (typeof stockFilters)[number]['id'];
type StatCardTone = 'default' | 'warning' | 'danger' | 'success';

export default function AdminProductsScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [units, setUnits] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [categoryQuickFilter, setCategoryQuickFilter] = useState<CategoryQuickFilter>('ALL');
  const [stockQuickFilter, setStockQuickFilter] = useState<StockQuickFilter>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [inlinePriceEditId, setInlinePriceEditId] = useState<string | null>(null);
  const [inlinePriceDraft, setInlinePriceDraft] = useState('');
  const stockAdjustStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stockAdjustTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const hasSelection = selectedIds.length > 0;
  const selectionTransition = useRef(new Animated.Value(0)).current;
  const [deleteConfirmState, setDeleteConfirmState] = useState<null | { mode: 'single'; product: Product } | { mode: 'bulk' }>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deactivateCandidates, setDeactivateCandidates] = useState<Product[]>([]);
  const [deactivating, setDeactivating] = useState(false);

  const [form, setForm] = useState<ProductForm>(initialForm);
  const [editForm, setEditForm] = useState<ProductForm>(initialForm);
  const [customCategoryEnabled, setCustomCategoryEnabled] = useState(false);
  const [customUnitEnabled, setCustomUnitEnabled] = useState(false);
  const [editCustomCategoryEnabled, setEditCustomCategoryEnabled] = useState(false);
  const [editCustomUnitEnabled, setEditCustomUnitEnabled] = useState(false);

  const [pickerModal, setPickerModal] = useState<null | 'filterCategory' | 'createCategory' | 'createUnit' | 'editCategory' | 'editUnit'>(null);
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const stickyButtonBottom = Math.max(insets.bottom, 0) + 2;
  const listBottomPadding = stickyButtonBottom + 72;
  const { dismissKeyboardOrClose: dismissCreateModalOrKeyboard } = useModalBackDismiss({
    enabled: createModalOpen,
    onClose: () => setCreateModalOpen(false),
  });
  const { dismissKeyboardOrClose: dismissEditModalOrKeyboard } = useModalBackDismiss({
    enabled: Boolean(editingProduct),
    onClose: () => setEditingProduct(null),
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/products');
      const list = Array.isArray(data?.data) ? data.data : [];
      setProducts(list);
    } catch {
      setProducts([]);
      showAppToast('Ürünler alınamadı', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await apiClient.get('/admin/categories');
      const rows = Array.isArray(data?.data) ? data.data : [];
      setCategories(rows.map((item: any) => ({ id: String(item?.id || ''), name: String(item?.name || '') })));
    } catch {
      setCategories([]);
    }
  };

  const fetchUnits = async () => {
    try {
      const { data } = await apiClient.get('/admin/units');
      const rows = Array.isArray(data?.data) ? data.data : [];
      const remoteUnits = rows.map((item: any) => ({ id: String(item?.id || ''), name: String(item?.name || '').toLowerCase() }));
      const merged = [...defaultUnitOptions];
      remoteUnits.forEach((item: any) => {
        if (!merged.some(unit => unit.name === item.name)) merged.push(item);
      });
      setUnits(merged);
    } catch {
      setUnits(defaultUnitOptions);
    }
  };

  const refreshAll = React.useCallback(async () => {
    await Promise.all([fetchProducts(), fetchCategories(), fetchUnits()]);
  }, []);

  const handlePullToRefresh = React.useCallback(async () => {
    if (loading || refreshing) return;
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [loading, refreshing, refreshAll]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    Animated.timing(selectionTransition, {
      toValue: hasSelection ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hasSelection, selectionTransition]);

  const stopStockAdjust = () => {
    if (stockAdjustStartRef.current) {
      clearTimeout(stockAdjustStartRef.current);
      stockAdjustStartRef.current = null;
    }
    if (stockAdjustTimerRef.current) {
      clearInterval(stockAdjustTimerRef.current);
      stockAdjustTimerRef.current = null;
    }
  };

  useEffect(() => stopStockAdjust, []);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const outOfStock = products.filter(p => Number(p.stock || 0) <= 0).length;
    const lowStock = products.filter(p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 10).length;
    const totalCategories = new Set(products.map(p => p.category?.name).filter(Boolean)).size;
    const totalStock = products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    return { totalProducts, outOfStock, lowStock, totalCategories, totalStock };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products.filter(product => {
      const categoryName = String(product.category?.name || '').toLowerCase();
      const bySearch = query
        ? `${product.name || ''} ${categoryName} ${formatProductUnit(product)}`.toLowerCase().includes(query)
        : true;
      const byCategory = filterCategory ? product.category?.name === filterCategory : true;
      const stock = Number(product.stock || 0);
      const byCategoryQuick =
        categoryQuickFilter === 'ALL'
          ? true
          : categoryQuickFilter === 'FRUIT'
            ? categoryName.includes('meyve')
            : categoryQuickFilter === 'VEGETABLE'
              ? categoryName.includes('sebze')
              : categoryName.includes('yeşillik') || categoryName.includes('yesillik');
      const byStockQuick =
        stockQuickFilter === 'ALL'
          ? true
          : stockQuickFilter === 'LOW'
            ? stock > 0 && stock <= 10
            : stock <= 0;
      return bySearch && byCategory && byCategoryQuick && byStockQuick;
    });
  }, [categoryQuickFilter, filterCategory, products, searchTerm, stockQuickFilter]);

  const resetCreateForm = () => {
    setForm(initialForm);
    setCustomCategoryEnabled(false);
    setCustomUnitEnabled(false);
  };

  const openEdit = (product: Product) => {
    const nextUnit = product.customUnit || String(product.unit || '').toLowerCase();
    const nextCategoryName = String(product.category?.name || '');
    setEditingProduct(product);
    setEditForm({
      name: String(product.name || ''),
      description: String(product.description || ''),
      imageUrl: String(product.imageUrl || ''),
      price: String(product.price ?? ''),
      stock: String(product.stock ?? ''),
      unit: nextUnit,
      categoryName: nextCategoryName,
    });
    setEditCustomUnitEnabled(Boolean(nextUnit) && !units.some(u => u.name === nextUnit.toLowerCase()));
    setEditCustomCategoryEnabled(Boolean(nextCategoryName) && !categories.some(c => c.name === nextCategoryName));
  };

  const pickImage = async (mode: 'create' | 'edit') => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: true,
        quality: 0.8,
        maxWidth: 640,
        maxHeight: 640,
      });

      if (result.didCancel || result.errorCode) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      const nextImage = asset.base64 ? `data:${asset.type || 'image/jpeg'};base64,${asset.base64}` : asset.uri || '';
      if (!nextImage) return;

      if (mode === 'edit') setEditForm(prev => ({ ...prev, imageUrl: nextImage }));
      else setForm(prev => ({ ...prev, imageUrl: nextImage }));
    } catch {
      showAppToast('Görsel seçilemedi', 'error');
    }
  };

  const handleCreate = async () => {
    const normalizedName = String(form.name || '').trim().toLowerCase();
    if (products.some(p => String(p.name || '').trim().toLowerCase() === normalizedName)) {
      showAppToast('Zaten böyle bir ürün var', 'error');
      return;
    }
    try {
      await apiClient.post('/products', {
        ...form,
        imageUrl: form.imageUrl || null,
        categoryName: String(form.categoryName || '').trim(),
        unit: String(form.unit || '').trim().toLowerCase(),
        price: Number(form.price || 0),
        stock: Number(form.stock || 0),
      });
      showAppToast('Ürün eklendi', 'success');
      setCreateModalOpen(false);
      resetCreateForm();
      refreshAll();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Ürün eklenemedi';
      showAppToast(message, 'error');
    }
  };

  const getUpdatePayload = (product: Product, overrides?: Partial<{ price: number; stock: number; name: string }>) => ({
    name: String(overrides?.name ?? product.name ?? '').trim(),
    description: String(product.description || ''),
    imageUrl: product.imageUrl || null,
    categoryName: String(product.category?.name || '').trim(),
    unit: String(product.customUnit || product.unit || '').trim().toLowerCase(),
    price: Number(overrides?.price ?? product.price ?? 0),
    stock: Number(overrides?.stock ?? product.stock ?? 0),
  });

  const handleUpdate = async () => {
    if (!editingProduct?.id) return;
    try {
      await apiClient.patch(`/products/${editingProduct.id}`, {
        ...editForm,
        imageUrl: editForm.imageUrl || null,
        categoryName: String(editForm.categoryName || '').trim(),
        unit: String(editForm.unit || '').trim().toLowerCase(),
        price: Number(editForm.price || 0),
        stock: Number(editForm.stock || 0),
      });
      showAppToast('Ürün güncellendi', 'success');
      setEditingProduct(null);
      refreshAll();
    } catch {
      showAppToast('Ürün güncellenemedi', 'error');
    }
  };

  const executeDelete = async (product: Product) => {
    if (!product?.id) return;
    try {
      const checkRes = await apiClient.get(`/products/${product.id}/delete-check`);
      const canDelete = Boolean(checkRes?.data?.data?.canDelete);
      if (!canDelete) {
        setDeactivateCandidates([product]);
        return;
      }
      await apiClient.delete(`/products/${product.id}`);
      showAppToast('Ürün silindi', 'success');
      refreshAll();
    } catch (error: any) {
      showAppToast(error?.response?.data?.message || 'Ürün silinemedi', 'error');
    }
  };

  const handleDelete = (product: Product) => {
    if (!product?.id) return;
    setDeleteConfirmState({ mode: 'single', product });
  };

  const handleActivateProduct = async (product: Product) => {
    if (!product?.id) return;
    try {
      await apiClient.patch(`/products/${product.id}/activate`);
      showAppToast('Ürün aktife alındı', 'success');
      refreshAll();
    } catch (error: any) {
      showAppToast(error?.response?.data?.message || 'Ürün aktife alınamadı', 'error');
    }
  };

  const executeBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const conflict: Product[] = [];
    let deletedCount = 0;
    try {
      for (const id of selectedIds) {
        const checkRes = await apiClient.get(`/products/${id}/delete-check`);
        const canDelete = Boolean(checkRes?.data?.data?.canDelete);
        if (!canDelete) {
          const found = products.find(p => p.id === id);
          if (found) conflict.push(found);
          continue;
        }
        await apiClient.delete(`/products/${id}`);
        deletedCount += 1;
      }

      if (conflict.length > 0) {
        setSelectedIds(conflict.map(p => p.id));
        setDeactivateCandidates(conflict);
        if (deletedCount > 0) showAppToast(`${deletedCount} ürün silindi`, 'success');
        return;
      }

      showAppToast('Seçilen ürünler silindi', 'success');
      setSelectedIds([]);
      refreshAll();
    } catch (error: any) {
      showAppToast(error?.response?.data?.message || 'Toplu silme sırasında hata oluştu', 'error');
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setDeleteConfirmState({ mode: 'bulk' });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmState) return;
    const snapshot = deleteConfirmState;
    setDeleteConfirmState(null);
    if (snapshot.mode === 'single') {
      await executeDelete(snapshot.product);
      return;
    }
    await executeBulkDelete();
  };

  const handleDeactivateProduct = async () => {
    if (deactivateCandidates.length === 0 || deactivating) return;
    setDeactivating(true);
    try {
      const ids = deactivateCandidates.map(p => p.id).filter(Boolean);
      for (const id of ids) {
        await apiClient.patch(`/products/${id}/deactivate`);
      }
      showAppToast('Ürün(ler) pasife alındı', 'success');
      setDeactivateCandidates([]);
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
      refreshAll();
    } catch (error: any) {
      showAppToast(error?.response?.data?.message || 'Pasife alınamadı', 'error');
    } finally {
      setDeactivating(false);
    }
  };

  const handleInlineStockChange = async (product: Product, nextStock: number) => {
    if (!product?.id) return;
    try {
      await apiClient.patch(`/products/${product.id}`, getUpdatePayload(product, { stock: Math.max(0, nextStock) }));
      refreshAll();
    } catch (error: any) {
      showAppToast(error?.response?.data?.message || 'Stok güncellenemedi', 'error');
    }
  };

  const startStockAdjust = (product: Product, direction: -1 | 1) => {
    stopStockAdjust();
    let nextStock = Number(product.stock || 0) + direction;
    handleInlineStockChange(product, nextStock);
    stockAdjustStartRef.current = setTimeout(() => {
      stockAdjustTimerRef.current = setInterval(() => {
        nextStock += direction;
        handleInlineStockChange(product, nextStock);
      }, 130);
    }, 250);
  };

  const handleInlinePriceSave = async (product: Product) => {
    if (!product?.id || inlinePriceEditId !== product.id) return;
    const nextPrice = Number(String(inlinePriceDraft || '').replace(',', '.'));
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      showAppToast('Geçerli bir fiyat girin', 'error');
      return;
    }
    try {
      await apiClient.patch(`/products/${product.id}`, getUpdatePayload(product, { price: nextPrice }));
      setInlinePriceEditId(null);
      setInlinePriceDraft('');
      showAppToast('Fiyat güncellendi', 'success');
      refreshAll();
    } catch (error: any) {
      showAppToast(error?.response?.data?.message || 'Fiyat güncellenemedi', 'error');
    }
  };

  const handleBulkStockIncrease = async () => {
    if (selectedIds.length === 0) return;
    try {
      for (const id of selectedIds) {
        const product = products.find(p => p.id === id);
        if (!product) continue;
        await apiClient.patch(`/products/${product.id}`, getUpdatePayload(product, { stock: Number(product.stock || 0) + 1 }));
      }
      showAppToast('Seçili ürünlerin stoku +1 artırıldı', 'success');
      refreshAll();
    } catch (error: any) {
      showAppToast(error?.response?.data?.message || 'Toplu stok güncelleme başarısız', 'error');
    }
  };

  const deleteCategoryOption = async (categoryId: string) => {
    try {
      await apiClient.delete(`/admin/categories/${categoryId}`);
      showAppToast('Kategori silindi', 'success');
      fetchCategories();
    } catch (error: any) {
      showAppToast(error?.response?.data?.message || 'Kategori silinemedi', 'error');
    }
  };

  const deleteUnitOption = async (unitId: string) => {
    if (unitId.startsWith('default-')) return;
    try {
      await apiClient.delete(`/admin/units/${unitId}`);
      showAppToast('Birim silindi', 'success');
      fetchUnits();
    } catch (error: any) {
      showAppToast(error?.response?.data?.message || 'Birim silinemedi', 'error');
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const isGrid = viewMode === 'grid';
    const isSelected = selectedIds.includes(item.id);
    const stock = Number(item.stock || 0);
    const isCritical = stock < 20;
    const isWarning = stock >= 20 && stock < 50;
    const stockStateLabel = isCritical ? 'KRITIK' : isWarning ? 'AZALIYOR' : 'STOK IYI';
    const stockStateColor = isCritical ? '#DC2626' : isWarning ? '#D97706' : '#16A34A';
    const unitLabel = formatProductUnit(item);
    const stockText = `${stock} ${unitLabel}`;
    const unitText = `/ ${unitLabel}`;
    const isInlinePriceEditing = inlinePriceEditId === item.id;
    const categoryNameLower = String(item.category?.name || '').toLowerCase();
    const fallbackIcon = categoryNameLower.includes('meyve') ? '🍎' : categoryNameLower.includes('sebze') ? '🥕' : '🧺';
    if (!isGrid) {
      return (
        <Pressable
          onPress={() => {
            if (selectedIds.length > 0) {
              setSelectedIds(prev => (prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]));
            }
          }}
          onLongPress={() =>
            setSelectedIds(prev => (prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]))
          }
          delayLongPress={220}
          style={[styles.productCard, styles.productCardList, isSelected && styles.productCardSelected]}
        >
          <View style={styles.listRow}>
            <View style={styles.thumbBlock}>
              <View style={styles.thumbWrap}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbFallbackWrap}>
                    <Package size={20} color="#94A3B8" />
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.checkboxOverlaySoft, isSelected && styles.checkboxChecked]}
                onPress={() =>
                  setSelectedIds(prev => (prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]))
                }
              >
                {isSelected ? <Check size={10} color="#fff" /> : null}
              </TouchableOpacity>
            </View>

            <View style={styles.listInfoCol}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productMeta}>{item.category?.name || 'Kategori yok'}</Text>
              {isInlinePriceEditing ? (
                <TextInput
                  value={inlinePriceDraft}
                  onChangeText={setInlinePriceDraft}
                  keyboardType="decimal-pad"
                  style={[styles.inlinePriceInput, styles.inlinePriceInputList]}
                  placeholder="Fiyat"
                  placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => handleInlinePriceSave(item)}
                  onBlur={() => handleInlinePriceSave(item)}
                />
              ) : (
                <TouchableOpacity
                  style={styles.inlinePriceTrigger}
                  onPress={() => {
                    setInlinePriceEditId(item.id);
                    setInlinePriceDraft(Number(item.price || 0).toFixed(2));
                  }}
                >
                  <Text style={styles.productPriceList}>{Number(item.price || 0).toFixed(2)} TL</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.priceUnitText}>{unitText}</Text>
            </View>

            <View style={styles.listRightCol}>
              <View style={[styles.stockMiniPill, { borderColor: `${stockStateColor}55`, backgroundColor: `${stockStateColor}15` }]}>
                <View style={[styles.stockStateDot, { backgroundColor: stockStateColor }]} />
                <Text style={[styles.stockMiniText, { color: stockStateColor }]}>{stockText}</Text>
              </View>
              <View style={styles.listActionsRow}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
                  <Pencil size={17} color="#475569" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}>
                  <Trash2 size={17} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={() => {
          if (selectedIds.length > 0) {
            setSelectedIds(prev => (prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]));
          }
        }}
        onLongPress={() =>
          setSelectedIds(prev => (prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]))
        }
        delayLongPress={220}
        style={[styles.productCard, isGrid && styles.productCardGrid, isSelected && styles.productCardSelected]}
      >
        {!isGrid ? (
          <View style={styles.productTopRow}>
            <View style={[styles.stockBadge, { backgroundColor: `${stockStateColor}20` }]}>
              <View style={[styles.stockStateDot, { backgroundColor: stockStateColor }]} />
              <Text style={[styles.stockBadgeText, { color: stockStateColor }]}>{stockStateLabel}</Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.productRow, isGrid && styles.productRowGrid]}>
          <View style={[styles.thumbBlock, isGrid && styles.thumbBlockGrid]}>
            <View style={[styles.thumbWrap, isGrid && styles.thumbWrapGrid]}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              ) : (
                <View style={styles.thumbFallbackWrap}>
                  <Package size={22} color="#94A3B8" />
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.checkboxOverlaySoft, isSelected && styles.checkboxChecked]}
              onPress={() =>
                setSelectedIds(prev => (prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]))
              }
            >
              {isSelected ? <Check size={10} color="#fff" /> : null}
            </TouchableOpacity>
            <View style={styles.stockBadgeOverlay}>
              <View style={[styles.stockStateDot, { backgroundColor: stockStateColor }]} />
              <Text style={[styles.stockBadgeText, { color: stockStateColor }]}>{stockStateLabel}</Text>
            </View>
          </View>
          <View style={[styles.productInfo, isGrid && styles.productInfoGrid]}>
            <Text style={[styles.productName, isGrid && styles.productNameGrid]}>{item.name}</Text>
            <Text style={[styles.productMeta, isGrid && styles.productMetaGrid]}>{item.category?.name || 'Kategori yok'}</Text>
            {isInlinePriceEditing ? (
              <TextInput
                value={inlinePriceDraft}
                onChangeText={setInlinePriceDraft}
                keyboardType="decimal-pad"
                style={styles.inlinePriceInput}
                placeholder="Fiyat"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => handleInlinePriceSave(item)}
                onBlur={() => handleInlinePriceSave(item)}
              />
            ) : (
              <TouchableOpacity
                style={styles.inlinePriceTrigger}
                onPress={() => {
                  setInlinePriceEditId(item.id);
                  setInlinePriceDraft(Number(item.price || 0).toFixed(2));
                }}
              >
                <Text style={[styles.productPrice, isGrid && styles.productPriceGrid]}>{Number(item.price || 0).toFixed(2)} TL</Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.priceUnitText, isGrid && styles.priceUnitTextGrid]}>{unitText}</Text>
            {!isGrid && item.isActive === false ? <Text style={styles.passiveTag}>Pasif</Text> : null}
          </View>
        </View>

        <View style={[styles.productBottomRow, styles.productBottomRowGrid]}>
          <View style={[styles.productActions, styles.productActionsGridOnly]}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
              <Pencil size={17} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}>
              <Trash2 size={17} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderProductSkeleton = (_: unknown, idx: number) => (
    <View key={`skeleton-${idx}`} style={[styles.productCard, styles.productCardList, styles.skeletonProductCard]}>
      <View style={styles.listRow}>
        <SkeletonBlock width={56} height={56} borderRadius={12} tone="green" />
        <View style={{ flex: 1 }}>
          <SkeletonBlock width="70%" height={16} borderRadius={8} />
          <SkeletonBlock width="42%" height={11} borderRadius={999} style={styles.skeletonLineGapSmall} />
          <SkeletonBlock width="52%" height={23} borderRadius={8} tone="green" style={styles.skeletonLineGap} />
          <SkeletonBlock width="20%" height={9} borderRadius={999} style={styles.skeletonLineGapTiny} />
        </View>
        <View style={styles.skeletonRightCol}>
          <SkeletonBlock width={70} height={24} borderRadius={999} tone="green" />
          <View style={styles.skeletonIconRow}>
            <SkeletonBlock width={30} height={30} borderRadius={8} />
            <SkeletonBlock width={30} height={30} borderRadius={8} />
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.toolbar, isHeaderCompact && styles.toolbarCompact]}>
        <View style={styles.toolbarTopRow}>
          <View style={[styles.searchWrap, styles.searchWrapInline]}>
            <Search size={16} color="#9ca3af" />
            <TextInput
              placeholder="Ürün, kategori, birim ara..."
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.searchInput}
            />
          </View>
          <View style={styles.viewToggleWrapInline}>
            <TouchableOpacity
              onPress={() => setViewMode('list')}
              style={[styles.viewToggleBtnInline, viewMode === 'list' && styles.viewToggleBtnInlineActive]}
            >
              <List size={16} color={viewMode === 'list' ? '#166534' : '#94A3B8'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('grid')}
              style={[styles.viewToggleBtnInline, viewMode === 'grid' && styles.viewToggleBtnInlineActive]}
            >
              <Grid2x2 size={16} color={viewMode === 'grid' ? '#166534' : '#94A3B8'} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {categoryFilters.map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setCategoryQuickFilter(item.id)}
              style={[styles.filterChip, categoryQuickFilter === item.id && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, categoryQuickFilter === item.id && styles.filterChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.stockFiltersRow}>
          <Text style={styles.stockFiltersLabel}>STOK :</Text>
          {stockFilters.map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setStockQuickFilter(prev => (prev === item.id ? 'ALL' : item.id))}
              style={[styles.stockFilterChip, stockQuickFilter === item.id && styles.stockFilterChipActive]}
            >
              <View style={[styles.stockFilterDot, stockQuickFilter === item.id && styles.stockFilterDotActive]} />
              <Text style={[styles.stockFilterText, stockQuickFilter === item.id && styles.stockFilterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.selectionInfoSlot}>
          <Animated.View
            pointerEvents={hasSelection ? 'auto' : 'none'}
            style={[
              styles.selectionInfoBar,
              {
                opacity: selectionTransition,
                transform: [
                  {
                    translateY: selectionTransition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-2, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.selectionInfoChip}>
              <Check size={12} color="#15803D" />
              <Text style={styles.selectionInfoText}>{selectedIds.length} ürün seçildi</Text>
            </View>
            <TouchableOpacity style={styles.selectionDeleteBtn} onPress={handleBulkDelete} disabled={!hasSelection}>
              <Trash2 size={13} color="#B91C1C" />
              <Text style={styles.selectionDeleteText}>Sil</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {Array.from({ length: 6 }).map(renderProductSkeleton)}
          <BottomSafeArea />
        </ScrollView>
      ) : (
        <FlatList
          key={viewMode}
          data={filteredProducts}
          keyExtractor={item => item.id}
          renderItem={renderProduct}
          numColumns={viewMode === 'grid' ? 2 : 1}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent }) => {
            const offsetY = nativeEvent.contentOffset.y;
            const nextCompact = offsetY > 24;
            if (nextCompact !== isHeaderCompact) setIsHeaderCompact(nextCompact);
          }}
          scrollEventThrottle={16}
          refreshing={refreshing}
          onRefresh={handlePullToRefresh}
          ListEmptyComponent={<Text style={styles.emptyText}>Ürün bulunamadı</Text>}
          ListFooterComponent={<BottomSafeArea />}
        />
      )}

      <TouchableOpacity
        style={[styles.stickyCreateBtn, { bottom: stickyButtonBottom }]}
        onPress={() => {
          resetCreateForm();
          setCreateModalOpen(true);
        }}
      >
        <Plus size={18} color="#fff" />
        <Text style={styles.stickyCreateBtnText}>Yeni Ürün Ekle</Text>
      </TouchableOpacity>

      <Modal
        visible={createModalOpen}
        transparent
        animationType="slide"
        onRequestClose={dismissCreateModalOrKeyboard}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCreateModalOpen(false)}>
          <Pressable style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Yeni Ürün</Text><TouchableOpacity onPress={() => setCreateModalOpen(false)}><X size={18} color="#111827" /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.input}
                placeholder="Ürün adı"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                value={form.name}
                onChangeText={v => setForm(p => ({ ...p, name: v }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Açıklama"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                value={form.description}
                onChangeText={v => setForm(p => ({ ...p, description: v }))}
              />
              <View style={styles.imageRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage('create')}><Text style={styles.secondaryBtnText}>Görsel Seç</Text></TouchableOpacity>
                {form.imageUrl ? <Image source={{ uri: form.imageUrl }} style={styles.preview} /> : <View style={styles.preview} />}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Fiyat"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                keyboardType="decimal-pad"
                value={form.price}
                onChangeText={v => setForm(p => ({ ...p, price: v }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Stok"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                keyboardType="number-pad"
                value={form.stock}
                onChangeText={v => setForm(p => ({ ...p, stock: v }))}
              />
              <TouchableOpacity style={styles.inputPicker} onPress={() => setPickerModal('createCategory')}>
                <Text style={styles.inputPickerText}>{customCategoryEnabled ? `Yeni: ${form.categoryName || '-'}` : form.categoryName || 'Kategori seçin'}</Text>
              </TouchableOpacity>
              {customCategoryEnabled ? (
                <TextInput
                  style={styles.input}
                  placeholder="Yeni kategori"
                  placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                  value={form.categoryName}
                  onChangeText={v => setForm(p => ({ ...p, categoryName: v }))}
                />
              ) : null}
              <TouchableOpacity style={styles.inputPicker} onPress={() => setPickerModal('createUnit')}>
                <Text style={styles.inputPickerText}>{customUnitEnabled ? `Yeni: ${form.unit || '-'}` : form.unit || 'Birim seçin'}</Text>
              </TouchableOpacity>
              {customUnitEnabled ? (
                <TextInput
                  style={styles.input}
                  placeholder="Yeni birim"
                  placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                  value={form.unit}
                  onChangeText={v => setForm(p => ({ ...p, unit: v }))}
                />
              ) : null}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalOpen(false)}><Text style={styles.cancelText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}><Text style={styles.saveText}>Ürün Ekle</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(editingProduct)}
        transparent
        animationType="slide"
        onRequestClose={dismissEditModalOrKeyboard}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingProduct(null)}>
          <Pressable style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Ürün Güncelle</Text><TouchableOpacity onPress={() => setEditingProduct(null)}><X size={18} color="#111827" /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.input}
                placeholder="Ürün adı"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                value={editForm.name}
                onChangeText={v => setEditForm(p => ({ ...p, name: v }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Açıklama"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                value={editForm.description}
                onChangeText={v => setEditForm(p => ({ ...p, description: v }))}
              />
              <View style={styles.imageRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage('edit')}><Text style={styles.secondaryBtnText}>Görsel Seç</Text></TouchableOpacity>
                {editForm.imageUrl ? <Image source={{ uri: editForm.imageUrl }} style={styles.preview} /> : <View style={styles.preview} />}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Fiyat"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                keyboardType="decimal-pad"
                value={editForm.price}
                onChangeText={v => setEditForm(p => ({ ...p, price: v }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Stok"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                keyboardType="number-pad"
                value={editForm.stock}
                onChangeText={v => setEditForm(p => ({ ...p, stock: v }))}
              />
              <TouchableOpacity style={styles.inputPicker} onPress={() => setPickerModal('editCategory')}>
                <Text style={styles.inputPickerText}>{editCustomCategoryEnabled ? `Yeni: ${editForm.categoryName || '-'}` : editForm.categoryName || 'Kategori seçin'}</Text>
              </TouchableOpacity>
              {editCustomCategoryEnabled ? (
                <TextInput
                  style={styles.input}
                  placeholder="Yeni kategori"
                  placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                  value={editForm.categoryName}
                  onChangeText={v => setEditForm(p => ({ ...p, categoryName: v }))}
                />
              ) : null}
              <TouchableOpacity style={styles.inputPicker} onPress={() => setPickerModal('editUnit')}>
                <Text style={styles.inputPickerText}>{editCustomUnitEnabled ? `Yeni: ${editForm.unit || '-'}` : editForm.unit || 'Birim seçin'}</Text>
              </TouchableOpacity>
              {editCustomUnitEnabled ? (
                <TextInput
                  style={styles.input}
                  placeholder="Yeni birim"
                  placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                  value={editForm.unit}
                  onChangeText={v => setEditForm(p => ({ ...p, unit: v }))}
                />
              ) : null}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingProduct(null)}><Text style={styles.cancelText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}><Text style={styles.saveText}>Kaydet</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={deactivateCandidates.length > 0} transparent animationType="fade" onRequestClose={() => setDeactivateCandidates([])}>
        <Pressable style={styles.modalOverlay} onPress={() => setDeactivateCandidates([])}>
          <Pressable style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Ürünü Pasife Al</Text>
            <Text style={styles.confirmText}>Siparişte kullanılmış ürün(ler) silinemez. Pasife alalım mı?</Text>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeactivateCandidates([])}><Text style={styles.cancelText}>Hayır</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleDeactivateProduct} disabled={deactivating}>
                <Text style={styles.saveText}>{deactivating ? 'Bekleyin...' : 'Evet'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={deleteConfirmState !== null} transparent animationType="fade" onRequestClose={() => setDeleteConfirmState(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteConfirmState(null)}>
          <Pressable style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Silme Onayı</Text>
            <Text style={styles.confirmText}>
              {deleteConfirmState?.mode === 'single'
                ? 'Bu ürünü silmek istediğinize emin misiniz?'
                : `Seçili ${selectedIds.length} ürünü silmek istediğinize emin misiniz?`}
            </Text>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteConfirmState(null)}>
                <Text style={styles.cancelText}>Hayır</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleConfirmDelete}>
                <Text style={styles.saveText}>Evet</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={pickerModal !== null} transparent animationType="fade" onRequestClose={() => setPickerModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerModal(null)}>
          <Pressable style={styles.pickerCard}>
            {pickerModal === 'filterCategory' ? (
              <>
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    setFilterCategory('');
                    setPickerModal(null);
                  }}
                >
                  <Text style={styles.pickerText}>Tümü</Text>
                </TouchableOpacity>
                {categories.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.pickerRow}
                    onPress={() => {
                      setFilterCategory(item.name);
                      setPickerModal(null);
                    }}
                  >
                    <Text style={styles.pickerText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : pickerModal?.includes('Category') ? (
              <>
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    if (pickerModal === 'createCategory') {
                      setCustomCategoryEnabled(true);
                      setForm(prev => ({ ...prev, categoryName: '' }));
                    } else {
                      setEditCustomCategoryEnabled(true);
                      setEditForm(prev => ({ ...prev, categoryName: '' }));
                    }
                    setPickerModal(null);
                  }}
                >
                  <Text style={styles.pickerText}>Diğer (elle gir)</Text>
                </TouchableOpacity>
                {categories.map(item => (
                  <View key={item.id} style={styles.pickerLine}>
                    <TouchableOpacity
                      style={[styles.pickerRow, { flex: 1 }]}
                      onPress={() => {
                        if (pickerModal === 'createCategory') {
                          setCustomCategoryEnabled(false);
                          setForm(prev => ({ ...prev, categoryName: item.name }));
                        } else {
                          setEditCustomCategoryEnabled(false);
                          setEditForm(prev => ({ ...prev, categoryName: item.name }));
                        }
                        setPickerModal(null);
                      }}
                    >
                      <Text style={styles.pickerText}>{item.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteCategoryOption(item.id)} style={styles.deleteSmallBtn}>
                      <Trash2 size={14} color="#b91c1c" />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    if (pickerModal === 'createUnit') {
                      setCustomUnitEnabled(true);
                      setForm(prev => ({ ...prev, unit: '' }));
                    } else {
                      setEditCustomUnitEnabled(true);
                      setEditForm(prev => ({ ...prev, unit: '' }));
                    }
                    setPickerModal(null);
                  }}
                >
                  <Text style={styles.pickerText}>Diğer (elle gir)</Text>
                </TouchableOpacity>
                {units.map(item => (
                  <View key={item.id} style={styles.pickerLine}>
                    <TouchableOpacity
                      style={[styles.pickerRow, { flex: 1 }]}
                      onPress={() => {
                        if (pickerModal === 'createUnit') {
                          setCustomUnitEnabled(false);
                          setForm(prev => ({ ...prev, unit: item.name }));
                        } else {
                          setEditCustomUnitEnabled(false);
                          setEditForm(prev => ({ ...prev, unit: item.name }));
                        }
                        setPickerModal(null);
                      }}
                    >
                      <Text style={styles.pickerText}>{item.name}</Text>
                    </TouchableOpacity>
                    {item.id.startsWith('default-') ? null : (
                      <TouchableOpacity onPress={() => deleteUnitOption(item.id)} style={styles.deleteSmallBtn}>
                        <Trash2 size={14} color="#b91c1c" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  title: { fontSize: 30, fontWeight: '800', color: '#111827', fontFamily: 'Roboto', marginTop: 8, marginBottom: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  statCard: { width: '31%', minWidth: 100, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 10 },
  statCard_default: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  statCard_warning: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  statCard_danger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  statCard_success: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  statLabel: { color: '#6b7280', fontSize: 11, fontFamily: 'Roboto' },
  statLabel_default: { color: '#6B7280' },
  statLabel_warning: { color: '#B45309' },
  statLabel_danger: { color: '#B91C1C' },
  statLabel_success: { color: '#15803D' },
  statValue: { marginTop: 4, fontSize: 20, fontWeight: '700', color: '#111827', fontFamily: 'Roboto' },
  statValue_default: { color: '#111827' },
  statValue_warning: { color: '#92400E' },
  statValue_danger: { color: '#991B1B' },
  statValue_success: { color: '#166534' },
  toolbar: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 7,
    marginBottom: 6,
  },
  toolbarCompact: { paddingTop: 12, paddingBottom: 7 },
  toolbarTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  searchWrapInline: { flex: 1 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', fontFamily: 'Roboto' },
  filtersRow: { marginTop: 8, gap: 8, paddingVertical: 2 },
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6 },
  filterChipActive: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  filterChipText: { fontSize: 12, color: '#374151', fontFamily: 'Roboto' },
  filterChipTextActive: { color: '#166534', fontWeight: '700' },
  stockFiltersRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockFiltersLabel: { color: '#94A3B8', fontSize: 20, letterSpacing: 0.8, fontWeight: '800', fontFamily: 'Roboto' },
  stockFilterChip: {
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockFilterChipActive: { borderColor: '#22C55E', backgroundColor: '#ECFDF5' },
  stockFilterDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#CBD5E1' },
  stockFilterDotActive: { backgroundColor: '#16A34A' },
  stockFilterText: { color: '#64748B', fontSize: 12, fontWeight: '700', fontFamily: 'Roboto' },
  stockFilterTextActive: { color: '#166534' },
  selectionInfoSlot: { height: 28, marginTop: 7, justifyContent: 'center' },
  selectionInfoBar: {
    height: 27,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE9DF',
    backgroundColor: '#FAFBFA',
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionInfoChip: {
    height: 23,
    borderRadius: 999,
    paddingHorizontal: 9,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BFECCD',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  selectionInfoText: { color: '#14532D', fontSize: 11, fontWeight: '800', fontFamily: 'Roboto' },
  selectionDeleteBtn: {
    height: 23,
    borderRadius: 999,
    paddingHorizontal: 9,
    backgroundColor: '#FFF8F8',
    borderWidth: 1,
    borderColor: '#F3CCCC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectionDeleteText: { color: '#B91C1C', fontSize: 11, fontWeight: '800', fontFamily: 'Roboto' },
  viewToggleWrap: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
    padding: 3,
    gap: 3,
  },
  viewToggleBtn: {
    minWidth: 72,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
  },
  viewToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#16A34A',
  },
  viewToggleText: { color: '#64748B', fontSize: 12, fontWeight: '600', fontFamily: 'Roboto' },
  viewToggleTextActive: { color: '#14532D', fontWeight: '800' },
  viewToggleWrapInline: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewToggleBtnInline: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnInlineActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  stickyCreateBtn: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 18,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#15803D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  stickyCreateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', fontFamily: 'Roboto' },
  listContent: { paddingVertical: 6, gap: 6, paddingBottom: 128 },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 20, fontFamily: 'Roboto' },
  skeletonProductCard: {
    borderWidth: 1,
    borderColor: '#E5ECE7',
    backgroundColor: '#FFFFFF',
  },
  skeletonLineGapSmall: { marginTop: 6 },
  skeletonLineGap: { marginTop: 8 },
  skeletonLineGapTiny: { marginTop: 4 },
  skeletonRightCol: { width: 90, alignItems: 'flex-end', gap: 8 },
  skeletonIconRow: { flexDirection: 'row', gap: 2 },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  productCardGrid: { flex: 1, minWidth: 0, padding: 0, overflow: 'hidden', minHeight: 286 },
  productCardSelected: {
    backgroundColor: '#F6FEF9',
    borderColor: '#A7E8BC',
    shadowColor: '#15803D',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  productCardList: { paddingVertical: 10, paddingHorizontal: 18 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listInfoCol: { flex: 1, minWidth: 0 },
  listRightCol: { width: 122, alignItems: 'flex-end', gap: 3 },
  stockDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockMiniPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockMiniText: { fontSize: 12, fontWeight: '700', fontFamily: 'Roboto' },
  listActionsRow: { flexDirection: 'row', gap: 2 },
  productTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stockStateDot: { width: 8, height: 8, borderRadius: 999 },
  stockBadgeText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.2, fontFamily: 'Roboto' },
  productRow: { marginTop: 4, flexDirection: 'row', gap: 10, alignItems: 'center' },
  productRowGrid: { flexDirection: 'column', gap: 0 },
  thumbBlock: { position: 'relative' },
  thumbBlockGrid: { width: '100%' },
  thumbWrap: { width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbWrapGrid: { width: '100%', height: 154, borderRadius: 0, borderWidth: 0 },
  checkboxOverlay: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOverlaySoft: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: 'rgba(248,250,252,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
    zIndex: 5,
  },
  gridQuickActions: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockBadgeOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(248,250,252,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.98)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  gridIconBtn: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridIconBtnDanger: { backgroundColor: 'rgba(255,255,255,0.84)' },
  thumb: { width: '100%', height: '100%' },
  thumbFallbackWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' },
  thumbFallback: { color: '#64748B', fontSize: 18, fontWeight: '800', fontFamily: 'Roboto' },
  productInfo: { flex: 1, paddingRight: 8 },
  productInfoGrid: { flex: 1, paddingHorizontal: 12, paddingTop: 12, paddingRight: 12, paddingBottom: 10, alignItems: 'center' },
  productName: { color: '#111827', fontWeight: '800', fontSize: 16, lineHeight: 21, fontFamily: 'Roboto' },
  productMeta: { marginTop: 2, color: '#94A3B8', fontSize: 12, lineHeight: 15, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Roboto' },
  productPrice: { marginTop: 6, color: '#0F172A', fontWeight: '900', fontSize: 32, lineHeight: 34, fontFamily: 'Roboto' },
  productNameGrid: { textAlign: 'center' },
  productMetaGrid: { textAlign: 'center' },
  productPriceGrid: { color: '#166534', fontSize: 28, lineHeight: 31, textAlign: 'center' },
  productPriceList: { marginTop: 3, color: '#166534', fontWeight: '900', fontSize: 22, lineHeight: 25, fontFamily: 'Roboto' },
  priceUnitTextGrid: { textAlign: 'center' },
  priceUnitText: { marginTop: 1, color: '#94A3B8', fontSize: 10, fontWeight: '700', fontFamily: 'Roboto' },
  inlinePriceTrigger: { marginTop: 3 },
  inlinePriceInput: {
    marginTop: 6,
    width: 130,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    color: '#166534',
    fontFamily: 'Roboto',
    fontSize: 17,
    fontWeight: '800',
  },
  inlinePriceInputList: { marginTop: 2, width: 96, height: 32, fontSize: 14, paddingHorizontal: 8 },
  productBottomRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  productBottomRowGrid: { paddingHorizontal: 12, paddingBottom: 14, marginTop: 12, justifyContent: 'center' },
  stockStepperWrap: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 4,
    height: 30,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stockStepperWrapCompact: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 4,
    height: 30,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stockStepperWrapGrid: { marginLeft: 'auto', width: 96, maxWidth: '58%', flexShrink: 1 },
  stockStepperControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperBtn: {
    width: 20,
    height: 20,
    borderRadius: 7,
    borderWidth: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { color: '#64748B', fontSize: 18, lineHeight: 18, textAlign: 'center', fontWeight: '700', includeFontPadding: false, fontFamily: 'Roboto' },
  stepperTextPlus: { transform: [{ translateY: -0.5 }] },
  stepperValue: { minWidth: 32, textAlign: 'center', color: '#1F2937', fontSize: 19, fontWeight: '800', fontFamily: 'Roboto' },
  stepperValueCompact: { minWidth: 28, textAlign: 'center', color: '#0F172A', fontSize: 16, fontWeight: '800', fontFamily: 'Roboto' },
  passiveTag: { marginTop: 2, color: '#b45309', fontSize: 11, fontWeight: '700', fontFamily: 'Roboto' },
  productActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  productActionsGrid: { justifyContent: 'space-between' },
  productActionsGridOnly: { justifyContent: 'center', gap: 16 },
  activateBtn: { borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', paddingHorizontal: 10, height: 30, justifyContent: 'center' },
  activateText: { color: '#15803d', fontSize: 12, fontWeight: '700', fontFamily: 'Roboto' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 0, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { backgroundColor: 'transparent' },
  skeletonBlock: { backgroundColor: '#E5E7EB', borderRadius: 8 },
  skeletonCheckbox: { width: 22, height: 22, borderRadius: 7 },
  skeletonStockPill: { width: 44, height: 22, borderRadius: 999 },
  skeletonThumb: { width: 52, height: 52, borderRadius: 12 },
  skeletonName: { width: '68%', height: 14 },
  skeletonMeta: { marginTop: 6, width: '48%', height: 12 },
  skeletonPrice: { marginTop: 8, width: '34%', height: 14 },
  skeletonActionBtn: { width: 34, height: 32, borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 14 },
  modalCard: { maxHeight: '88%', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', padding: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { color: '#111827', fontSize: 18, fontWeight: '700', fontFamily: 'Roboto' },
  input: { height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', paddingHorizontal: 12, color: '#111827', fontFamily: 'Roboto', marginBottom: 8 },
  inputPicker: { height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', paddingHorizontal: 12, justifyContent: 'center', marginBottom: 8 },
  inputPickerText: { color: '#374151', fontFamily: 'Roboto', fontSize: 14 },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  secondaryBtn: { height: 36, borderRadius: 9, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: '#1f2937', fontSize: 13, fontFamily: 'Roboto' },
  preview: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  cancelBtn: { height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', paddingHorizontal: 14, justifyContent: 'center' },
  cancelText: { color: '#374151', fontWeight: '600', fontFamily: 'Roboto' },
  saveBtn: { height: 36, borderRadius: 10, backgroundColor: '#15803d', paddingHorizontal: 14, justifyContent: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontFamily: 'Roboto' },
  confirmCard: { borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', padding: 14 },
  confirmTitle: { color: '#111827', fontSize: 18, fontWeight: '700', fontFamily: 'Roboto' },
  confirmText: { marginTop: 6, color: '#4b5563', fontSize: 14, fontFamily: 'Roboto' },
  pickerCard: { borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', maxHeight: '70%' },
  pickerLine: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  pickerRow: { paddingVertical: 11, paddingHorizontal: 12 },
  pickerText: { color: '#334155', fontSize: 14, fontFamily: 'Roboto' },
  deleteSmallBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: '#fef2f2' },
  gridRow: { gap: 8 },
});

