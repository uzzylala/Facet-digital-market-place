import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'facet.cart.v1';

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// The cart only remembers which products you picked plus a display snapshot.
// Prices are recalculated by the server when the order is created.
export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage unavailable (private mode) — cart still works for this tab
    }
  }, [items]);

  const add = useCallback((product) => {
    setItems((current) =>
      current.some((i) => i.id === product.id)
        ? current
        : [...current, {
            id: product.id,
            slug: product.slug,
            title: product.title,
            price: product.price,
            thumbnailUrl: product.thumbnailUrl,
            category: product.category,
            seller: product.seller,
          }],
    );
  }, []);

  const remove = useCallback((id) => setItems((current) => (current.some((i) => i.id === id) ? current.filter((i) => i.id !== id) : current)), []);
  const clear = useCallback(() => setItems([]), []);
  const has = useCallback((id) => items.some((i) => i.id === id), [items]);

  const value = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.price.listCents, 0);
    const total = items.reduce((s, i) => s + i.price.finalCents, 0);
    return { items, add, remove, clear, has, count: items.length, subtotal, total, savings: subtotal - total };
  }, [items, add, remove, clear, has]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
