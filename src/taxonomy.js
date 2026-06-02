export const CATEGORIES = Object.freeze([
  {
    id: 'core',
    title: 'Core',
    stage: 'Normal',
    description: 'Root metadata, time, tabs, tutorials, and game flags.',
  },
  {
    id: 'resources',
    title: 'Resources',
    stage: 'All game',
    description: 'Currency pools and prestige resources.',
  },
  {
    id: 'dimensions',
    title: 'Dimensions',
    stage: 'Normal',
    description: 'Dimension, tickspeed, boost, galaxy, and sacrifice state.',
  },
  {
    id: 'achievements',
    title: 'Achievements',
    stage: 'All game',
    description: 'Achievement bits, secret achievements, unlocks, and notifications.',
  },
  {
    id: 'challenges',
    title: 'Challenges',
    stage: 'Normal to Eternity',
    description: 'Normal, Infinity, and Eternity challenge state.',
  },
  {
    id: 'infinity',
    title: 'Infinity',
    stage: 'Infinity',
    description: 'Infinity upgrades, records, break state, and IP multiplier state.',
  },
  {
    id: 'automation',
    title: 'Automation',
    stage: 'All game',
    description: 'Autobuyers and automated systems.',
  },
  {
    id: 'replicanti',
    title: 'Replicanti',
    stage: 'Infinity',
    description: 'Replicanti amount, upgrades, galaxies, and related challenge counters.',
  },
  {
    id: 'eternity',
    title: 'Eternity',
    stage: 'Eternity',
    description: 'Eternity points, studies, upgrades, shards, and dilation.',
  },
  {
    id: 'reality',
    title: 'Reality',
    stage: 'Reality',
    description: 'Reality machines, glyphs, perks, automator, and imaginary progress.',
  },
  {
    id: 'black-hole',
    title: 'Black Hole',
    stage: 'Reality',
    description: 'Black hole state, pause controls, and related timing.',
  },
  {
    id: 'celestials',
    title: 'Celestials',
    stage: 'Reality',
    description: 'Teresa, Effarig, Enslaved, V, Ra, Laitela, Pelle, and related state.',
  },
  {
    id: 'records',
    title: 'Records',
    stage: 'All game',
    description: 'Runs, requirement checks, speedrun state, and best records.',
  },
  {
    id: 'options',
    title: 'Options',
    stage: 'Meta',
    description: 'Settings, IAP, UI preferences, and account-level state.',
  },
  {
    id: 'unknown',
    title: 'Uncategorized',
    stage: 'Fallback',
    description: 'New or unmapped save keys. These remain fully reachable.',
  },
]);

const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

const topLevelCategory = Object.freeze({
  version: 'core',
  lastUpdate: 'core',
  news: 'core',
  isGameEnd: 'core',
  tabNotifications: 'core',
  triggeredTabNotificationBits: 'core',
  tutorialState: 'core',
  tutorialActive: 'core',
  usedUnpause: 'core',
  backupTimer: 'core',

  antimatter: 'resources',
  matter: 'resources',
  infinityPoints: 'resources',
  infinityPower: 'resources',
  eternityPoints: 'resources',
  timeShards: 'resources',
  realities: 'resources',
  partInfinityPoint: 'resources',
  partInfinitied: 'resources',
  partSimulatedReality: 'resources',

  dimensions: 'dimensions',
  buyUntil10: 'dimensions',
  sacrificed: 'dimensions',
  dimensionBoosts: 'dimensions',
  galaxies: 'dimensions',
  totalTickGained: 'dimensions',
  totalTickBought: 'dimensions',
  postC4Tier: 'dimensions',
  highestTierBoughtThisDimboost: 'dimensions',

  achievementBits: 'achievements',
  secretAchievementBits: 'achievements',
  achievements: 'achievements',
  secretAchievements: 'achievements',
  secretUnlocks: 'achievements',

  challenge: 'challenges',
  eternityChalls: 'challenges',
  chall2Pow: 'challenges',
  chall3Pow: 'challenges',
  chall9TickspeedCostBumps: 'challenges',
  chall8TotalSacrifice: 'challenges',
  ic2Count: 'challenges',
  eterc8ids: 'challenges',
  eterc8repl: 'challenges',

  infinity: 'infinity',
  infinities: 'infinity',
  bigCrunches: 'infinity',
  infinitiesBanked: 'infinity',
  bankedInfinities: 'infinity',
  break: 'infinity',
  brake: 'infinity',
  infinityUpgrades: 'infinity',
  infinityRebuyables: 'infinity',
  infinityUpgradeBits: 'infinity',
  breakInfinityUpgradeBits: 'infinity',
  breakInfinityRebuyables: 'infinity',
  IPMultPurchases: 'infinity',
  ipMultUpgrades: 'infinity',

  auto: 'automation',

  replicanti: 'replicanti',

  eternityUpgrades: 'eternity',
  eternityUpgradeBits: 'eternity',
  epmultUpgrades: 'eternity',
  epMultUpgrades: 'eternity',
  eternities: 'eternity',
  bigEternities: 'eternity',
  timestudy: 'eternity',
  dilation: 'eternity',
  respec: 'eternity',

  reality: 'reality',
  bigRealities: 'reality',

  blackHole: 'black-hole',
  blackHolePause: 'black-hole',
  blackHoleAutoPauseMode: 'black-hole',
  blackHolePauseTime: 'black-hole',
  blackHoleNegative: 'black-hole',

  celestials: 'celestials',

  records: 'records',
  shownRuns: 'records',
  requirementChecks: 'records',
  speedrun: 'records',

  options: 'options',
  IAP: 'options',
});

export const getCategory = (categoryId) => {
  return CATEGORY_BY_ID.get(categoryId) ?? CATEGORY_BY_ID.get('unknown');
};

export const categorizePath = (segments) => {
  if (segments.length === 0) {
    return getCategory('core');
  }

  const topKey = String(segments[0]);
  const directCategory = topLevelCategory[topKey];

  if (directCategory) {
    return getCategory(directCategory);
  }

  if (/glyph|perk|automator/iu.test(topKey)) {
    return getCategory('reality');
  }

  if (/achievement|unlock|notification/iu.test(topKey)) {
    return getCategory('achievements');
  }

  if (/record|best|run|requirement/iu.test(topKey)) {
    return getCategory('records');
  }

  return getCategory('unknown');
};

