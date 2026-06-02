export const STAGES = Object.freeze({
  NORMAL: 'Normal',
  INFINITY: 'Infinity',
  ETERNITY: 'Eternity',
  REALITY: 'Reality',
  NONE: 'No save',
});

const DECIMAL_STRING_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d+)?)|(?:\.\d+))(?:e[+-]?\d+)?$/iu;
const ZERO_DECIMAL_STRING_PATTERN = /^[+-]?0*(?:\.0*)?(?:e[+-]?\d+)?$/iu;

export const isPositiveQuantity = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!DECIMAL_STRING_PATTERN.test(trimmed) || trimmed.startsWith('-') || ZERO_DECIMAL_STRING_PATTERN.test(trimmed)) {
      return false;
    }

    const numeric = Number(trimmed);
    return numeric > 0 || numeric === Infinity;
  }

  if (typeof value === 'object' && typeof value.mantissa === 'number') {
    return Number.isFinite(value.mantissa) && value.mantissa > 0;
  }

  return false;
};

const isEnabled = (value) => value === true;

export const detectStage = (data) => {
  if (!data || typeof data !== 'object') {
    return STAGES.NONE;
  }

  if (
    isPositiveQuantity(data.realities) ||
    isPositiveQuantity(data.bigRealities) ||
    isPositiveQuantity(data.reality?.realityMachines) ||
    isPositiveQuantity(data.reality?.imaginaryMachines)
  ) {
    return STAGES.REALITY;
  }

  if (
    isPositiveQuantity(data.eternityPoints) ||
    isPositiveQuantity(data.eternities) ||
    isPositiveQuantity(data.bigEternities) ||
    isPositiveQuantity(data.timeShards) ||
    isPositiveQuantity(data.timestudy?.theorem) ||
    isPositiveQuantity(data.dilation?.tachyonParticles) ||
    isPositiveQuantity(data.dilation?.dilatedTime) ||
    isEnabled(data.dilation?.active)
  ) {
    return STAGES.ETERNITY;
  }

  if (
    isPositiveQuantity(data.infinityPoints) ||
    isPositiveQuantity(data.infinities) ||
    isPositiveQuantity(data.bigCrunches) ||
    isEnabled(data.break) ||
    isEnabled(data.brake) ||
    isEnabled(data.replicanti?.unl)
  ) {
    return STAGES.INFINITY;
  }

  return STAGES.NORMAL;
};
