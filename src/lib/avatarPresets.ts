// DiceBear avatars are fully stateless - just a URL, no upload/Storage needed.
// png (not svg) so it drops straight into the existing <Image source={{uri}}>
// pattern used everywhere avatars render.
const SEED_WORDS = [
  'Sunny', 'River', 'Maple', 'Comet', 'Willow', 'Breeze', 'Nova', 'Sage',
  'Ember', 'Luna', 'Cedar', 'Pixel', 'Coral', 'Storm', 'Juniper', 'Orbit',
];

export function diceBearAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/10.x/open-peeps/png?seed=${encodeURIComponent(seed)}`;
}

export function randomAvatarSeeds(count = 9): string[] {
  const shuffled = [...SEED_WORDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((word) => `${word}-${Math.floor(Math.random() * 1000)}`);
}
