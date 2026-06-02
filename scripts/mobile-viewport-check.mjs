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
    25_000,
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

const decodeSaveFromSyntheticFile = async (client, saveData) => {
  const saveText = JSON.stringify(saveData);
  const result = await evaluate(client, `
    (async () => {
      const waitFor = async (predicate, label) => {
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const value = predicate();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(label + ' timed out');
      };

      const input = document.querySelector('#file-input');
      if (!input) throw new Error('Missing file input');

      const saveText = ${JSON.stringify(saveText)};
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([saveText], 'decoded-pc-save.json', { type: 'application/json' }));
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      await waitFor(() => document.querySelector('#raw-save')?.value === saveText, 'file text load');
      const loadedNotice = document.querySelector('.notice')?.textContent.trim() ?? '';
      const sourceTextMatches = document.querySelector('#raw-save')?.value === saveText;

      document.querySelector('[data-action="decode"]').click();
      await waitFor(() => document.querySelector('.path-card'), 'file decode');

      return {
        loadedNotice,
        notice: document.querySelector('.notice')?.textContent.trim() ?? '',
        rawInputLength: saveText.length,
        sourceTextMatches,
        visibleCards: document.querySelectorAll('.path-card').length,
      };
    })()
  `);
  assert.equal(result.sourceTextMatches, true, 'Synthetic file import did not populate the save text area.');
  assert.ok(result.visibleCards > 0, 'Synthetic file import did not render editable path cards.');
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

const exerciseNavigationWorkflow = async (client, workflow) => {
  return evaluate(client, `
    (async () => {
      const waitFor = async (predicate, label) => {
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const value = predicate();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(label + ' timed out');
      };
      const cards = () => Array.from(document.querySelectorAll('.path-card'));
      const paths = () => cards().map((card) => card.dataset.nodePath ?? '');
      const clickAction = async (selector, label) => {
        const button = document.querySelector(selector);
        if (!button) throw new Error('Missing ' + label);
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 80));
      };
      const setSearch = async (value) => {
        const input = document.querySelector('#path-search');
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 80));
      };
      const setType = async (value) => {
        const select = document.querySelector('#type-filter');
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 80));
      };

      if (${JSON.stringify(workflow)} !== 'pc-navigation') return null;

      const initialCards = cards().length;
      await clickAction('[data-action="set-category"][data-category-id="celestials"]', 'Celestials category');
      await waitFor(() => cards().length > 0 && paths().every((path) => path.startsWith('celestials')), 'Celestials category filter');
      const celestialsCards = cards().length;
      const celestialsAllMatch = paths().every((path) => path.startsWith('celestials'));

      await clickAction('[data-action="set-category"][data-category-id="all"]', 'All category');
      await clickAction('[data-action="set-stage"][data-stage-id="reality"]', 'Reality stage');
      await waitFor(() => cards().length > 0, 'Reality stage filter');
      const realityCards = cards().length;
      const realityActive = document.querySelector('[data-action="set-stage"][data-stage-id="reality"]')?.classList.contains('active') ?? false;

      await clickAction('[data-action="set-stage"][data-stage-id="all"]', 'All stage');
      await setSearch('replicanti.amount');
      await waitFor(() => paths().some((path) => path === 'replicanti.amount'), 'Path search');
      const searchPaths = paths();

      await setSearch('');
      await setType('boolean');
      await waitFor(() => cards().length > 0, 'Boolean type filter');
      const booleanCards = cards().length;
      const booleanCardsMatch = cards().every((card) => Array.from(card.querySelectorAll('.badge')).some((badge) => badge.textContent.trim() === 'boolean'));

      await setType('all');
      await clickAction('[data-action="toggle-changed-filter"]', 'Changed-only filter');
      await waitFor(() => document.querySelector('[data-action="toggle-changed-filter"]')?.classList.contains('active'), 'Changed-only active');
      const changedOnlyCards = cards().length;
      await clickAction('[data-action="toggle-changed-filter"]', 'Changed-only filter reset');
      await waitFor(() => cards().length > 0, 'Changed-only reset');

      return {
        workflow: 'pc-navigation',
        initialCards,
        celestialsCards,
        celestialsAllMatch,
        realityCards,
        realityActive,
        searchCards: searchPaths.length,
        searchMatchedReplicanti: searchPaths.includes('replicanti.amount'),
        booleanCards,
        booleanCardsMatch,
        changedOnlyCards,
      };
    })()
  `);
};

const exerciseQaWorkflow = async (client, workflow) => {
  return evaluate(client, `
    (async () => {
      if (${JSON.stringify(workflow)} !== 'value-free-copy') return null;

      const waitFor = async (predicate, label) => {
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const value = predicate();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(label + ' timed out');
      };
      const clickAction = async (selector, label) => {
        const button = document.querySelector(selector);
        if (!button) throw new Error('Missing ' + label);
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 80));
      };

      const writes = [];
      const downloads = [];
      const originalCreateObjectUrl = URL.createObjectURL;
      const originalRevokeObjectUrl = URL.revokeObjectURL;
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      const clipboard = {
        writeText: async (value) => {
          writes.push(String(value));
          window.__adSaveEditorClipboardWrites = writes;
        },
        readText: async () => writes.at(-1) ?? '',
      };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: clipboard,
      });
      window.__adSaveEditorClipboardWrites = writes;
      URL.createObjectURL = (blob) => {
        const href = 'blob:ad-save-editor-report-test-' + downloads.length;
        downloads.push({ href, blob, download: '' });
        window.__adSaveEditorReportDownloads = downloads;
        return href;
      };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function click() {
        const latest = downloads.at(-1);
        if (latest) latest.download = this.download;
      };

      try {
        await clickAction('[data-action="toggle-details"]', 'coverage details toggle');
        await waitFor(() => document.querySelector('.coverage-panel'), 'coverage panel');

        await clickAction('[data-action="copy-qa-summary"]', 'Copy QA summary');
        await waitFor(() => window.__adSaveEditorClipboardWrites?.length >= 1, 'QA summary copy');
        const qaSummary = window.__adSaveEditorClipboardWrites.at(-1) ?? '';

        await clickAction('[data-action="copy-report"]', 'Copy report');
        await waitFor(() => window.__adSaveEditorClipboardWrites?.length >= 2, 'coverage report copy');
        const reportText = window.__adSaveEditorClipboardWrites.at(-1) ?? '';

        await clickAction('[data-action="download-report"]', 'Download coverage report');
        await waitFor(() => downloads.length >= 1 && downloads.at(-1).download, 'coverage report download');
        const downloadedReportText = await downloads.at(-1).blob.text();

        let report = null;
        let downloadedReport = null;
        try {
          report = JSON.parse(reportText);
        } catch {
          report = null;
        }
        try {
          downloadedReport = JSON.parse(downloadedReportText);
        } catch {
          downloadedReport = null;
        }

        const leakedFixtures = ['AntimatterDimensionsSavefileFormat', 'AntimatterDimensionsAndroidSaveFormat', 'Mixed scientific', '1700000000000'];
        const summaryValueFree = leakedFixtures.every((fixtureValue) => !qaSummary.includes(fixtureValue));
        const reportValueFree = leakedFixtures.every((fixtureValue) => !reportText.includes(fixtureValue));
        const downloadedReportValueFree = leakedFixtures.every((fixtureValue) => !downloadedReportText.includes(fixtureValue));

        return {
          workflow: 'value-free-copy',
          clipboardWrites: window.__adSaveEditorClipboardWrites.length,
          qaSummaryCopied: qaSummary.includes('Antimatter Dimensions Real-Save QA Summary'),
          qaSummaryHasCounts: qaSummary.includes('- Paths:') && qaSummary.includes('## Safety') && qaSummary.includes('## Safety Issue Counts'),
          summaryValueFree,
          reportCopied: Boolean(report),
          reportHasTotals: Number(report?.totals?.paths ?? 0) > 20,
          reportHasSafety: typeof report?.safety?.error === 'number',
          reportHasSafetyIssueCounts: Boolean(report?.safetyIssueCounts) && typeof report.safetyIssueCounts === 'object' && !Array.isArray(report.safetyIssueCounts),
          reportValueFree,
          reportDownloaded: Boolean(downloadedReport),
          reportDownloadFilename: downloads.at(-1).download,
          reportDownloadMatchesCopy: downloadedReportText === reportText,
          downloadedReportHasTotals: Number(downloadedReport?.totals?.paths ?? 0) > 20,
          downloadedReportHasSafety: typeof downloadedReport?.safety?.error === 'number',
          downloadedReportHasSafetyIssueCounts: Boolean(downloadedReport?.safetyIssueCounts) && typeof downloadedReport.safetyIssueCounts === 'object' && !Array.isArray(downloadedReport.safetyIssueCounts),
          downloadedReportValueFree,
        };
      } finally {
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
        HTMLAnchorElement.prototype.click = originalAnchorClick;
      }
    })()
  `);
};

const exerciseExportWorkflow = async (client, workflow) => {
  return evaluate(client, `
    (async () => {
      if (${JSON.stringify(workflow)} !== 'encoded-output-actions') return null;

      const waitFor = async (predicate, label) => {
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const value = predicate();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(label + ' timed out');
      };
      const clickAction = async (selector, label) => {
        const button = document.querySelector(selector);
        if (!button) throw new Error('Missing ' + label);
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 80));
      };

      const encoded = await waitFor(() => document.querySelector('#encoded-output')?.value, 'encoded output');
      const clipboardWrites = [];
      const nativeShares = [];
      const downloads = [];
      const originalCreateObjectUrl = URL.createObjectURL;
      const originalRevokeObjectUrl = URL.revokeObjectURL;
      const originalAnchorClick = HTMLAnchorElement.prototype.click;

      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value) => {
            clipboardWrites.push(String(value));
            window.__adSaveEditorExportClipboardWrites = clipboardWrites;
          },
          readText: async () => clipboardWrites.at(-1) ?? '',
        },
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (payload) => {
          nativeShares.push(payload);
          window.__adSaveEditorNativeShares = nativeShares;
        },
      });
      URL.createObjectURL = (blob) => {
        const href = 'blob:ad-save-editor-test-' + downloads.length;
        downloads.push({ href, blob, download: '' });
        window.__adSaveEditorDownloads = downloads;
        return href;
      };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function click() {
        const latest = downloads.at(-1);
        if (latest) latest.download = this.download;
      };

      try {
        await clickAction('[data-action="copy"]', 'Copy output');
        await waitFor(() => clipboardWrites.length >= 1, 'output copy');

        await clickAction('[data-action="share"]', 'native Share output');
        await waitFor(() => nativeShares.length >= 1, 'native share');

        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: undefined,
        });
        await clickAction('[data-action="share"]', 'fallback Share output');
        await waitFor(() => clipboardWrites.length >= 2, 'share fallback copy');

        await clickAction('.output-panel [data-action="download"]', 'Download output');
        await waitFor(() => downloads.length >= 1 && downloads.at(-1).download, 'download output');
        const downloadText = await downloads.at(-1).blob.text();

        return {
          workflow: 'encoded-output-actions',
          encodedPrefix: encoded.slice(0, 37),
          copyWroteEncoded: clipboardWrites[0] === encoded,
          nativeShareCalled: nativeShares.length === 1,
          nativeShareTextMatches: nativeShares[0]?.text === encoded,
          fallbackShareCopied: clipboardWrites.at(-1) === encoded,
          downloadFilename: downloads.at(-1).download,
          downloadTextMatches: downloadText === encoded,
          clipboardWrites: clipboardWrites.length,
        };
      } finally {
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
        HTMLAnchorElement.prototype.click = originalAnchorClick;
      }
    })()
  `);
};

const exercisePresetWorkflow = async (client, workflow) => {
  return evaluate(client, `
    (async () => {
      const waitFor = async (predicate, label) => {
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const value = predicate();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(label + ' timed out');
      };
      const card = (path) => document.querySelector(\`[data-node-path="\${CSS.escape(path)}"]\`);
      const presetButtons = () => Array.from(document.querySelectorAll('[data-action="apply-preset"]'));
      const presetIds = () => presetButtons().map((button) => button.dataset.presetId ?? '');
      const clickPreset = (presetId) => {
        const button = document.querySelector(\`[data-action="apply-preset"][data-preset-id="\${CSS.escape(presetId)}"]\`);
        if (!button) throw new Error(\`Missing preset \${presetId}\`);
        button.click();
      };

      if (${JSON.stringify(workflow)} === 'pc-normal-preset') {
        const beforePresetIds = presetIds();
        clickPreset('antimatter-e308');
        await waitFor(() => card('antimatter')?.classList.contains('changed'), 'PC preset antimatter change');

        const antimatterInput = card('antimatter')?.querySelector('[data-editor-type="string"]');
        document.querySelector('[data-action="encode"]').click();
        const encoded = await waitFor(() => document.querySelector('#encoded-output')?.value, 'PC preset encode');

        return {
          workflow: 'pc-normal-preset',
          presetCount: beforePresetIds.length,
          normalOnlyPresets: beforePresetIds.length === 3 &&
            beforePresetIds.includes('antimatter-e308') &&
            !beforePresetIds.includes('break-infinity') &&
            !beforePresetIds.includes('reality-machines-1000'),
          antimatterChanged: card('antimatter')?.classList.contains('changed') ?? false,
          antimatterInputType: antimatterInput?.dataset.editorType ?? '',
          antimatterInputValue: antimatterInput?.value ?? '',
          encodedPrefix: encoded.slice(0, 37),
          reviewRowPresent: Array.from(document.querySelectorAll('.change-row')).some((row) => row.dataset.changePath === 'antimatter'),
        };
      }

      if (${JSON.stringify(workflow)} === 'android-normal-preset') {
        const beforePresetIds = presetIds();
        clickPreset('antimatter-e308');
        await waitFor(() => card('antimatter')?.classList.contains('changed'), 'Android preset antimatter change');

        const mantissaInput = card('antimatter')?.querySelector('[data-editor-type="big-mantissa"]');
        const exponentInput = card('antimatter')?.querySelector('[data-editor-type="big-exponent"]');
        document.querySelector('[data-action="encode"]').click();
        const encoded = await waitFor(() => document.querySelector('#encoded-output')?.value, 'Android preset encode');

        return {
          workflow: 'android-normal-preset',
          presetCount: beforePresetIds.length,
          normalOnlyPresets: beforePresetIds.length === 3 &&
            beforePresetIds.includes('antimatter-e308') &&
            !beforePresetIds.includes('break-infinity') &&
            !beforePresetIds.includes('reality-machines-1000'),
          antimatterChanged: card('antimatter')?.classList.contains('changed') ?? false,
          hasBigNumberEditor: Boolean(mantissaInput && exponentInput),
          mantissaValue: mantissaInput?.value ?? '',
          exponentValue: exponentInput?.value ?? '',
          encodedPrefix: encoded.slice(0, 39),
          reviewRowPresent: Array.from(document.querySelectorAll('.change-row')).some((row) => row.dataset.changePath === 'antimatter'),
        };
      }

      return null;
    })()
  `);
};

const exerciseEditorWorkflow = async (client, workflow) => {
  return evaluate(client, `
    (async () => {
      const waitFor = async (predicate, label) => {
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const value = predicate();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(label + ' timed out');
      };
      const card = (path) => document.querySelector(\`[data-node-path="\${CSS.escape(path)}"]\`);
      const clickScope = async (path) => {
        const button = document.querySelector(\`[data-action="set-scope"][data-scope-path="\${CSS.escape(path)}"]\`);
        if (!button) throw new Error(\`Missing scope button for \${path}\`);
        button.click();
        await waitFor(() => card(path), \`scope \${path}\`);
      };
      const setEditorValue = (path, selector, value) => {
        const input = card(path)?.querySelector(selector);
        if (!input) throw new Error(\`Missing editor for \${path}\`);
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };

      if (${JSON.stringify(workflow)} === 'pc-basic') {
        setEditorValue('options.notation', '[data-editor-type="string"]', 'Engineering');
        await waitFor(() => card('options.notation')?.classList.contains('changed'), 'PC string edit');

        card('buyUntil10')?.querySelector('[data-action="toggle-boolean"]')?.click();
        await waitFor(() => card('buyUntil10')?.classList.contains('changed'), 'PC boolean edit');

        const optionsCard = card('options');
        if (!optionsCard) throw new Error('Missing options card');
        optionsCard.querySelector('.subtree-editor').open = true;
        const subtree = optionsCard.querySelector('.subtree-textarea');
        const optionsJson = JSON.parse(subtree.value);
        optionsJson.confirmations.bigCrunch = false;
        subtree.value = JSON.stringify(optionsJson, null, 2);
        optionsCard.querySelector('[data-action="apply-subtree-json"]').click();
        await waitFor(() => card('options.confirmations.bigCrunch')?.classList.contains('changed'), 'PC subtree JSON edit');

        card('buyUntil10')?.querySelector('[data-action="reset-node"]')?.click();
        await waitFor(() => !card('buyUntil10')?.classList.contains('changed'), 'PC reset');

        document.querySelector('[data-action="encode"]').click();
        const encoded = await waitFor(() => document.querySelector('#encoded-output')?.value, 'PC encode');
        return {
          workflow: 'pc-basic',
          encodedPrefix: encoded.slice(0, 37),
          changedRows: document.querySelectorAll('.path-card.changed').length,
          notationChanged: card('options.notation')?.classList.contains('changed') ?? false,
          subtreeChanged: card('options.confirmations.bigCrunch')?.classList.contains('changed') ?? false,
          booleanReset: !(card('buyUntil10')?.classList.contains('changed') ?? true),
        };
      }

      if (${JSON.stringify(workflow)} === 'review-reset-all') {
        setEditorValue('options.notation', '[data-editor-type="string"]', 'Engineering');
        await waitFor(() => card('options.notation')?.classList.contains('changed'), 'review string edit');

        card('buyUntil10')?.querySelector('[data-action="toggle-boolean"]')?.click();
        await waitFor(() => card('buyUntil10')?.classList.contains('changed'), 'review boolean edit');

        await waitFor(() => document.querySelector('.change-review'), 'review panel');
        const reviewRowsBefore = Array.from(document.querySelectorAll('.change-row'));
        const reviewText = document.querySelector('.change-review')?.textContent ?? '';
        const reviewContainsNotation = reviewRowsBefore.some((row) => row.dataset.changePath === 'options.notation' && row.textContent.includes('Mixed scientific') && row.textContent.includes('Engineering'));
        const reviewContainsBoolean = reviewRowsBefore.some((row) => row.dataset.changePath === 'buyUntil10');

        const changedToggle = () => document.querySelector('[data-action="toggle-changed-filter"]');
        changedToggle()?.click();
        await waitFor(() => changedToggle()?.classList.contains('active'), 'changed-only after edits');
        await waitFor(() => document.querySelectorAll('.path-card.changed').length > 0, 'changed-only cards after edits');
        const changedOnlyCards = Array.from(document.querySelectorAll('.path-card'));
        const changedOnlyAllChanged = changedOnlyCards.length > 0 && changedOnlyCards.every((changedCard) => changedCard.classList.contains('changed'));
        const changedOnlyIncludesNotation = changedOnlyCards.some((changedCard) => changedCard.dataset.nodePath === 'options.notation');
        changedToggle()?.click();
        await waitFor(() => !changedToggle()?.classList.contains('active'), 'changed-only reset before review reset');

        document.querySelector('[data-change-path="buyUntil10"] [data-action="reset-change"]')?.click();
        await waitFor(() => !card('buyUntil10')?.classList.contains('changed'), 'review row reset');
        const booleanReviewReset = !Array.from(document.querySelectorAll('.change-row')).some((row) => row.dataset.changePath === 'buyUntil10');

        document.querySelector('[data-action="reset-all"]')?.click();
        await waitFor(() => !document.querySelector('.change-review'), 'review reset all');
        await waitFor(() => document.querySelectorAll('.path-card.changed').length === 0, 'changed cards cleared');
        const changedToggleText = document.querySelector('[data-action="toggle-changed-filter"]')?.textContent.trim() ?? '';

        return {
          workflow: 'review-reset-all',
          reviewRendered: Boolean(reviewText),
          reviewRowsBefore: reviewRowsBefore.length,
          reviewContainsNotation,
          reviewContainsBoolean,
          changedOnlyCards: changedOnlyCards.length,
          changedOnlyAllChanged,
          changedOnlyIncludesNotation,
          booleanReviewReset,
          resetAllCleared: !document.querySelector('.change-review') && document.querySelectorAll('.path-card.changed').length === 0,
          changedToggleCleared: changedToggleText === 'No changes yet',
          visibleCardsAfterReset: document.querySelectorAll('.path-card').length,
        };
      }

      if (${JSON.stringify(workflow)} === 'deep-scope-edit') {
        await clickScope('celestials');
        await clickScope('celestials.ra');
        await clickScope('celestials.ra.pets');
        await clickScope('celestials.ra.pets.teresa');

        setEditorValue('celestials.ra.pets.teresa.level', '[data-editor-type="number"]', '11');
        await waitFor(() => card('celestials.ra.pets.teresa.level')?.classList.contains('changed'), 'deep celestial edit');

        document.querySelector('[data-action="encode"]').click();
        const encoded = await waitFor(() => document.querySelector('#encoded-output')?.value, 'deep PC encode');
        const activeBreadcrumb = Array.from(document.querySelectorAll('.breadcrumbs button.active'))
          .map((button) => button.textContent.trim())
          .join(' ');
        return {
          workflow: 'deep-scope-edit',
          encodedPrefix: encoded.slice(0, 37),
          activeBreadcrumb,
          levelChanged: card('celestials.ra.pets.teresa.level')?.classList.contains('changed') ?? false,
          changedRows: document.querySelectorAll('.path-card.changed').length,
        };
      }

      if (${JSON.stringify(workflow)} === 'android-big-number') {
        setEditorValue('antimatter', '[data-editor-type="big-mantissa"]', '2');
        await waitFor(() => card('antimatter')?.classList.contains('changed'), 'Android mantissa edit');
        setEditorValue('antimatter', '[data-editor-type="big-exponent"]', '12');
        await waitFor(() => card('antimatter')?.textContent.includes('2e12') || card('antimatter')?.classList.contains('changed'), 'Android exponent edit');

        document.querySelector('[data-action="encode"]').click();
        const encoded = await waitFor(() => document.querySelector('#encoded-output')?.value, 'Android encode');
        return {
          workflow: 'android-big-number',
          encodedPrefix: encoded.slice(0, 39),
          antimatterChanged: card('antimatter')?.classList.contains('changed') ?? false,
          changedRows: document.querySelectorAll('.path-card.changed').length,
        };
      }

      return null;
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
    const decoded = caseConfig.fileImportData
      ? await decodeSaveFromSyntheticFile(client, caseConfig.fileImportData)
      : caseConfig.saveData
        ? await decodeSave(client, caseConfig.saveData)
        : null;
    const safetyPanel = caseConfig.minimumSafetyRows
      ? await expandSafetyPanel(client, caseConfig.minimumSafetyRows)
      : null;
    const navigationWorkflow = caseConfig.navigationWorkflow
      ? await exerciseNavigationWorkflow(client, caseConfig.navigationWorkflow)
      : null;
    const qaWorkflow = caseConfig.qaWorkflow
      ? await exerciseQaWorkflow(client, caseConfig.qaWorkflow)
      : null;
    const presetWorkflow = caseConfig.presetWorkflow
      ? await exercisePresetWorkflow(client, caseConfig.presetWorkflow)
      : null;
    const editorWorkflow = caseConfig.editorWorkflow
      ? await exerciseEditorWorkflow(client, caseConfig.editorWorkflow)
      : null;
    const exportWorkflow = caseConfig.exportWorkflow
      ? await exerciseExportWorkflow(client, caseConfig.exportWorkflow)
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
    if (caseConfig.navigationWorkflow === 'pc-navigation') {
      if (!navigationWorkflow?.celestialsAllMatch) failures.push('Celestials category filter rendered non-Celestials paths');
      if (!navigationWorkflow?.realityActive || !navigationWorkflow?.realityCards) failures.push('Reality stage filter did not activate with visible paths');
      if (!navigationWorkflow?.searchMatchedReplicanti) failures.push('Search did not surface replicanti.amount');
      if (!navigationWorkflow?.booleanCardsMatch) failures.push('Boolean type filter rendered non-boolean cards');
      if (navigationWorkflow?.changedOnlyCards !== 0) failures.push('Changed-only filter showed rows before edits');
    }
    if (caseConfig.fileImportData) {
      if (!decoded?.sourceTextMatches || !decoded?.visibleCards) failures.push('decoded JSON file import did not render editable cards');
    }
    if (caseConfig.qaWorkflow === 'value-free-copy') {
      if (!qaWorkflow?.qaSummaryCopied || !qaWorkflow?.qaSummaryHasCounts) failures.push('rendered QA summary copy did not include the expected value-free report sections');
      if (!qaWorkflow?.summaryValueFree) failures.push('rendered QA summary copy leaked fixture values or encoded save text');
      if (!qaWorkflow?.reportCopied || !qaWorkflow?.reportHasTotals || !qaWorkflow?.reportHasSafety || !qaWorkflow?.reportHasSafetyIssueCounts) {
        failures.push('rendered coverage report copy did not produce the expected JSON report');
      }
      if (!qaWorkflow?.reportValueFree) failures.push('rendered coverage report copy leaked fixture values or encoded save text');
      if (!qaWorkflow?.reportDownloaded || !qaWorkflow?.downloadedReportHasTotals || !qaWorkflow?.downloadedReportHasSafety || !qaWorkflow?.downloadedReportHasSafetyIssueCounts) {
        failures.push('rendered coverage report download did not produce the expected JSON report');
      }
      if (qaWorkflow?.reportDownloadFilename !== 'antimatter-dimensions-coverage-report.json' || !qaWorkflow?.reportDownloadMatchesCopy) {
        failures.push('rendered coverage report download did not match the copied JSON report');
      }
      if (!qaWorkflow?.downloadedReportValueFree) failures.push('rendered coverage report download leaked fixture values or encoded save text');
    }
    if (caseConfig.presetWorkflow === 'pc-normal-preset') {
      if (!presetWorkflow?.normalOnlyPresets) failures.push('PC Normal preset panel did not restrict visible presets to Normal-stage presets');
      if (!presetWorkflow?.antimatterChanged || !presetWorkflow?.reviewRowPresent) failures.push('PC preset did not mark antimatter changed for review');
      if (presetWorkflow?.antimatterInputType !== 'string' || presetWorkflow?.antimatterInputValue !== '1.79e308') {
        failures.push('PC preset did not preserve decimal-string rendering');
      }
      if (!presetWorkflow?.encodedPrefix?.startsWith('AntimatterDimensionsSavefileFormat')) failures.push('PC preset workflow did not produce an encoded PC save');
    }
    if (caseConfig.presetWorkflow === 'android-normal-preset') {
      if (!presetWorkflow?.normalOnlyPresets) failures.push('Android Normal preset panel did not restrict visible presets to Normal-stage presets');
      if (!presetWorkflow?.antimatterChanged || !presetWorkflow?.reviewRowPresent) failures.push('Android preset did not mark antimatter changed for review');
      if (!presetWorkflow?.hasBigNumberEditor || presetWorkflow?.mantissaValue !== '1.79' || presetWorkflow?.exponentValue !== '308') {
        failures.push('Android preset did not preserve mantissa/exponent rendering');
      }
      if (!presetWorkflow?.encodedPrefix?.startsWith('AntimatterDimensionsAndroidSaveFormat')) failures.push('Android preset workflow did not produce an encoded Android save');
    }
    if (caseConfig.editorWorkflow === 'pc-basic') {
      if (!editorWorkflow?.notationChanged) failures.push('PC string editor did not mark notation changed');
      if (!editorWorkflow?.subtreeChanged) failures.push('PC subtree JSON editor did not mark nested option changed');
      if (!editorWorkflow?.booleanReset) failures.push('PC reset action did not clear boolean change');
      if (!editorWorkflow?.encodedPrefix?.startsWith('AntimatterDimensionsSavefileFormat')) {
        failures.push('PC editor workflow did not produce an encoded PC save');
      }
    }
    if (caseConfig.editorWorkflow === 'review-reset-all') {
      if (!editorWorkflow?.reviewRendered || editorWorkflow?.reviewRowsBefore < 2) failures.push('review workflow did not render expected review rows after edits');
      if (!editorWorkflow?.reviewContainsNotation || !editorWorkflow?.reviewContainsBoolean) failures.push('review workflow did not show expected before/after changed paths');
      if (!editorWorkflow?.changedOnlyAllChanged || !editorWorkflow?.changedOnlyIncludesNotation) failures.push('changed-only filter did not show only changed rows after edits');
      if (!editorWorkflow?.booleanReviewReset) failures.push('review row reset did not clear the selected changed path');
      if (!editorWorkflow?.resetAllCleared || !editorWorkflow?.changedToggleCleared || !editorWorkflow?.visibleCardsAfterReset) {
        failures.push('reset all did not return the rendered editor to a clean state');
      }
    }
    if (caseConfig.editorWorkflow === 'deep-scope-edit') {
      if (!editorWorkflow?.levelChanged) failures.push('deep scoped browser workflow did not mark celestial pet level changed');
      if (!editorWorkflow?.activeBreadcrumb?.includes('teresa')) {
        failures.push('deep scoped browser workflow did not end at the expected breadcrumb');
      }
      if (!editorWorkflow?.encodedPrefix?.startsWith('AntimatterDimensionsSavefileFormat')) {
        failures.push('deep scoped browser workflow did not produce an encoded PC save');
      }
    }
    if (caseConfig.editorWorkflow === 'android-big-number') {
      if (!editorWorkflow?.antimatterChanged) failures.push('Android big-number editor did not mark antimatter changed');
      if (!editorWorkflow?.encodedPrefix?.startsWith('AntimatterDimensionsAndroidSaveFormat')) {
        failures.push('Android editor workflow did not produce an encoded Android save');
      }
    }
    if (caseConfig.exportWorkflow === 'encoded-output-actions') {
      if (!exportWorkflow?.encodedPrefix?.startsWith('AntimatterDimensionsSavefileFormat')) failures.push('export workflow did not start from an encoded PC save');
      if (!exportWorkflow?.copyWroteEncoded) failures.push('Copy action did not write encoded output to clipboard');
      if (!exportWorkflow?.nativeShareCalled || !exportWorkflow?.nativeShareTextMatches) failures.push('Share action did not call native share with encoded output');
      if (!exportWorkflow?.fallbackShareCopied) failures.push('Share fallback did not copy encoded output');
      if (exportWorkflow?.downloadFilename !== 'antimatter-dimensions-save.txt' || !exportWorkflow?.downloadTextMatches) {
        failures.push('Download action did not prepare the encoded save text file');
      }
    }

    return {
      name: caseConfig.name,
      viewport: caseConfig.viewport.name,
      decoded,
      safetyPanel,
      navigationWorkflow,
      qaWorkflow,
      presetWorkflow,
      editorWorkflow,
      exportWorkflow,
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
      editorWorkflow: 'pc-basic',
      exportWorkflow: 'encoded-output-actions',
    },
    {
      name: 'pc-navigation-iphone-se',
      viewport: viewports.iphoneSe,
      saveData: createComprehensivePcSave(),
      navigationWorkflow: 'pc-navigation',
    },
    {
      name: 'pc-review-reset-iphone-se',
      viewport: viewports.iphoneSe,
      saveData: createNormalPcSave(),
      editorWorkflow: 'review-reset-all',
    },
    {
      name: 'pc-preset-iphone-se',
      viewport: viewports.iphoneSe,
      saveData: createNormalPcSave(),
      presetWorkflow: 'pc-normal-preset',
    },
    {
      name: 'file-import-qa-iphone-se',
      viewport: viewports.iphoneSe,
      fileImportData: createNormalPcSave(),
      qaWorkflow: 'value-free-copy',
    },
    {
      name: 'pc-fixture-iphone-15',
      viewport: viewports.iphone15,
      saveData: createComprehensivePcSave(),
      editorWorkflow: 'deep-scope-edit',
    },
    {
      name: 'android-normal-iphone-15',
      viewport: viewports.iphone15,
      saveData: createNormalAndroidSave(),
      editorWorkflow: 'android-big-number',
    },
    {
      name: 'android-preset-iphone-se',
      viewport: viewports.iphoneSe,
      saveData: createNormalAndroidSave(),
      presetWorkflow: 'android-normal-preset',
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
