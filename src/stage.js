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

const getPathValue = (data, path) => {
  return path.split('.').reduce((current, segment) => current?.[segment], data);
};

const quantitySignal = (path) => ({
  path,
  isTriggered: (data) => isPositiveQuantity(getPathValue(data, path)),
});

const enabledSignal = (path) => ({
  path,
  isTriggered: (data) => isEnabled(getPathValue(data, path)),
});

const STAGE_DETECTION_RULES = Object.freeze([
  {
    stage: STAGES.REALITY,
    signals: Object.freeze([
      quantitySignal('realities'),
      quantitySignal('bigRealities'),
      quantitySignal('reality.realityMachines'),
      quantitySignal('reality.imaginaryMachines'),
    ]),
  },
  {
    stage: STAGES.ETERNITY,
    signals: Object.freeze([
      quantitySignal('eternityPoints'),
      quantitySignal('eternities'),
      quantitySignal('bigEternities'),
      quantitySignal('timeShards'),
      quantitySignal('timestudy.theorem'),
      quantitySignal('dilation.tachyonParticles'),
      quantitySignal('dilation.dilatedTime'),
      enabledSignal('dilation.active'),
    ]),
  },
  {
    stage: STAGES.INFINITY,
    signals: Object.freeze([
      quantitySignal('infinityPoints'),
      quantitySignal('infinities'),
      quantitySignal('bigCrunches'),
      enabledSignal('break'),
      enabledSignal('brake'),
      enabledSignal('replicanti.unl'),
    ]),
  },
]);

export const detectStageDetails = (data) => {
  if (!data || typeof data !== 'object') {
    return {
      stage: STAGES.NONE,
      signals: [],
    };
  }

  for (const rule of STAGE_DETECTION_RULES) {
    const signals = rule.signals
      .filter((signal) => signal.isTriggered(data))
      .map((signal) => signal.path);

    if (signals.length > 0) {
      return {
        stage: rule.stage,
        signals,
      };
    }
  }

  return {
    stage: STAGES.NORMAL,
    signals: [],
  };
};

export const detectStage = (data) => detectStageDetails(data).stage;
