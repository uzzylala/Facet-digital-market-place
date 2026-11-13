import { Suspense, lazy } from 'react';
import { Link, Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation } from 'react-router';
import { Compass } from 'lucide-react';
import { useSession } from './lib/session.js';
import { Layout } from './components/Layout.jsx';
import { EmptyState, PageLoader } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import Browse from './pages/Browse.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Assistant from './pages/Assistant.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import { OrderHistory, OrderReceipt } from './pages/Orders.jsx';
import { Library, Wishlist } from './pages/Library.jsx';
import { SignIn, SignUp } from './pages/Auth.jsx';

// The seller studio (dashboard, chart, editor) is split into its own chunk.
const studio = () => import('./pages/studio/Studio.jsx');
const StudioLayout = lazy(() => studio().then((m) => ({ default: m.StudioLayout })));
const StudioOverview = lazy(() => studio().then((m) => ({ default: m.StudioOverview })));
const StudioProducts = lazy(() => studio().then((m) => ({ default: m.StudioProducts })));
const StudioOrders = lazy(() => studio().then((m) => ({ default: m.StudioOrders })));
const StudioReviews = lazy(() => studio().then((m) => ({ default: m.StudioReviews })));
const ProductEditor = lazy(() => import('./pages/studio/ProductEditor.jsx'));
const page = (el) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

function RequireAuth() {
  const { isSignedIn, isPending } = useSession();
  const location = useLocation();
  if (isPending) return <PageLoader />;
  if (!isSignedIn) return <Navigate to={`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

function NotFound() {
  return (
    <div className="container-page max-w-xl pt-16">
      <EmptyState icon={Compass} title="This page doesn’t exist" action={<Link to="/browse" className="btn-primary">Browse products</Link>}>
        The link may be old, or the product was removed by its seller.
      </EmptyState>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'browse', element: <Browse /> },
      { path: 'products/:slug', element: <ProductDetail /> },
      { path: 'assistant', element: <Assistant /> },
      { path: 'cart', element: <Cart /> },
      { path: 'sign-in', element: <SignIn /> },
      { path: 'sign-up', element: <SignUp /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'checkout/:orderId', element: <Checkout /> },
          { path: 'orders', element: <OrderHistory /> },
          { path: 'orders/:id', element: <OrderReceipt /> },
          { path: 'library', element: <Library /> },
          { path: 'wishlist', element: <Wishlist /> },
        ],
      },
      {
        path: 'studio',
        element: page(<StudioLayout />),
        children: [
          { index: true, element: page(<StudioOverview />) },
          { path: 'products', element: page(<StudioProducts />) },
          { path: 'products/new', element: page(<ProductEditor />) },
          { path: 'products/:id/edit', element: page(<ProductEditor />) },
          { path: 'orders', element: page(<StudioOrders />) },
          { path: 'reviews', element: page(<StudioReviews />) },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
