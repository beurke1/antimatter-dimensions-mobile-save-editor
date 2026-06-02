const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const SaveType = Object.freeze({
  PC: 'pc',
  Android: 'android',
});

const SAVE_FORMATS = Object.freeze({
  [SaveType.PC]: {
    start: 'AntimatterDimensionsSavefileFormat',
    version: 'AAB',
    end: 'EndOfSavefile',
    compression: 'deflate',
  },
  [SaveType.Android]: {
    start: 'AntimatterDimensionsAndroidSaveFormat',
    version: 'AAA',
    end: 'EndOfSavefile',
    compression: 'gzip',
  },
});

const normalizeInput = (value) => String(value ?? '').trim().replace(/\r/g, '').replace(/\\r/g, '');

const isNodeRuntime = () => {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
};

const toUint8Array = (value) => {
  if (value instanceof Uint8Array) {
    return value;
  }

  return new Uint8Array(value);
};

const padBase64 = (value) => {
  const remainder = value.length % 4;
  return remainder === 0 ? value : `${value}${'='.repeat(4 - remainder)}`;
};

const escapeSaveBase64 = (value) => {
  return value.replace(/=+$/gu, '').replace(/0/gu, '0a').replace(/\+/gu, '0b').replace(/\//gu, '0c');
};

const restoreSaveBase64 = (value) => {
  return padBase64(value.replace(/0b/gu, '+').replace(/0c/gu, '/').replace(/0a/gu, '0'));
};

const bytesToBase64 = (bytes) => {
  if (typeof btoa === 'function') {
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
    }

    return btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  throw new Error('Base64 encoding is unavailable in this runtime.');
};

const base64ToBytes = (value) => {
  const padded = padBase64(value);

  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }

  throw new Error('Base64 decoding is unavailable in this runtime.');
};

const streamTransform = async (bytes, stream) => {
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();

  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
};

const compressWithNode = async (bytes, format) => {
  if (!isNodeRuntime()) {
    throw new Error('CompressionStream is unavailable in this browser.');
  }

  const zlib = await import('node:zlib');
  const source = Buffer.from(bytes);
  return new Uint8Array(format === 'gzip' ? zlib.gzipSync(source) : zlib.deflateSync(source));
};

const decompressWithNode = async (bytes, format) => {
  if (!isNodeRuntime()) {
    throw new Error('DecompressionStream is unavailable in this browser.');
  }

  const zlib = await import('node:zlib');
  const source = Buffer.from(bytes);
  return new Uint8Array(format === 'gzip' ? zlib.gunzipSync(source) : zlib.inflateSync(source));
};

const compressBytes = async (bytes, format) => {
  if (typeof CompressionStream === 'function') {
    return streamTransform(bytes, new CompressionStream(format));
  }

  return compressWithNode(bytes, format);
};

const decompressBytes = async (bytes, format) => {
  if (typeof DecompressionStream === 'function') {
    return streamTransform(bytes, new DecompressionStream(format));
  }

  return decompressWithNode(bytes, format);
};

const parseJsonSave = (jsonText) => {
  const data = JSON.parse(jsonText);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Decoded save root must be a JSON object.');
  }

  return data;
};

const inferSaveTypeFromData = (data) => {
  if (
    'brake' in data ||
    'achievements' in data ||
    'secretAchievements' in data ||
    'breakInfinityUpgradeBits' in data
  ) {
    return SaveType.Android;
  }

  return SaveType.PC;
};

export const detectSaveType = (encodedSave) => {
  const value = normalizeInput(encodedSave);
  return value.startsWith(SAVE_FORMATS[SaveType.Android].start) ? SaveType.Android : SaveType.PC;
};

export const decodeSave = async (encodedSave) => {
  const input = normalizeInput(encodedSave);

  if (!input) {
    throw new Error('Paste a save string or decoded JSON first.');
  }

  if (input.startsWith('{')) {
    const data = parseJsonSave(input);
    return {
      data,
      saveType: inferSaveTypeFromData(data),
      source: 'json',
    };
  }

  const saveType = detectSaveType(input);
  const format = SAVE_FORMATS[saveType];

  if (!input.startsWith(format.start)) {
    const data = parseJsonSave(textDecoder.decode(base64ToBytes(input)));
    return {
      data,
      saveType: inferSaveTypeFromData(data),
      source: 'legacy-base64',
    };
  }

  let payload = input.slice(format.start.length + 3);
  if (payload.endsWith(format.end)) {
    payload = payload.slice(0, -format.end.length);
  }

  const compressedBytes = base64ToBytes(restoreSaveBase64(payload));
  const jsonBytes = await decompressBytes(compressedBytes, format.compression);
  const data = parseJsonSave(textDecoder.decode(jsonBytes));

  return {
    data,
    saveType,
    source: 'encoded',
  };
};

export const encodeSaveData = async (data, saveType = SaveType.PC) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Save root must be a JSON object before encoding.');
  }

  const format = SAVE_FORMATS[saveType] ?? SAVE_FORMATS[SaveType.PC];
  const jsonText = JSON.stringify(data, (_key, value) => {
    if (value === Number.POSITIVE_INFINITY) {
      return 'Infinity';
    }

    return value;
  });
  const compressedBytes = await compressBytes(textEncoder.encode(jsonText), format.compression);
  const payload = escapeSaveBase64(bytesToBase64(compressedBytes));

  return `${format.start}${format.version}${payload}${format.end}`;
};

export const stringifySaveJson = (data, spacing = 2) => {
  return JSON.stringify(data, null, spacing);
};

