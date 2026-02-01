const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');
const sourceEl = document.getElementById('source');
const resultsEl = document.getElementById('results');

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

function renderResults(rows) {
  resultsEl.innerHTML = '';

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No technologies found in the page text.';
    resultsEl.appendChild(empty);
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const thTech = document.createElement('th');
  thTech.textContent = 'Technology';
  const thCount = document.createElement('th');
  thCount.textContent = 'Count';
  headerRow.appendChild(thTech);
  headerRow.appendChild(thCount);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach(([tech, count]) => {
    const row = document.createElement('tr');
    const techCell = document.createElement('td');
    techCell.textContent = tech;
    const countCell = document.createElement('td');
    countCell.textContent = String(count);
    row.appendChild(techCell);
    row.appendChild(countCell);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  resultsEl.appendChild(table);
}

async function analyzeActiveTab() {
  statusEl.textContent = 'Analyzing page...';
  analyzeBtn.disabled = true;
  sourceEl.textContent = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      statusEl.textContent = 'No active tab found.';
      return;
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selectors) => {
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
  } catch (error) {
    statusEl.textContent = 'Failed to analyze this page.';
  } finally {
    analyzeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener('click', analyzeActiveTab);
