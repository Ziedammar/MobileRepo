import { create } from 'zustand';
import type { Product } from '@/src/types';

export type CartItem = {
  product: Product;
  quantity: number;
  storeId: string;
};

type CartState = {
  items: CartItem[];
  storeId: string | null;
  storeName: string | null;
  addItem: (product: Product, storeId: string, storeName: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  storeId: null,
  storeName: null,

  addItem: (product, storeId, storeName) => {
    const { items, storeId: currentStoreId } = get();

    if (currentStoreId && currentStoreId !== storeId) {
      set({
        items: [{ product, quantity: 1, storeId }],
        storeId,
        storeName,
      });
      return;
    }

    const existing = items.find((i) => i.product.id === product.id);
    if (existing) {
      set({
        items: items.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
        storeId,
        storeName,
      });
    } else {
      set({
        items: [...items, { product, quantity: 1, storeId }],
        storeId,
        storeName,
      });
    }
  },

  removeItem: (productId) => {
    const items = get().items.filter((i) => i.product.id !== productId);
    set({ items, storeId: items.length === 0 ? null : get().storeId });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.product.id === productId ? { ...i, quantity } : i
      ),
    });
  },

  clearCart: () => set({ items: [], storeId: null, storeName: null }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  totalPrice: () =>
    get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
}));
