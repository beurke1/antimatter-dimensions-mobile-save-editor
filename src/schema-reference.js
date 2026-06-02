/*
 * Stable top-level Antimatter Dimensions save keys used as a taxonomy guard.
 *
 * The editor is intentionally runtime-indexed and must not depend on a fixed
 * schema to expose paths. This list only protects known AD player keys from
 * drifting into Uncategorized during taxonomy changes.
 *
 * Reference: IvarK/AntimatterDimensionsSourceCode `src/core/player.js`
 * default player object, plus Android/mobile naming variants already handled
 * by the editor.
 */

export const KNOWN_TOP_LEVEL_CATEGORIES = Object.freeze([
  // Core
  ['version', 'core'],
  ['lastUpdate', 'core'],
  ['news', 'core'],
  ['isGameEnd', 'core'],
  ['tabNotifications', 'core'],
  ['triggeredTabNotificationBits', 'core'],
  ['tutorialState', 'core'],
  ['tutorialActive', 'core'],
  ['usedUnpause', 'core'],
  ['backupTimer', 'core'],
  ['tab', 'core'],
  ['subtab', 'core'],

  // Resources
  ['antimatter', 'resources'],
  ['matter', 'resources'],
  ['infinityPoints', 'resources'],
  ['infinityPower', 'resources'],
  ['eternityPoints', 'resources'],
  ['timeShards', 'resources'],
  ['realities', 'resources'],
  ['partInfinityPoint', 'resources'],
  ['partInfinitied', 'resources'],
  ['partSimulatedReality', 'resources'],
  ['realityMachines', 'resources'],
  ['imaginaryMachines', 'resources'],

  // Dimensions
  ['dimensions', 'dimensions'],
  ['buyUntil10', 'dimensions'],
  ['sacrificed', 'dimensions'],
  ['dimensionBoosts', 'dimensions'],
  ['galaxies', 'dimensions'],
  ['totalTickGained', 'dimensions'],
  ['totalTickBought', 'dimensions'],
  ['postC4Tier', 'dimensions'],
  ['highestTierBoughtThisDimboost', 'dimensions'],
  ['tickspeed', 'dimensions'],

  // Achievements
  ['achievementBits', 'achievements'],
  ['secretAchievementBits', 'achievements'],
  ['achievements', 'achievements'],
  ['secretAchievements', 'achievements'],
  ['secretUnlocks', 'achievements'],
  ['achTimer', 'achievements'],
  ['achievementChecks', 'achievements'],

  // Challenges
  ['challenge', 'challenges'],
  ['eternityChalls', 'challenges'],
  ['chall2Pow', 'challenges'],
  ['chall3Pow', 'challenges'],
  ['chall9TickspeedCostBumps', 'challenges'],
  ['chall8TotalSacrifice', 'challenges'],
  ['ic2Count', 'challenges'],
  ['eterc8ids', 'challenges'],
  ['eterc8repl', 'challenges'],

  // Infinity
  ['infinity', 'infinity'],
  ['infinities', 'infinity'],
  ['bigCrunches', 'infinity'],
  ['infinitiesBanked', 'infinity'],
  ['bankedInfinities', 'infinity'],
  ['break', 'infinity'],
  ['brake', 'infinity'],
  ['infinityUpgrades', 'infinity'],
  ['infinityRebuyables', 'infinity'],
  ['infinityUpgradeBits', 'infinity'],
  ['breakInfinityUpgradeBits', 'infinity'],
  ['breakInfinityRebuyables', 'infinity'],
  ['IPMultPurchases', 'infinity'],
  ['ipMultUpgrades', 'infinity'],
  ['infMultBuy', 'infinity'],
  ['infinityGoal', 'infinity'],

  // Automation
  ['auto', 'automation'],
  ['eternityBuyer', 'automation'],

  // Replicanti
  ['replicanti', 'replicanti'],

  // Eternity
  ['eternityUpgrades', 'eternity'],
  ['eternityUpgradeBits', 'eternity'],
  ['epmultUpgrades', 'eternity'],
  ['epMultUpgrades', 'eternity'],
  ['eternities', 'eternity'],
  ['bigEternities', 'eternity'],
  ['timestudy', 'eternity'],
  ['dilation', 'eternity'],
  ['respec', 'eternity'],
  ['eterc', 'eternity'],
  ['thisEternity', 'eternity'],
  ['thisInfinity', 'eternity'],
  ['thisInfinityTime', 'eternity'],

  // Reality
  ['reality', 'reality'],
  ['thisReality', 'reality'],
  ['bigRealities', 'reality'],
  ['glyphs', 'reality'],
  ['perks', 'reality'],
  ['automator', 'reality'],
  ['imaginaryRebuyables', 'reality'],
  ['realityBuyer', 'reality'],

  // Black Hole
  ['blackHole', 'black-hole'],
  ['blackHolePause', 'black-hole'],
  ['blackHoleAutoPauseMode', 'black-hole'],
  ['blackHolePauseTime', 'black-hole'],
  ['blackHoleNegative', 'black-hole'],

  // Celestials
  ['celestials', 'celestials'],

  // Records
  ['records', 'records'],
  ['shownRuns', 'records'],
  ['requirementChecks', 'records'],
  ['speedrun', 'records'],
  ['startDate', 'records'],
  ['totalTimePlayed', 'records'],
  ['realTimePlayed', 'records'],
  ['bestReplicantiInfinitySubMs', 'records'],
  ['previousInfinities', 'records'],
  ['lastTenRuns', 'records'],
  ['lastTenEternities', 'records'],
  ['lastTenRealities', 'records'],

  // Options
  ['options', 'options'],
  ['IAP', 'options'],
  ['playerName', 'options'],
]);
