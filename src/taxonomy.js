export const CATEGORIES = Object.freeze([
  {
    id: 'core',
    title: 'Core',
    accentStage: 'normal',
    stage: 'Normal',
    description: 'Root metadata, time, tabs, tutorials, and game flags.',
  },
  {
    id: 'resources',
    title: 'Resources',
    accentStage: 'normal',
    stage: 'All game',
    description: 'Currency pools and prestige resources.',
  },
  {
    id: 'dimensions',
    title: 'Dimensions',
    accentStage: 'normal',
    stage: 'Normal',
    description: 'Dimension, tickspeed, boost, galaxy, and sacrifice state.',
  },
  {
    id: 'achievements',
    title: 'Achievements',
    accentStage: 'normal',
    stage: 'All game',
    description: 'Achievement bits, secret achievements, unlocks, and notifications.',
  },
  {
    id: 'challenges',
    title: 'Challenges',
    accentStage: 'normal',
    stage: 'Normal to Eternity',
    description: 'Normal, Infinity, and Eternity challenge state.',
  },
  {
    id: 'infinity',
    title: 'Infinity',
    accentStage: 'infinity',
    stage: 'Infinity',
    description: 'Infinity upgrades, records, break state, and IP multiplier state.',
  },
  {
    id: 'automation',
    title: 'Automation',
    accentStage: 'normal',
    stage: 'All game',
    description: 'Autobuyers and automated systems.',
  },
  {
    id: 'replicanti',
    title: 'Replicanti',
    accentStage: 'infinity',
    stage: 'Infinity',
    description: 'Replicanti amount, upgrades, galaxies, and related challenge counters.',
  },
  {
    id: 'eternity',
    title: 'Eternity',
    accentStage: 'eternity',
    stage: 'Eternity',
    description: 'Eternity points, studies, upgrades, shards, and dilation.',
  },
  {
    id: 'reality',
    title: 'Reality',
    accentStage: 'reality',
    stage: 'Reality',
    description: 'Reality machines, glyphs, perks, automator, and imaginary progress.',
  },
  {
    id: 'black-hole',
    title: 'Black Hole',
    accentStage: 'reality',
    stage: 'Reality',
    description: 'Black hole state, pause controls, and related timing.',
  },
  {
    id: 'celestials',
    title: 'Celestials',
    accentStage: 'reality',
    stage: 'Reality',
    description: 'Teresa, Effarig, Enslaved, V, Ra, Laitela, Pelle, and related state.',
  },
  {
    id: 'records',
    title: 'Records',
    accentStage: 'normal',
    stage: 'All game',
    description: 'Runs, requirement checks, speedrun state, and best records.',
  },
  {
    id: 'options',
    title: 'Options',
    accentStage: 'meta',
    stage: 'Meta',
    description: 'Settings, IAP, UI preferences, and account-level state.',
  },
  {
    id: 'unknown',
    title: 'Uncategorized',
    accentStage: 'fallback',
    stage: 'Fallback',
    description: 'New or unmapped save keys. These remain fully reachable.',
  },
]);

const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

const topLevelCategory = Object.freeze({
  // Core
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
  tab: 'core',
  subtab: 'core',
  lastTenRuns: 'records',
  lastTenEternities: 'records',
  lastTenRealities: 'records',

  // Resources
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
  realityMachines: 'resources',
  imaginaryMachines: 'resources',
  eternityBuyer: 'automation',

  // Dimensions
  dimensions: 'dimensions',
  buyUntil10: 'dimensions',
  sacrificed: 'dimensions',
  dimensionBoosts: 'dimensions',
  galaxies: 'dimensions',
  totalTickGained: 'dimensions',
  totalTickBought: 'dimensions',
  postC4Tier: 'dimensions',
  highestTierBoughtThisDimboost: 'dimensions',
  tickspeed: 'dimensions',

  // Achievements
  achievementBits: 'achievements',
  secretAchievementBits: 'achievements',
  achievements: 'achievements',
  secretAchievements: 'achievements',
  secretUnlocks: 'achievements',
  achTimer: 'achievements',
  achievementChecks: 'achievements',

  // Challenges
  challenge: 'challenges',
  eternityChalls: 'challenges',
  chall2Pow: 'challenges',
  chall3Pow: 'challenges',
  chall9TickspeedCostBumps: 'challenges',
  chall8TotalSacrifice: 'challenges',
  ic2Count: 'challenges',
  eterc8ids: 'challenges',
  eterc8repl: 'challenges',

  // Infinity
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
  infMultBuy: 'infinity',
  infinityGoal: 'infinity',

  // Automation
  auto: 'automation',

  // Replicanti
  replicanti: 'replicanti',

  // Eternity
  eternityUpgrades: 'eternity',
  eternityUpgradeBits: 'eternity',
  epmultUpgrades: 'eternity',
  epMultUpgrades: 'eternity',
  eternities: 'eternity',
  bigEternities: 'eternity',
  timestudy: 'eternity',
  dilation: 'eternity',
  respec: 'eternity',
  eterc: 'eternity',
  thisEternity: 'eternity',
  thisInfinity: 'eternity',
  thisReality: 'reality',
  thisInfinityTime: 'eternity',

  // Reality
  reality: 'reality',
  bigRealities: 'reality',
  glyphs: 'reality',
  perks: 'reality',
  automator: 'reality',
  imaginaryRebuyables: 'reality',
  realityBuyer: 'reality',

  // Black Hole
  blackHole: 'black-hole',
  blackHolePause: 'black-hole',
  blackHoleAutoPauseMode: 'black-hole',
  blackHolePauseTime: 'black-hole',
  blackHoleNegative: 'black-hole',

  // Celestials
  celestials: 'celestials',

  // Records
  records: 'records',
  shownRuns: 'records',
  requirementChecks: 'records',
  speedrun: 'records',
  startDate: 'records',
  totalTimePlayed: 'records',
  realTimePlayed: 'records',
  bestReplicantiInfinitySubMs: 'records',
  previousInfinities: 'records',

  // Options
  options: 'options',
  IAP: 'options',
  playerName: 'options',
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

  if (/glyph|perk|automator|imaginary/iu.test(topKey)) {
    return getCategory('reality');
  }

  if (/achievement|unlock|notification/iu.test(topKey)) {
    return getCategory('achievements');
  }

  if (/record|best|run|requirement|speed/iu.test(topKey)) {
    return getCategory('records');
  }

  if (/replicanti|repl/iu.test(topKey)) {
    return getCategory('replicanti');
  }

  if (/celestial|teresa|effarig|enslaved|laitela|pelle|\bra\b/iu.test(topKey)) {
    return getCategory('celestials');
  }

  if (/blackhole|black.?hole/iu.test(topKey)) {
    return getCategory('black-hole');
  }

  if (/dilation|dilat/iu.test(topKey)) {
    return getCategory('eternity');
  }

  if (/infinity|inf(?!o)/iu.test(topKey)) {
    return getCategory('infinity');
  }

  if (/eternity|etern/iu.test(topKey)) {
    return getCategory('eternity');
  }

  if (/reality|realit/iu.test(topKey)) {
    return getCategory('reality');
  }

  if (/dimension|galaxy|boost|galaxi/iu.test(topKey)) {
    return getCategory('dimensions');
  }

  if (/auto|buyer/iu.test(topKey)) {
    return getCategory('automation');
  }

  return getCategory('unknown');
};
