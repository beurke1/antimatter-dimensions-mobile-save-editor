import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createComprehensiveAndroidSave,
  createComprehensivePcSave,
  createNormalAndroidSave,
  createNormalPcSave,
} from './fixture-saves.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = path.resolve(process.env.MOBILE_VIEWPORT_ARTIFACT_DIR ?? path.join(root, 'artifacts/mobile-viewport'));
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const mimeTypes = new Map([
  ['.html', 'text/html;charset=utf-8'],
  ['.css', 'text/css;charset=utf-8'],
  ['.js', 'text/javascript;charset=utf-8'],
  ['.mjs', 'text/javascript;charset=utf-8'],
  ['.json', 'application/json;charset=utf-8'],
  ['.txt', 'text/plain;charset=utf-8'],
]);

const commandPath = (command) => {
  const result = spawnSync('which', [command], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
};

const chromePath = () => {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const found = commandPath(command);
    if (found) {
      return found;
    }
  }

  throw new Error('Chrome was not found. Set CHROME_BIN to run mobile viewport verification.');
};

const freePort = async () => {
  const server = createNetServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
};

const startStaticServer = async () => {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/u, '');
      const filePath = path.resolve(root, relativePath);

      if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      const body = await readFile(filePath);
      response.writeHead(200, {
        'Content-Type': mimeTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      if (response.headersSent) {
        response.destroy();
        return;
      }

      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
  };
};

const waitFor = async (work, label, timeoutMs = 10_000, getDiagnostic = () => '') => {
  const start = Date.now();
  let lastError;

  while (Date.now() - start < timeoutMs) {
    try {
      const value = await work();
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(80);
  }

  const diagnostic = getDiagnostic();
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}${diagnostic ? `\n${diagnostic}` : ''}`);
};

const startChrome = async () => {
  const executable = chromePath();
  const debuggingPort = await freePort();
  const temporaryRoot = existsSync('/private/tmp') ? '/private/tmp' : tmpdir();
  const profileDir = path.join(temporaryRoot, `ad-save-editor-chrome-${process.pid}-${Date.now()}`);
  const chromeProcess = spawn(executable, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-sandbox',
    '--password-store=basic',
    '--use-mock-keychain',
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let stderr = '';
  chromeProcess.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exit = new Promise((resolve) => {
    chromeProcess.once('exit', (code, signal) => resolve({ code, signal }));
  });

  await waitFor(
    async () => {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/version`);
      return response.ok;
    },
    'Chrome DevTools startup',
    10_000,
    () => stderr.trim() ? `Chrome stderr:\n${stderr.trim().slice(-2000)}` : ''
  );

  return {
    executable,
    process: chromeProcess,
    debuggingPort,
    profileDir,
    exit,
    stderr: () => stderr,
  };
};

const stopChrome = async (chrome) => {
  if (!chrome) {
    return;
  }

  if (chrome.process.exitCode === null) {
    chrome.process.kill('SIGTERM');
    const exited = await Promise.race([
      chrome.exit.then(() => true),
      sleep(2000).then(() => false),
    ]);
    if (!exited && chrome.process.exitCode === null) {
      chrome.process.kill('SIGKILL');
      await chrome.exit;
    }
  }

  try {
    await rm(chrome.profileDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 120,
    });
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(`Could not remove Chrome profile directory ${chrome.profileDir}: ${error.message}`);
    }
  }
};

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());

      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result ?? {});
        return;
      }

      if (message.method && this.events.has(message.method)) {
        const resolvers = this.events.get(message.method);
        this.events.delete(message.method);
        for (const resolve of resolvers) {
          resolve(message.params ?? {});
        }
      }
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('Could not connect to Chrome DevTools.')), {
        once: true,
      });
    });
    return new Cdp(socket);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  waitEvent(method, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      const wrapped = (params) => {
        clearTimeout(timeout);
        resolve(params);
      };
      const timeout = setTimeout(() => {
        this.events.set(method, (this.events.get(method) ?? []).filter((candidate) => candidate !== wrapped));
        reject(new Error(`${method} timed out.`));
      }, timeoutMs);
      this.events.set(method, [...(this.events.get(method) ?? []), wrapped]);
    });
  }

  close() {
    this.socket.close();
  }
}

const createTarget = async (debuggingPort) => {
  const url = `http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent('about:blank')}`;
  let response = await fetch(url, { method: 'PUT' });
  if (!response.ok) {
    response = await fetch(url);
  }
  if (!response.ok) {
    throw new Error(`Could not create Chrome target: HTTP ${response.status}`);
  }
  return response.json();
};

const evaluate = async (client, expression) => {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
};

const iphoneUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const viewports = {
  iphoneSe: {
    name: 'iPhone SE',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    userAgent: iphoneUserAgent,
  },
  iphone15: {
    name: 'iPhone 15',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    userAgent: iphoneUserAgent,
  },
};

