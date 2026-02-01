const analyzeBtn = document.getElementById('analyzeBtn');
const trendingBtn = document.getElementById('trendingBtn');
const statusEl = document.getElementById('status');
const sourceEl = document.getElementById('source');
const backendMsgEl = document.getElementById('backendMsg');
const resultsEl = document.getElementById('results');
const trendingStatusEl = document.getElementById('trendingStatus');
const trendingResultsEl = document.getElementById('trendingResults');

const TECHNOLOGIES = {
  javascript: ['javascript', 'js'],
  typescript: ['typescript', 'ts'],
  nodejs: ['nodejs', 'node.js', 'node'],
  react: ['react', 'reactjs', 'react.js'],
  angular: ['angular', 'angularjs'],
  vue: ['vue', 'vuejs', 'vue.js'],
  svelte: ['svelte'],
  python: ['python'],
  django: ['django'],
  flask: ['flask'],
  fastapi: ['fastapi'],
  java: ['java'],
  spring: ['spring', 'spring boot', 'springboot'],
  kotlin: ['kotlin'],
  scala: ['scala'],
  csharp: ['c#', 'csharp', '.net', 'dotnet', 'asp.net', 'aspnet'],
  cpp: ['c++', 'cpp'],
  ruby: ['ruby', 'ruby on rails', 'rails'],
  php: ['php', 'laravel', 'symfony'],
  go: ['golang'],
  rust: ['rust'],
  sql: ['sql'],
  postgres: ['postgres', 'postgresql'],
  mysql: ['mysql'],
  mongodb: ['mongodb', 'mongo'],
  redis: ['redis'],
  elasticsearch: ['elasticsearch', 'elastic'],
  graphql: ['graphql'],
  rest: ['rest', 'restful'],
  aws: ['aws', 'amazon web services'],
  gcp: ['gcp', 'google cloud', 'google cloud platform'],
  azure: ['azure', 'microsoft azure'],
  docker: ['docker'],
  kubernetes: ['kubernetes', 'k8s'],
  terraform: ['terraform'],
  ci: ['ci/cd', 'ci cd', 'cicd', 'ci', 'cd'],
  git: ['git'],
  linux: ['linux'],
  spark: ['spark', 'apache spark'],
  hadoop: ['hadoop'],
  kafka: ['kafka'],
  airflow: ['airflow', 'apache airflow'],
  tableau: ['tableau'],
  powerbi: ['power bi', 'powerbi'],
  excel: ['excel'],
  snowflake: ['snowflake'],
  databricks: ['databricks'],
  kubeflow: ['kubeflow']
};

// Site-specific selectors (first match wins).
const JD_SELECTORS = [
  {
    site: 'Workday/Oracle Cloud',
    selector:
      '[data-automation-id="jobDescription"]'
  },
  {
    site: 'Greenhouse',
    selector:
      '#content, .content, .section-wrapper, .opening, .opening-section'
  },
  {
    site: 'Lever',
    selector:
      '.posting-description, .content, .postings-apply .content'
  },
  {
    site: 'LinkedIn',
    selector:
      '.show-more-less-html__markup, .description__text, .jobs-description__content, .jobs-box__html-content'
  }
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Count term occurrences with word-boundary-ish matching.
function countMatches(text, term) {
  const escaped = escapeRegex(term);
  const pattern = `(?:^|[^\\w])${escaped}(?=[^\\w]|$)`;
  const regex = new RegExp(pattern, 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function analyzeText(text) {
  const counts = {};
  const lowered = text.toLowerCase();

  Object.entries(TECHNOLOGIES).forEach(([canonical, aliases]) => {
    let total = 0;
    aliases.forEach((alias) => {
      total += countMatches(lowered, alias.toLowerCase());
    });
    if (total > 0) {
      counts[canonical] = total;
    }
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
}

function renderTable(rows, container, emptyText, headers) {
  container.innerHTML = '';

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const rowEl = document.createElement('tr');
    row.forEach((cell) => {
      const cellEl = document.createElement('td');
      cellEl.textContent = String(cell);
      rowEl.appendChild(cellEl);
    });
    tbody.appendChild(rowEl);
  });
  table.appendChild(tbody);

  container.appendChild(table);
}

function renderResults(rows) {
  renderTable(rows, resultsEl, 'No technologies found in the page text.', [
    'Technology',
    'Count'
  ]);
}

function renderTrends(rows) {
  renderTable(rows, trendingResultsEl, 'No trend data yet.', ['Technology', 'Total']);
}

// Best-effort send to backend without blocking the UI.
async function postIngest(techRows, url) {
  try {
    const payload = {
      url,
      capturedAt: new Date().toISOString(),
      tech: techRows.map(([name, count]) => ({ name, count }))
    };

    const response = await fetch('http://localhost:3001/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      backendMsgEl.textContent = 'Backend not running.';
      return;
    }

    backendMsgEl.textContent = '';
  } catch (error) {
    backendMsgEl.textContent = 'Backend not running.';
  }
}

async function fetchTrends() {
  trendingStatusEl.textContent = 'Loading trends...';
  trendingBtn.disabled = true;

  try {
    const response = await fetch('http://localhost:3001/trends?days=7&limit=20');
    if (!response.ok) {
      trendingStatusEl.textContent = 'Backend not running.';
      return;
    }

    const data = await response.json();
    const rows = Array.isArray(data.top)
      ? data.top.map((entry) => [entry.tech, entry.total])
      : [];
    trendingStatusEl.textContent = '';
    renderTrends(rows);
  } catch (error) {
    trendingStatusEl.textContent = 'Backend not running.';
  } finally {
    trendingBtn.disabled = false;
  }
}

async function analyzeActiveTab() {
  statusEl.textContent = 'Analyzing page...';
  analyzeBtn.disabled = true;
  sourceEl.textContent = '';
  backendMsgEl.textContent = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      statusEl.textContent = 'No active tab found.';
      return;
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selectors) => {
        // Use the first matching job description container.
        for (const entry of selectors) {
          const el = document.querySelector(entry.selector);
          if (el && el.innerText) {
            return {
              text: el.innerText,
              source: `${entry.site} (${entry.selector})`
            };
          }
        }
        return {
          text: document.body ? document.body.innerText : '',
          source: 'document.body.innerText'
        };
      },
      args: [JD_SELECTORS]
    });

    const text = result && result.text ? result.text : '';
    const source = result && result.source ? result.source : 'document.body.innerText';
    const rows = analyzeText(text);
    statusEl.textContent = `Found ${rows.length} technologies.`;
    sourceEl.textContent = `Source: ${source}`;
    renderResults(rows);
    if (tab.url) {
      postIngest(rows, tab.url);
    }
  } catch (error) {
    statusEl.textContent = 'Failed to analyze this page.';
  } finally {
    analyzeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener('click', analyzeActiveTab);
trendingBtn.addEventListener('click', fetchTrends);
