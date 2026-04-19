import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.REPO;

if (!token || !repo) {
  console.error("GITHUB_TOKEN and REPO env vars are required.");
  process.exit(1);
}

const api = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} -> ${res.status} ${body}`);
  }
  return res.json();
};

const [meta, clones, views, releases] = await Promise.all([
  api(`/repos/${repo}`),
  api(`/repos/${repo}/traffic/clones`),
  api(`/repos/${repo}/traffic/views`),
  api(`/repos/${repo}/releases?per_page=100`),
]);

const statsPath = ".github/stats.json";
const history = existsSync(statsPath)
  ? JSON.parse(readFileSync(statsPath, "utf-8"))
  : { dailyClones: {}, dailyViews: {}, firstRun: new Date().toISOString().slice(0, 10) };

const today = new Date().toISOString().slice(0, 10);

const mergeDaily = (bucket, entries) => {
  for (const entry of entries) {
    const date = entry.timestamp.slice(0, 10);
    if (date === today || !bucket[date]) {
      bucket[date] = { count: entry.count, uniques: entry.uniques };
    }
  }
};

mergeDaily(history.dailyClones, clones.clones || []);
mergeDaily(history.dailyViews, views.views || []);

const sumDaily = (bucket, key) =>
  Object.values(bucket).reduce((s, d) => s + (d[key] || 0), 0);

const totalClones = sumDaily(history.dailyClones, "count");
const totalUniqueCloners = sumDaily(history.dailyClones, "uniques");
const totalViews = sumDaily(history.dailyViews, "count");

const releaseDownloads = releases.reduce(
  (sum, r) => sum + (r.assets || []).reduce((s, a) => s + (a.download_count || 0), 0),
  0,
);

const stats = {
  stars: meta.stargazers_count,
  forks: meta.forks_count,
  openIssues: meta.open_issues_count,
  releaseDownloads,
  totalClones,
  totalUniqueCloners,
  totalViews,
  clones14d: clones.count || 0,
  uniqueCloners14d: clones.uniques || 0,
  lastUpdated: today,
  trackingSince: history.firstRun,
};

mkdirSync(dirname(statsPath), { recursive: true });
writeFileSync(statsPath, JSON.stringify(history, null, 2) + "\n");
writeFileSync(
  ".github/stats-summary.json",
  JSON.stringify(stats, null, 2) + "\n",
);

const fmt = (n) => n.toLocaleString("en-US");
const repoPath = repo;

const block = `<!-- stats-start -->
<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/${repoPath}?style=for-the-badge&color=yellow&label=stars" />
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/${repoPath}?style=for-the-badge&color=blue&label=forks" />
  <img alt="Release downloads" src="https://img.shields.io/github/downloads/${repoPath}/total?style=for-the-badge&color=brightgreen&label=downloads" />
  <img alt="Total clones" src="https://img.shields.io/badge/clones-${encodeURIComponent(fmt(totalClones))}-9b59b6?style=for-the-badge" />
  <img alt="Unique users" src="https://img.shields.io/badge/unique%20users-${encodeURIComponent(fmt(totalUniqueCloners))}-ec4899?style=for-the-badge" />
</p>

<p align="center"><sub>Tracking since ${history.firstRun} • ${fmt(stats.clones14d)} clones and ${fmt(stats.uniqueCloners14d)} unique users in the last 14 days • updated ${today}</sub></p>
<!-- stats-end -->`;

const readmePath = "README.md";
const readme = readFileSync(readmePath, "utf-8");
const pattern = /<!-- stats-start -->[\s\S]*?<!-- stats-end -->/;
let updated;
if (pattern.test(readme)) {
  updated = readme.replace(pattern, block);
} else {
  console.error(
    "No <!-- stats-start --> / <!-- stats-end --> markers found in README.md. Skipping README update.",
  );
  updated = readme;
}

if (updated !== readme) writeFileSync(readmePath, updated);

console.log("Stats:", stats);
