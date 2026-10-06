
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ok: true,
    service: "Rifzz Auto Deploy",
    configured: Boolean(process.env.VERCEL_TOKEN)
  });
    }