const createWarningHeavyPcSave = () => ({
  antimatter: { mantissa: 1, exponent: 1200.5 },
  dimensions: {
    antimatter: [
      {
        bought: -1.5,
        amount: { mantissa: 2, exponent: 4 },
      },
    ],
  },
  infinityPoints: { mantissa: 1, exponent: 250 },
  dimensionBoosts: 1.5,
  galaxies: -1,
  eternityPoints: { mantissa: 1, exponent: 60 },
  realities: { mantissa: 1, exponent: 1 },
  version: 14.5,
  lastUpdate: 1700000000000,
  options: {
    notation: 'Scientific',
  },
});

const openApp = async (client, appUrl, viewport) => {
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: true,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await client.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  await client.send('Network.setUserAgentOverride', {
    userAgent: viewport.userAgent,
  });

  const loaded = client.waitEvent('Page.loadEventFired');
  await client.send('Page.navigate', { url: appUrl });
  await loaded;

  const ready = await evaluate(client, `
    (async () => {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        if (document.querySelector('#app .import-panel')) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return false;
    })()
  `);
  assert.equal(ready, true, 'App shell did not render.');
};

const decodeSave = async (client, saveData) => {
  const saveText = JSON.stringify(saveData);
  const result = await evaluate(client, `
    (async () => {
      const input = document.querySelector('#raw-save');
      input.value = ${JSON.stringify(saveText)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-action="decode"]').click();

      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        if (document.querySelector('.path-card')) {
          return {
            notice: document.querySelector('.notice')?.textContent.trim() ?? '',
            visibleCards: document.querySelectorAll('.path-card').length,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return {
        notice: document.querySelector('.notice')?.textContent.trim() ?? '',
        visibleCards: document.querySelectorAll('.path-card').length,
      };
    })()
  `);
  assert.ok(result.visibleCards > 0, 'Fixture decode did not render editable path cards.');
  return result;
};

const expandSafetyPanel = async (client, minimumRows) => {
  return evaluate(client, `
    (() => {
      const beforeRows = document.querySelectorAll('.safety-row').length;
      const toggle = document.querySelector('[data-action="toggle-safety-list"]');
      if (toggle) toggle.click();
      const afterRows = document.querySelectorAll('.safety-row').length;
      const opener = document.querySelector('[data-action="open-safety-path"]');
      const openedPath = opener?.dataset.issuePath ?? '';
      if (opener) opener.click();
      const searchValue = document.querySelector('#path-search')?.value ?? '';
      return {
        beforeRows,
        afterRows,
        hasToggle: Boolean(toggle),
        hasPathOpener: Boolean(opener),
        openedPath,
        searchValue,
        meetsMinimum: afterRows >= ${Number(minimumRows)},
        openedSearch: Boolean(openedPath) && searchValue === openedPath,
      };
    })()
  `);
};

const metrics = async (client) => {
  return evaluate(client, `
    (() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const hasHorizontalScrollParent = (element) => {
        let current = element.parentElement;
        while (current && current !== document.body && current !== document.documentElement) {
          const style = getComputedStyle(current);
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') return true;
          current = current.parentElement;
        }
        return false;
      };
      const summarize = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className || '',
          id: element.id || '',
          text: element.textContent.trim().replace(/\\s+/gu, ' ').slice(0, 90),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      };

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const documentScrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const documentScrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const overflowOffenders = Array.from(document.querySelectorAll('body *'))
        .filter((element) => visible(element) && !hasHorizontalScrollParent(element))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > viewportWidth + 1;
        })
        .slice(0, 12)
        .map(summarize);
      const undersizedControls = Array.from(document.querySelectorAll('button, input, select, textarea, summary, [role="switch"]'))
        .filter((element) => visible(element) && !element.disabled)
        .map(summarize)
        .filter((element) => element.width < 32 || element.height < 32)
        .slice(0, 12);
      const clippedControls = Array.from(document.querySelectorAll('button, input, select, textarea, summary'))
        .filter((element) => visible(element))
        .filter((element) => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).textOverflow !== 'ellipsis')
        .slice(0, 12)
        .map(summarize);

      window.scrollTo(0, document.documentElement.scrollHeight);
      const exportBar = document.querySelector('.export-bar')?.getBoundingClientRect();
      const lastPanel = document.querySelector('main')?.lastElementChild?.getBoundingClientRect();
      const bottomLayout = {
        exportTop: exportBar ? Math.round(exportBar.top) : null,
        lastPanelBottom: lastPanel ? Math.round(lastPanel.bottom) : null,
        hasBottomOverlap: Boolean(exportBar && lastPanel && lastPanel.bottom > exportBar.top + 1),
      };
      window.scrollTo(0, 0);

      return {
        viewportWidth,
        viewportHeight,
        documentScrollWidth,
        documentScrollHeight,
        overflowOffenders,
        undersizedControls,
        clippedControls,
        bottomLayout,
        visiblePathCards: document.querySelectorAll('.path-card').length,
        visibleCategories: document.querySelectorAll('.category-tabs button').length,
        coverage: Array.from(document.querySelectorAll('.coverage-grid div')).map((element) => ({
          label: element.querySelector('span')?.textContent.trim() ?? '',
          value: element.querySelector('strong')?.textContent.trim() ?? '',
        })),
      };
    })()
  `);
};

