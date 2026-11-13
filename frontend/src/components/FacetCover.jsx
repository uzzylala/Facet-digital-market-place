import { useState } from 'react';
import { CategoryIcon } from './CategoryIcon.jsx';

// Each category gets its own soft palette: [tint, blob A, blob B, icon colour].
const PALETTES = {
  'ui-kits': ['#f1ecff', '#b9a4ff', '#ffb3d6', '#6a4cff'],
  'code-templates': ['#ecf0ff', '#9fb6ff', '#a5ecff', '#3d6bff'],
  icons: ['#eaf6ff', '#8fc7ff', '#9ff0dd', '#1a7fd6'],
  illustrations: ['#fff0f4', '#ffb0c8', '#ffd2a8', '#e2457f'],
  fonts: ['#eeeefb', '#b3b1f2', '#d9d0ff', '#2f2a85'],
  ebooks: ['#e9f8f3', '#93e2c9', '#bfe9ff', '#0f8a74'],
  'notion-templates': ['#f2f2f7', '#c9c3ff', '#d6dae6', '#3b3a52'],
  presets: ['#fff3ea', '#ffc39b', '#ffb6d3', '#d9600f'],
  audio: ['#f2eeff', '#c4adff', '#9ee9f2', '#6d3fe0'],
  default: ['#f1ecff', '#b9a4ff', '#a5ecff', '#6a4cff'],
};

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Generated placeholder cover: soft colour blobs behind a frosted icon tile. */
export function FacetCover({ seed = 'facet', category, title, className = '', showIcon = true, size = 'md' }) {
  const [tint, blobA, blobB, ink] = PALETTES[category] ?? PALETTES.default;
  const h = hash(String(seed));
  const ax = 15 + (h % 40);
  const ay = 10 + ((h >> 6) % 35);
  const bx = 55 + ((h >> 12) % 35);
  const by = 50 + ((h >> 18) % 40);
  const tile = size === 'lg' ? 'size-28 rounded-[30px]' : 'size-[30%] max-w-24 rounded-[22%]';

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={!title}
      style={{
        backgroundColor: tint,
        backgroundImage: `radial-gradient(45% 55% at ${ax}% ${ay}%, ${blobA} 0%, transparent 70%), radial-gradient(50% 60% at ${bx}% ${by}%, ${blobB} 0%, transparent 70%)`,
      }}
    >
      {/* fine hatching in one corner for texture */}
      <div className="hatch absolute -bottom-6 -right-6 size-1/2 rotate-6 rounded-[40%] opacity-[0.07]" style={{ color: ink }} />
      {showIcon && (
        <div className="absolute inset-0 grid place-items-center">
          <div
            className={`grid aspect-square place-items-center border border-white/70 bg-white/55 shadow-[0_20px_40px_-18px_rgba(21,21,28,0.35)] backdrop-blur-xl ${tile}`}
            style={{ color: ink }}
          >
            <CategoryIcon slug={category} className="size-[42%]" strokeWidth={1.6} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Product image: the seller's thumbnail when present, otherwise a generated cover. */
export function ProductImage({ product, className = '', size, showIcon = true }) {
  // Fall back to the generated cover if the uploaded image is missing or fails to load.
  const [failed, setFailed] = useState(false);
  if (product.thumbnailUrl && !failed) {
    return (
      <div className={`relative overflow-hidden bg-wash ${className}`}>
        <img src={product.thumbnailUrl} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      </div>
    );
  }
  return <FacetCover seed={product.id ?? product.slug} category={product.category?.slug} className={className} size={size} showIcon={showIcon} />;
}
