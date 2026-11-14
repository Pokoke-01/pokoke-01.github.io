const SITE_CONFIG = {
  githubUsername: "pokoke-01",
  maxRepos: 5,
  excludeRepoNames: ["pokoke-01.github.io"],
  useGitHubBio: true,
  cacheTtlMs: 10 * 60 * 1000,
  // Optional: add custom entries here to override or prepend manual projects
  // Example: [{ name: "my-tool", description: "...", html_url: "https://...", language: "TypeScript", stargazers_count: 0 }]
  customProjects: []
};

const LANGUAGE_COLORS = {
  TypeScript: "#6f9fd8",
  JavaScript: "#d4b86a",
  Python: "#6ea1c7",
  Go: "#6eb6c4",
  Rust: "#c98b73",
  HTML: "#cf7d65",
  CSS: "#8b85c9",
  Shell: "#89b88c",
  Java: "#c49368",
  PHP: "#858ec2",
  C: "#8a92a1",
  "C++": "#c77b96"
};

function setCurrentYear() {
  const yearEl = document.getElementById("current-year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.timestamp > SITE_CONFIG.cacheTtlMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Ignore storage errors (e.g., private mode or quota limits)
  }
}

async function fetchJsonWithCache(url, cacheKey) {
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" }
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }

  const data = await response.json();
  writeCache(cacheKey, data);
  return data;
}

function formatUpdatedDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric"
  });
}

function createRepoCard(repo) {
  const card = document.createElement("a");
  card.className = "repo-card";
  card.href = repo.html_url || `https://github.com/${SITE_CONFIG.githubUsername}`;
  card.target = "_blank";
  card.rel = "noopener noreferrer";

  const top = document.createElement("div");
  top.className = "repo-top";

  const nameGroup = document.createElement("div");
  nameGroup.className = "repo-name-group";

  const name = document.createElement("span");
  name.className = "repo-name";
  name.textContent = repo.name;
  nameGroup.appendChild(name);

  if (repo.fork) {
    const badge = document.createElement("span");
    badge.className = "repo-badge";
    badge.textContent = "Fork";
    nameGroup.appendChild(badge);
  } else if (repo.archived) {
    const badge = document.createElement("span");
    badge.className = "repo-badge";
    badge.textContent = "Archived";
    nameGroup.appendChild(badge);
  }

  const arrow = document.createElement("span");
  arrow.className = "arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";

  top.appendChild(nameGroup);
  top.appendChild(arrow);
  card.appendChild(top);

  const desc = document.createElement("p");
  desc.className = "repo-desc";
  if (repo.description) {
    desc.textContent = repo.description;
  } else {
    desc.classList.add("is-empty");
    desc.textContent = "No description provided.";
  }
  card.appendChild(desc);

  const meta = document.createElement("div");
  meta.className = "repo-meta";

  if (repo.language) {
    const lang = document.createElement("span");
    lang.className = "repo-lang";

    const dot = document.createElement("span");
    dot.className = "lang-dot";
    dot.style.backgroundColor = LANGUAGE_COLORS[repo.language] || "var(--accent)";

    const langText = document.createElement("span");
    langText.textContent = repo.language;

    lang.appendChild(dot);
    lang.appendChild(langText);
    meta.appendChild(lang);
  }

  if (typeof repo.stargazers_count === "number" && repo.stargazers_count > 0) {
    const stars = document.createElement("span");
    stars.className = "repo-stat";
    stars.textContent = `★ ${repo.stargazers_count}`;
    meta.appendChild(stars);
  }

  const updated = formatUpdatedDate(repo.pushed_at || repo.updated_at);
  if (updated) {
    const dateSpan = document.createElement("span");
    dateSpan.textContent = `Updated ${updated}`;
    meta.appendChild(dateSpan);
  }

  if (meta.childElementCount > 0) {
    card.appendChild(meta);
  }

  return card;
}

function renderFallbackCard() {
  const container = document.getElementById("repo-list");
  if (!container) return;

  container.textContent = "";
  const fallback = createRepoCard({
    name: `${SITE_CONFIG.githubUsername} repositories`,
    description: "Browse public repositories, source code, and recent activity directly on GitHub.",
    html_url: `https://github.com/${SITE_CONFIG.githubUsername}?tab=repositories`
  });
  container.appendChild(fallback);
}

function summarizeLanguages(repos) {
  const counts = new Map();
  for (const repo of repos) {
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([lang]) => lang);

  return top.length > 0 ? top.join(" · ") : null;
}

function selectRepos(rawRepos) {
  const excluded = new Set(
    SITE_CONFIG.excludeRepoNames.map((name) => name.toLowerCase())
  );
  const customNames = new Set(
    SITE_CONFIG.customProjects
      .filter((item) => item && item.name)
      .map((item) => item.name.toLowerCase())
  );

  const filtered = rawRepos.filter(
    (repo) =>
      repo &&
      repo.name &&
      !excluded.has(repo.name.toLowerCase()) &&
      !customNames.has(repo.name.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    // Prioritize non-forks slightly, then stars, then recent push date
    if (Boolean(a.fork) !== Boolean(b.fork)) {
      return a.fork ? 1 : -1;
    }
    if ((b.stargazers_count || 0) !== (a.stargazers_count || 0)) {
      return (b.stargazers_count || 0) - (a.stargazers_count || 0);
    }
    return new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0);
  });

  const combined = [...SITE_CONFIG.customProjects, ...sorted];
  return combined.slice(0, SITE_CONFIG.maxRepos);
}

async function hydrateGitHubData() {
  const user = SITE_CONFIG.githubUsername;
  const repoListEl = document.getElementById("repo-list");
  const statReposEl = document.getElementById("stat-repos");
  const statLangEl = document.getElementById("stat-languages");
  const nameEl = document.getElementById("profile-name");
  const bioEl = document.getElementById("profile-bio");

  if (!repoListEl) return;

  try {
    const [profile, repos] = await Promise.all([
      fetchJsonWithCache(
        `https://api.github.com/users/${user}`,
        `gh_profile_${user}`
      ),
      fetchJsonWithCache(
        `https://api.github.com/users/${user}/repos?sort=pushed&per_page=15`,
        `gh_repos_${user}`
      )
    ]);

    if (profile) {
      if (profile.name && nameEl) {
        nameEl.textContent = profile.name;
      }
      if (SITE_CONFIG.useGitHubBio && profile.bio && bioEl) {
        bioEl.textContent = profile.bio;
      }
      if (typeof profile.public_repos === "number" && statReposEl) {
        statReposEl.textContent = String(profile.public_repos);
      }
    }

    if (Array.isArray(repos)) {
      const topLangs = summarizeLanguages(repos);
      if (topLangs && statLangEl) {
        statLangEl.textContent = topLangs;
      }

      const selected = selectRepos(repos);
      if (selected.length > 0) {
        repoListEl.textContent = "";
        for (const repo of selected) {
          repoListEl.appendChild(createRepoCard(repo));
        }
        return;
      }
    }

    renderFallbackCard();
  } catch {
    if (SITE_CONFIG.customProjects.length > 0) {
      repoListEl.textContent = "";
      for (const item of SITE_CONFIG.customProjects.slice(0, SITE_CONFIG.maxRepos)) {
        repoListEl.appendChild(createRepoCard(item));
      }
    } else {
      renderFallbackCard();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setCurrentYear();
  hydrateGitHubData();
});
