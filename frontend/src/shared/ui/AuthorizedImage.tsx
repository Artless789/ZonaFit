import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { User as UserIcon } from 'lucide-react';

export function AuthorizedImage({ src, alt, className = '', fallback }: { src: string; alt: string; className?: string; fallback?: React.ReactNode }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) return;
    if (src.startsWith('http')) {
      setBlobUrl(src);
      return;
    }

    let isMounted = true;
    let objectUrl: string | null = null;
    api.get(src, { responseType: 'blob' })
      .then(res => {
        if (isMounted) {
          objectUrl = URL.createObjectURL(res.data);
          setBlobUrl(objectUrl);
        }
      })
      .catch(() => {
        if (isMounted) setError(true);
      });

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (error || !src) {
    return <>{fallback || <div className={`flex items-center justify-center bg-bg-elevated ${className}`}><UserIcon size={24} className="text-text-muted" /></div>}</>;
  }

  if (!blobUrl) {
    return <div className={`animate-pulse bg-bg-elevated ${className}`}></div>;
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}
