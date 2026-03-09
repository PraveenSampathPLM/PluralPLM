import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

const BASE_URL = process.env.HELP_BASE_URL ?? "http://127.0.0.1:5173";
const API_URL = process.env.HELP_API_URL ?? "http://127.0.0.1:4000/api";
const EMAIL = process.env.HELP_USER_EMAIL ?? "admin@plm.local";
const PASSWORD = process.env.HELP_USER_PASSWORD ?? "Password@123";

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return response.json();
}

async function login() {
  const data = await fetchJson(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  return data.token;
}

async function getFirstId(token, endpoint) {
  const data = await fetchJson(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.data?.[0]?.id ?? null;
}

async function getContainerId(token) {
  const data = await fetchJson(`${API_URL}/containers`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.data?.[0]?.id ?? null;
}

async function main() {
  const token = await login();
  const containerId = await getContainerId(token);

  const [itemId, formulaId, bomId, changeId, releaseId, docId] = await Promise.all([
    getFirstId(token, "/items"),
    getFirstId(token, "/formulas"),
    getFirstId(token, "/bom"),
    getFirstId(token, "/changes"),
    getFirstId(token, "/releases"),
    getFirstId(token, "/documents")
  ]);

  const routes = [
    { filename: "help-dashboard.png", path: "/" },
    { filename: "help-materials-list.png", path: "/items" },
    ...(itemId ? [{ filename: "help-material-detail.png", path: `/items/${itemId}` }] : []),
    { filename: "help-formulation-list.png", path: "/formulas" },
    ...(formulaId ? [{ filename: "help-formulation-detail.png", path: `/formulas/${formulaId}` }] : []),
    { filename: "help-bom-list.png", path: "/bom" },
    ...(bomId ? [{ filename: "help-bom-detail.png", path: `/bom/${bomId}` }] : []),
    { filename: "help-specifications.png", path: "/specifications" },
    { filename: "help-documents.png", path: "/documents" },
    ...(docId ? [{ filename: "help-document-detail.png", path: `/documents/${docId}` }] : []),
    { filename: "help-changes.png", path: "/changes" },
    ...(changeId ? [{ filename: "help-change-detail.png", path: `/changes/${changeId}` }] : []),
    { filename: "help-releases.png", path: "/releases" },
    ...(releaseId ? [{ filename: "help-release-detail.png", path: `/releases/${releaseId}` }] : []),
    { filename: "help-tasks.png", path: "/tasks" },
    { filename: "help-labeling.png", path: "/labeling" },
    { filename: "help-configuration.png", path: "/configuration" }
  ];

  const outputDir = path.resolve("src/assets/help");
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(({ token: initToken, containerId: initContainer }) => {
    localStorage.setItem("plm_token", initToken);
    if (initContainer) {
      localStorage.setItem("plm_selected_container_id", initContainer);
    }
  }, { token, containerId });

  for (const route of routes) {
    const page = await context.newPage();
    const url = `${BASE_URL}${route.path}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const filePath = path.join(outputDir, route.filename);
    await page.screenshot({ path: filePath, fullPage: true });
    await page.close();
  }

  await browser.close();
  console.log(`Saved ${routes.length} screenshots to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
