
import express from "express";
import cors from "cors";
import os from "os";
import roleRoutes from "./routes/roles";
import messageRoutes from "./routes/messages";
import { initDb } from "./storage/db";
import "dotenv/config";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0"; // ✅ 可用环境变量控制

app.use(cors());
app.use(express.json());

app.use("/api/roles", roleRoutes);
app.use("/api/messages", messageRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

function getLocalIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

initDb()
  .then(() => {
    app.listen(PORT, HOST, () => {
      const ip = getLocalIPv4();
      console.log(`Server listening: http://${HOST}:${PORT}`);
      console.log(`LAN access:       http://${ip}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server due to DB error:", err);
  });
