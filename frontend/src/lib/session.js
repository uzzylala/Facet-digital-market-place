import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { api } from './api.js';
import { authClient } from './auth.js';

/** Neon Auth session + the marketplace profile (seller status, store name). */
export function useSession() {
  const session = authClient.useSession();
  const user = session.data?.user ?? null;

  const me = useQuery({
    queryKey: ['me', user?.id],
    queryFn: () => api.get('/me'),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  return {
    user,
    profile: me.data ?? null,
    isPending: session.isPending || (Boolean(user) && me.isPending),
    isSignedIn: Boolean(user),
  };
}

/** Returns a function that runs `action` if signed in, otherwise sends the user to sign in and back. */
export function useRequireAuth() {
  const { isSignedIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  return (action) => {
    if (isSignedIn) return action();
    navigate(`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`);
  };
}

export function useWishlistToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, on }) => (on ? api.put(`/wishlist/${productId}`) : api.del(`/wishlist/${productId}`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wishlist'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

export async function signOut(queryClient) {
  await authClient.signOut();
  queryClient.clear();
}
