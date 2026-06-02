import { categorizePath, CATEGORIES } from './taxonomy.js';

const SAFE_KEY_PATTERN = /^[A-Za-z_$][\w$]*$/u;

export const formatPath = (segments) => {
  if (segments.length === 0) {
    return 'root';
  }

  return segments.reduce((path, segment) => {
    if (typeof segment === 'number') {
      return `${path}[${segment}]`;
    }

    if (path === '') {
      return SAFE_KEY_PATTERN.test(segment) ? segment : `[${JSON.stringify(segment)}]`;
    }

    return SAFE_KEY_PATTERN.test(segment) ? `${path}.${segment}` : `${path}[${JSON.stringify(segment)}]`;
  }, '');
};

export const getValueAtSegments = (source, segments) => {
  let current = source;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
};

export const setValueAtSegments = (source, segments, value) => {
  if (segments.length === 0) {
    return value;
  }

  const update = (current, depth) => {
    const segment = segments[depth];
    const container = Array.isArray(current) ? [...current] : { ...current };

    if (depth === segments.length - 1) {
      container[segment] = value;
      return container;
    }

    container[segment] = update(current?.[segment], depth + 1);
    return container;
  };

  return update(source, 0);
};

export const deleteValueAtSegments = (source, segments) => {
  if (segments.length === 0) {
    return {};
  }

  const update = (current, depth) => {
    if (current === null || current === undefined) {
      return current;
    }

    const segment = segments[depth];
    const container = Array.isArray(current) ? [...current] : { ...current };

    if (depth === segments.length - 1) {
      if (Array.isArray(container) && typeof segment === 'number') {
        container.splice(segment, 1);
      } else {
        delete container[segment];
      }

      return container;
    }

    container[segment] = update(current[segment], depth + 1);
    return container;
  };

  return update(source, 0);
};

export const getValueType = (value) => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  if (typeof value === 'object') {
    if (
      value &&
      typeof value.mantissa === 'number' &&
      typeof value.exponent === 'number' &&
      Object.keys(value).length <= 3
    ) {
      return 'big-number';
    }

    return 'object';
  }

  return typeof value;
};

export const formatPreview = (value) => {
  const type = getValueType(value);

  if (type === 'big-number') {
    return `${value.mantissa}e${value.exponent}`;
  }

  if (type === 'array') {
    return `${value.length} items`;
  }

  if (type === 'object') {
    return `${Object.keys(value).length} keys`;
  }

  if (type === 'string') {
    return value.length > 72 ? `${value.slice(0, 69)}...` : value;
  }

  if (type === 'undefined') {
    return 'undefined';
  }

  return String(value);
};

const getChildren = (value) => {
  if (Array.isArray(value)) {
    return value.map((child, index) => [index, child]);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value);
  }

  return [];
};

export const buildPathIndex = (data, saveType = 'pc') => {
  const nodes = [];

  const walk = (value, segments, parentPath = null) => {
    const type = getValueType(value);
    const path = formatPath(segments);
    const category = categorizePath(segments);
    const children = getChildren(value);
    const isContainer = type === 'object' || type === 'array' || type === 'big-number';

    nodes.push({
      id: path,
      path,
      parentPath,
      key: segments.length === 0 ? 'root' : String(segments[segments.length - 1]),
      segments,
      depth: segments.length,
      type,
      categoryId: category.id,
      categoryTitle: category.title,
      stage: category.stage,
      childCount: children.length,
      isContainer,
      isLeaf: children.length === 0,
      editable: true,
      preview: formatPreview(value),
      saveType,
    });

    for (const [childKey, childValue] of children) {
      walk(childValue, [...segments, childKey], path);
    }
  };

  walk(data, []);
  return nodes;
};

export const calculateCoverage = (nodes) => {
  const categoryCounts = Object.fromEntries(CATEGORIES.map((category) => [category.id, 0]));
  let leafCount = 0;
  let containerCount = 0;

  for (const node of nodes) {
    categoryCounts[node.categoryId] = (categoryCounts[node.categoryId] ?? 0) + 1;

    if (node.isContainer) {
      containerCount += 1;
    } else {
      leafCount += 1;
    }
  }

  return {
    total: nodes.length,
    leafCount,
    containerCount,
    editableCount: nodes.filter((node) => node.editable).length,
    categoryCounts,
    uncategorizedCount: categoryCounts.unknown ?? 0,
  };
};

export const valuesAreEqual = (left, right) => {
  return JSON.stringify(left) === JSON.stringify(right);
};

export const buildChangeIndex = (originalData, currentData, saveType = 'pc') => {
  if (!originalData || !currentData) {
    return [];
  }

  const originalNodes = buildPathIndex(originalData, saveType);
  const currentNodes = buildPathIndex(currentData, saveType);
  const nodeByPath = new Map();

  for (const node of originalNodes) {
    nodeByPath.set(node.path, {
      originalNode: node,
      currentNode: null,
    });
  }

  for (const node of currentNodes) {
    const existing = nodeByPath.get(node.path);

    if (existing) {
      existing.currentNode = node;
    } else {
      nodeByPath.set(node.path, {
        originalNode: null,
        currentNode: node,
      });
    }
  }

  return [...nodeByPath.values()]
    .map(({ originalNode, currentNode }) => {
      const node = currentNode ?? originalNode;
      const beforeValue = originalNode ? getValueAtSegments(originalData, originalNode.segments) : undefined;
      const afterValue = currentNode ? getValueAtSegments(currentData, currentNode.segments) : undefined;

      if (valuesAreEqual(beforeValue, afterValue)) {
        return null;
      }

      let changeType = 'changed';
      if (!originalNode) {
        changeType = 'added';
      } else if (!currentNode) {
        changeType = 'removed';
      }

      return {
        id: node.path,
        path: node.path,
        key: node.key,
        segments: node.segments,
        depth: node.depth,
        categoryId: node.categoryId,
        categoryTitle: node.categoryTitle,
        stage: node.stage,
        type: currentNode?.type ?? originalNode?.type ?? 'unknown',
        beforeType: originalNode?.type ?? 'missing',
        afterType: currentNode?.type ?? 'missing',
        beforePreview: originalNode ? formatPreview(beforeValue) : 'Missing',
        afterPreview: currentNode ? formatPreview(afterValue) : 'Missing',
        childCount: currentNode?.childCount ?? originalNode?.childCount ?? 0,
        isContainer: Boolean(currentNode?.isContainer ?? originalNode?.isContainer),
        changeType,
        saveType,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.isContainer !== right.isContainer) {
        return left.isContainer ? 1 : -1;
      }

      if (left.depth !== right.depth) {
        return left.depth - right.depth;
      }

      return left.path.localeCompare(right.path);
    });
};