const screenshot = async (client, filePath) => {
  await evaluate(client, 'window.scrollTo(0, 0)');
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(filePath, Buffer.from(result.data, 'base64'));
};

const runCase = async ({ chrome, appUrl, caseConfig }) => {
  const target = await createTarget(chrome.debuggingPort);
  const client = await Cdp.connect(target.webSocketDebuggerUrl);

  try {
    await openApp(client, appUrl, caseConfig.viewport);
    const decoded = caseConfig.saveData ? await decodeSave(client, caseConfig.saveData) : null;
    const safetyPanel = caseConfig.minimumSafetyRows
      ? await expandSafetyPanel(client, caseConfig.minimumSafetyRows)
      : null;
    const caseMetrics = await metrics(client);
    const screenshotPath = path.join(artifactDir, `${caseConfig.name}.png`);
    await screenshot(client, screenshotPath);

    const failures = [];
    if (caseMetrics.documentScrollWidth > caseMetrics.viewportWidth + 1) {
      failures.push(`document scroll width ${caseMetrics.documentScrollWidth} exceeds viewport ${caseMetrics.viewportWidth}`);
    }
    if (caseMetrics.overflowOffenders.length > 0) {
      failures.push(`${caseMetrics.overflowOffenders.length} non-scroll-container overflow offender(s)`);
    }
    if (caseMetrics.undersizedControls.length > 0) {
      failures.push(`${caseMetrics.undersizedControls.length} control(s) below 32px touch floor`);
    }
    if (caseMetrics.clippedControls.length > 0) {
      failures.push(`${caseMetrics.clippedControls.length} clipped control(s) without ellipsis`);
    }
    if (caseMetrics.bottomLayout.hasBottomOverlap) {
      failures.push('last panel overlaps the fixed export bar at bottom scroll position');
    }
    const minimumCategories = caseConfig.minimumCategories ?? 8;
    if (caseConfig.saveData && caseMetrics.visibleCategories < minimumCategories) {
      failures.push('decoded save did not render the expected category tabs');
    }
    if (caseConfig.minimumSafetyRows && !safetyPanel?.hasToggle) {
      failures.push('warning-heavy save did not render a safety list toggle');
    }
    if (caseConfig.minimumSafetyRows && !safetyPanel?.meetsMinimum) {
      failures.push(`expanded safety list rendered ${safetyPanel?.afterRows ?? 0} rows, expected at least ${caseConfig.minimumSafetyRows}`);
    }
    if (caseConfig.minimumSafetyRows && !safetyPanel?.hasPathOpener) {
      failures.push('warning-heavy save did not render safety path open/find actions');
    }
    if (caseConfig.minimumSafetyRows && !safetyPanel?.openedSearch) {
      failures.push('safety path open/find action did not focus browser search on the issue path');
    }

    return {
      name: caseConfig.name,
      viewport: caseConfig.viewport.name,
      decoded,
      safetyPanel,
      metrics: caseMetrics,
      failures,
      screenshot: path.relative(root, screenshotPath),
    };
  } finally {
    client.close();
  }
};

await mkdir(artifactDir, { recursive: true });

const staticServer = await startStaticServer();
let chrome;

try {
  chrome = await startChrome();
  const appUrl = `${staticServer.origin}/`;
  const cases = [
    {
      name: 'empty-iphone-se',
      viewport: viewports.iphoneSe,
    },
    {
      name: 'pc-normal-iphone-se',
      viewport: viewports.iphoneSe,
      saveData: createNormalPcSave(),
    },
    {
      name: 'pc-fixture-iphone-15',
      viewport: viewports.iphone15,
      saveData: createComprehensivePcSave(),
    },
    {
      name: 'android-normal-iphone-15',
      viewport: viewports.iphone15,
      saveData: createNormalAndroidSave(),
    },
    {
      name: 'warnings-iphone-se',
      viewport: viewports.iphoneSe,
      saveData: createWarningHeavyPcSave(),
      minimumCategories: 4,
      minimumSafetyRows: 8,
    },
    {
      name: 'android-fixture-iphone-se',
      viewport: viewports.iphoneSe,
      saveData: createComprehensiveAndroidSave(),
    },
  ];

  const results = [];
  for (const caseConfig of cases) {
    results.push(await runCase({ chrome, appUrl, caseConfig }));
  }

  const reportPath = path.join(artifactDir, 'latest.json');
  await writeFile(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    chromePath: chrome.executable,
    appUrl,
    cases: results,
  }, null, 2));

  const failures = results.flatMap((result) => result.failures.map((failure) => `${result.name}: ${failure}`));
  if (failures.length > 0) {
    console.error(`Mobile viewport verification failed. Report: ${path.relative(root, reportPath)}`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Mobile viewport verification passed: ${results.length} cases.`);
    for (const result of results) {
      console.log(
        `- ${result.name}: ${result.metrics.viewportWidth}px viewport, ${result.metrics.documentScrollWidth}px scroll width, screenshot ${result.screenshot}`
      );
    }
    console.log(`Report: ${path.relative(root, reportPath)}`);
  }
} finally {
  await stopChrome(chrome);
  await new Promise((resolve) => staticServer.server.close(resolve));
}
