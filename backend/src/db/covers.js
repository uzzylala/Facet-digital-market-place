import { readdir, readFile } from 'node:fs/promises';
import { deleteObjects, keys, putObject } from '../services/storage.js';

const COVERS_DIR = new URL('./covers/', import.meta.url);

export async function uploadCovers(db) {
  const files = (await readdir(COVERS_DIR)).filter((f) => f.endsWith('.webp'));
  const slugs = files.map((f) => f.replace(/\.webp$/, ''));
  const { rows } = await db.query('SELECT id, slug, thumbnail_key FROM products WHERE slug = ANY($1)', [slugs]);

  const replaced = [];
  await Promise.all(
    rows.map(async (p) => {
      const buffer = await readFile(new URL(`${p.slug}.webp`, COVERS_DIR));
      const key = await putObject(keys.media(p.id, `${p.slug}.webp`), buffer, 'image/webp');
      await db.query('UPDATE products SET thumbnail_key = $2 WHERE id = $1', [p.id, key]);
      if (p.thumbnail_key && p.thumbnail_key !== key) replaced.push(p.thumbnail_key);
    }),
  );

  await deleteObjects(replaced);
  return { uploaded: rows.length, missing: slugs.filter((s) => !rows.some((r) => r.slug === s)) };
}
