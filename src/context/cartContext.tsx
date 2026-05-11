import React, { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import apiClient from '../services/apiClient';
import { getStoredSession } from '../services/authService';

export type ProductCategory = {
  name?: string;
};

export type CartProduct = {
  id: string;
  name: string;
  category?: ProductCategory;
  price?: number | string;
  stock?: number | string;
  imageUrl?: string;
};

export type CartItem = CartProduct & {
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: CartProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  changeQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export function CartProvider({ children }: Props) {
  const [items, setItems] = useState<CartItem[]>([]);
  const itemsRef = useRef<CartItem[]>([]);
  const quantityRequestSeqRef = useRef(0);
  const latestQuantitySeqByProductRef = useRef<Record<string, number>>({});
  const quantitySyncTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const quantityDesiredRef = useRef<Record<string, number>>({});
  const quantityInFlightRef = useRef<Record<string, boolean>>({});
  const normalizeCartItems = React.useCallback(
    (serverItems: any[]): CartItem[] =>
      (Array.isArray(serverItems) ? serverItems : []).map((item: any) => ({
        ...item,
        id: String(item?.id ?? ''),
        quantity: Math.max(1, Number(item?.quantity || 1)),
      })),
    [],
  );

  const mergeServerItemsPreserveOrder = React.useCallback(
    (incomingItems: CartItem[], previousItems: CartItem[]): CartItem[] => {
      const incomingById = new Map(incomingItems.map(item => [String(item.id), item]));
      const ordered = previousItems
        .map(prev => incomingById.get(String(prev.id)))
        .filter(Boolean) as CartItem[];
      const alreadyIncluded = new Set(ordered.map(item => String(item.id)));
      const newcomers = incomingItems.filter(item => !alreadyIncluded.has(String(item.id)));
      return [...ordered, ...newcomers];
    },
    [],
  );

  const syncQuantityToServer = React.useCallback(
    (productId: string) => {
      if (quantityInFlightRef.current[productId]) {
        return;
      }

      const desiredQuantity = quantityDesiredRef.current[productId];
      if (!Number.isFinite(desiredQuantity)) {
        return;
      }

      quantityInFlightRef.current[productId] = true;
      const seq = ++quantityRequestSeqRef.current;
      latestQuantitySeqByProductRef.current[productId] = seq;

      apiClient
        .patch(`/cart/items/${productId}`, { quantity: desiredQuantity })
        .then(({ data }) => {
          if (latestQuantitySeqByProductRef.current[productId] !== seq) {
            return;
          }
          if (quantityDesiredRef.current[productId] !== desiredQuantity) {
            return;
          }
          const serverItems = Array.isArray(data?.data) ? data.data : [];
          setItems(current => mergeServerItemsPreserveOrder(normalizeCartItems(serverItems), current));
        })
        .catch(() => {})
        .finally(() => {
          quantityInFlightRef.current[productId] = false;
          if (quantityDesiredRef.current[productId] !== desiredQuantity) {
            syncQuantityToServer(productId);
          }
        });
    },
    [mergeServerItemsPreserveOrder, normalizeCartItems],
  );

  const scheduleQuantitySync = React.useCallback(
    (productId: string, nextQuantity: number) => {
      quantityDesiredRef.current[productId] = nextQuantity;
      const timer = quantitySyncTimerRef.current[productId];
      if (timer) {
        clearTimeout(timer);
      }
      quantitySyncTimerRef.current[productId] = setTimeout(() => {
        syncQuantityToServer(productId);
      }, 120);
    },
    [syncQuantityToServer],
  );

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    let active = true;
    const hydrateFromServer = async () => {
      try {
        const session = await getStoredSession();
        if (!session?.token) return;
        const { data } = await apiClient.get('/cart');
        if (!active) return;
        const serverItems = Array.isArray(data?.data) ? data.data : [];
        setItems(current => mergeServerItemsPreserveOrder(normalizeCartItems(serverItems), current));
      } catch {
        if (!active) return;
      }
    };
    hydrateFromServer();
    return () => {
      active = false;
    };
  }, [mergeServerItemsPreserveOrder, normalizeCartItems]);

  React.useEffect(() => {
    return () => {
      Object.values(quantitySyncTimerRef.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const addItem = (product: CartProduct, quantity = 1) => {
    const productId = String(product.id);
    setItems(current => {
      const existing = current.find(item => String(item.id) === productId);
      const stockLimit = Math.max(Number(product.stock || 0), 1);
      if (existing) {
        return current.map(item =>
          String(item.id) === productId
            ? {
                ...item,
                quantity: Math.min(item.quantity + quantity, stockLimit),
              }
            : item,
        );
      }

      return [
        ...current,
        {
          ...product,
          id: productId,
          quantity: Math.min(Math.max(quantity, 1), stockLimit),
        },
      ];
    });

    apiClient
      .post('/cart/items', { productId: product.id, quantity })
      .then(({ data }) => {
        const serverItems = Array.isArray(data?.data) ? data.data : [];
        setItems(current => mergeServerItemsPreserveOrder(normalizeCartItems(serverItems), current));
      })
      .catch(() => {});
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const normalizedProductId = String(productId);
    const existingItem = itemsRef.current.find(item => String(item.id) === normalizedProductId);
    if (!existingItem) {
      return;
    }
    const next = Math.max(1, Math.floor(quantity));
    const stockLimit = Math.max(Number(existingItem.stock || 0), 1);
    const bounded = Math.min(next, stockLimit);
    setItems(current =>
      current.map(item => {
        if (String(item.id) !== normalizedProductId) return item;
        return {
          ...item,
          quantity: bounded,
        };
      }),
    );
    scheduleQuantitySync(normalizedProductId, bounded);
  };

  const changeQuantity = (productId: string, delta: number) => {
    const normalizedProductId = String(productId);
    const existingItem = itemsRef.current.find(item => String(item.id) === normalizedProductId);
    if (!existingItem) {
      return;
    }
    const stockLimit = Math.max(Number(existingItem.stock || 0), 1);
    const nextQuantity = Math.min(Math.max(existingItem.quantity + delta, 1), stockLimit);
    setItems(current =>
      current.map(item => {
        if (String(item.id) !== normalizedProductId) return item;
        return {
          ...item,
          quantity: nextQuantity,
        };
      }),
    );
    scheduleQuantitySync(normalizedProductId, nextQuantity);
  };

  const removeItem = (productId: string) => {
    const normalizedProductId = String(productId);
    setItems(current => current.filter(item => String(item.id) !== normalizedProductId));

    apiClient
      .delete(`/cart/items/${normalizedProductId}`)
      .then(({ data }) => {
        const serverItems = Array.isArray(data?.data) ? data.data : [];
        setItems(current => mergeServerItemsPreserveOrder(normalizeCartItems(serverItems), current));
      })
      .catch(() => {});
  };

  const clearCart = () => {
    setItems([]);

    apiClient.delete('/cart').catch(() => {});
  };

  const itemCount = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0), [items]);

  const value = useMemo(
    () => ({
      items,
      itemCount,
      subtotal,
      addItem,
      removeItem,
      updateQuantity,
      changeQuantity,
      clearCart,
    }),
    [items, itemCount, subtotal],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }

  return context;
}
