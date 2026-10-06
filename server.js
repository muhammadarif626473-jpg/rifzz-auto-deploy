import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: "30kb" }));
app.use(express.static(path.join(__dirname, "public")));

const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID;

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, configured: Boolean(token), service: "Rifzz Auto Deploy" });
});

// Deploy an EXISTING Vercel project. Keep VERCEL_TOKEN on the server only.
app.post("/api/deploy", async (req, res) => {
  if (!token) return res.status(503).json({
    error: "Server belum dikonfigurasi. Tambahkan VERCEL_TOKEN sebagai environment variable di hosting."
  });

  const project = String(req.body?.project || "").trim();
  const target = req.body?.target === "preview" ? "preview" : "production";
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(project)) {
    return res.status(400).json({ error: "Nama proyek tidak valid." });
  }

  const params = new URLSearchParams();
  if (teamId) params.set("teamId", teamId);

  try {
    // Trigger a deployment from the project's connected Git repository.
    const projectUrl = `https://api.vercel.com/v9/projects/${encodeURIComponent(project)}?${params}`;
    const projectResp = await fetch(projectUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const projectData = await projectResp.json();
    if (!projectResp.ok) {
      return res.status(projectResp.status).json({
        error: projectData.error?.message || "Proyek tidak ditemukan atau token tidak memiliki izin."
      });
    }

    const repo = projectData.link;
    if (!repo?.repoId || !repo?.org || !repo?.repo) {
      return res.status(400).json({
        error: "Proyek ini belum terhubung ke repositori Git yang didukung. Hubungkan GitHub ke proyek Vercel terlebih dahulu."
      });
    }

    const payload = {
      name: projectData.name,
      project: projectData.id,
      target,
      gitSource: {
        type: repo.type || "github",
        repoId: repo.repoId,
        ref: repo.productionBranch || "main"
      }
    };
    const deployUrl = `https://api.vercel.com/v13/deployments?${params}`;
    const deployResp = await fetch(deployUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const deployData = await deployResp.json();
    if (!deployResp.ok) {
      return res.status(deployResp.status).json({
        error: deployData.error?.message || "Vercel menolak permintaan deployment."
      });
    }
    res.json({
      ok: true,
      state: deployData.readyState || deployData.status || "QUEUED",
      url: deployData.url ? `https://${deployData.url}` : null,
      deploymentId: deployData.id
    });
  } catch {
    res.status(502).json({ error: "Tidak dapat menghubungi Vercel. Coba lagi nanti." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Auto Deploy berjalan di port ${port}`));
