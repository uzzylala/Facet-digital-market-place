import { useMutation } from '@tanstack/react-query';
import { api } from './api.js';
import { useToast } from './toast.jsx';

/** Asks the server for a short-lived signed URL (entitlement-checked) and starts the download. */
export function useDownload() {
  const toast = useToast();
  return useMutation({
    mutationFn: (productId) => api.post(`/downloads/${productId}`),
    onSuccess: ({ url }) => {
      // The signed URL sets Content-Disposition: attachment, so the page stays put.
      window.location.href = url;
    },
    onError: (err) => toast(err.message, { tone: 'error' }),
  });
}
