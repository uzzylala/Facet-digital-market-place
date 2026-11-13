import { readdir, readFile } from 'node:fs/promises';
import { putObject } from '../services/storage.js';
import { mediaUrl } from '../services/serialize.js';

const AVATARS_DIR = new URL('./avatars/', import.meta.url);
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const REUSE = {
  'Lucas Ferreira': 'liam-murphy',
  'Tom Okafor': 'kofi-mensah',
  'Ethan Brooks': 'jonas-weber',
  'Diego Morales': 'omar-haddad',
  'Ben Carter': 'arjun-mehta',
  'Sam Rivera': 'ravi-patel',
  'Max Schmidt': 'noah-kim',
  'Victor Dubois': 'ryo-tanaka',
  'Sofia Rossi': 'elena-petrova',
  'Chloe Martin': 'ivy-walsh',
  'Freya Lindqvist': 'leila-farah',
  'Isabel Costa': 'aisha-khan',
  'Nina Novak': 'zara-ahmed',
  'Ana Silva': 'priya-nair',
  'Grace Lee': 'hana-sato',
  'Maya Chen': 'mei-lin',
};

export async function uploadAvatars(db) {
  const available = new Set((await readdir(AVATARS_DIR)).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  const { rows: buyers } = await db.query("SELECT id, name FROM profiles WHERE id LIKE 'seed\\_buyer\\_%'");

  const urls = {};
  for (const slug of available) {
    const key = await putObject(`media/avatars/${slug}.webp`, await readFile(new URL(`${slug}.webp`, AVATARS_DIR)), 'image/webp');
    urls[slug] = mediaUrl(key);
  }
  
  let updated = 0;
  const withoutPhoto = [];
  for (const buyer of buyers) {
    const own = slugify(buyer.name);
    const slug = available.has(own) ? own : REUSE[buyer.name];
    if (!slug || !urls[slug]) {
      withoutPhoto.push(buyer.name);
      continue;
    }
    await db.query('UPDATE profiles SET avatar_url = $2 WHERE id = $1', [buyer.id, urls[slug]]);
    updated++;
  }
  return { updated, withoutPhoto };
}
