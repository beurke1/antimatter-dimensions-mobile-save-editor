/*
 * Quick-edit presets — one-tap modifications of well-known stable save paths.
 * Each preset is scoped to a specific game stage and targets top-level or
 * near-top-level fields that have been stable across AD versions.
 *
 * Presets are additive: they only set specific paths, leaving everything else intact.
 * The change-tracking system shows exactly what changed for review before export.
 */

const bigNum = (mantissa, exponent) => ({ mantissa, exponent });

export const PRESETS = [
  /* ── Normal stage ─────────────────────────────────── */
  {
    id: 'antimatter-e308',
    label: 'Max Normal AM',
    description: 'Set antimatter to 1.79e308 (threshold for first Infinity)',
    stage: 'Normal',
    accentStage: 'normal',
    apply: (data) => ({ ...data, antimatter: bigNum(1.79, 308) }),
  },
  {
    id: 'dim-boosts-4',
    label: '4 Dimension Boosts',
    description: 'Grant 4 dimension boosts (unlocks all 8 dimensions)',
    stage: 'Normal',
    accentStage: 'normal',
    apply: (data) => ({ ...data, dimensionBoosts: Math.max(4, data.dimensionBoosts ?? 0) }),
  },
  {
    id: 'first-galaxy',
    label: 'First Galaxy',
    description: 'Grant 1 antimatter galaxy',
    stage: 'Normal',
    accentStage: 'normal',
    apply: (data) => ({ ...data, galaxies: Math.max(1, data.galaxies ?? 0) }),
  },

  /* ── Infinity stage ────────────────────────────────── */
  {
    id: 'break-infinity',
    label: 'Enable Break Infinity',
    description: 'Toggle break infinity (allows antimatter beyond e308)',
    stage: 'Infinity',
    accentStage: 'infinity',
    apply: (data) => {
      if ('brake' in data) {
        return { ...data, brake: true };
      }
      return { ...data, break: true };
    },
  },
  {
    id: 'infinity-points-e100',
    label: 'IP 1e100',
    description: 'Set infinity points to 1e100',
    stage: 'Infinity',
    accentStage: 'infinity',
    apply: (data) => ({ ...data, infinityPoints: bigNum(1, 100) }),
  },
  {
    id: 'replicanti-unlock',
    label: 'Unlock Replicanti',
    description: 'Unlock replicanti (sets replicanti.unl to true)',
    stage: 'Infinity',
    accentStage: 'infinity',
    apply: (data) => ({
      ...data,
      replicanti: {
        ...(data.replicanti ?? {}),
        unl: true,
        amount: bigNum(1, 0),
        chance: data.replicanti?.chance ?? 0.01,
        interval: data.replicanti?.interval ?? 1000,
        galaxies: data.replicanti?.galaxies ?? 0,
      },
    }),
  },

  /* ── Eternity stage ────────────────────────────────── */
  {
    id: 'eternity-points-e100',
    label: 'EP 1e100',
    description: 'Set eternity points to 1e100',
    stage: 'Eternity',
    accentStage: 'eternity',
    apply: (data) => ({ ...data, eternityPoints: bigNum(1, 100) }),
  },
  {
    id: 'time-shards-e6',
    label: 'Time Shards 1e6',
    description: 'Set time shards to 1e6 (enables tickspeed study)',
    stage: 'Eternity',
    accentStage: 'eternity',
    apply: (data) => ({ ...data, timeShards: bigNum(1, 6) }),
  },

  /* ── Reality stage ─────────────────────────────────── */
  {
    id: 'reality-machines-1000',
    label: 'Reality Machines 1000',
    description: 'Set reality machines to 1000',
    stage: 'Reality',
    accentStage: 'reality',
    apply: (data) => ({
      ...data,
      reality: {
        ...(data.reality ?? {}),
        realityMachines: bigNum(1000, 0),
      },
    }),
  },
];

export const applyPreset = (data, presetId) => {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }
  return preset.apply(data);
};
