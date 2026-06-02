/*
 * Game-stage detection from a decoded save.
 *
 * Antimatter Dimensions player objects are fully initialized from a brand-new
 * game: `reality`, `celestials`, `infinityPoints`, `eternityPoints`, and the
 * rest all exist immediately as zero/empty values. Detecting the furthest stage
 * a save has reached therefore has to inspect each marker's VALUE, not merely
 * whether its key is present — every quantity key is truthy (a non-empty string,
 * a `{ mantissa, exponent }` object, or a number) even when it represents zero.
 *
 * Stages are checked furthest-first so the deepest reached stage wins.
 */

export const STAGES = Object.freeze({
  NORMAL: 'Normal',
  INFINITY: 'Infinity',
  ETERNITY: 'Eternity',
  REALITY: 'Reality',
});

/*
 * True when a save quantity represents a value greater than zero. Handles the
 * three shapes AD uses for amounts: plain numbers, PC decimal strings such as
 * "1e250", and Android `{ mantissa, exponent }` big-number objects. Decimal
 * strings that overflow JS numbers (for example "1e1000" -> Infinity) are still
 * treated as positive.
 */
export const isPositiveQuantity = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value === 'string') {
    const numeric = Number(value.trim());

    if (Number.isFinite(numeric)) {
      return numeric > 0;
    }

    // Non-finite parse: only a positive overflow (e.g. "1e1000" -> +Infinity)
    // counts as positive. Negative overflow ("-1e1000" -> -Infinity) and
    // non-numeric strings (NaN) must not be treated as a reached stage.
    return numeric === Number.POSITIVE_INFINITY;
  }

  if (typeof value === 'object' && typeof value.mantissa === 'number') {
    return Number.isFinite(value.mantissa) && value.mantissa > 0;
  }

  return false;
};

const isEnabled = (value) => value === true;

export const detectStage = (data) => {
  if (!data || typeof data !== 'object') {
    return 'No save';
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
