"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const os_1 = __importDefault(require("os"));
const roles_1 = __importDefault(require("./routes/roles"));
const messages_1 = __importDefault(require("./routes/messages"));
const db_1 = require("./storage/db");
require("dotenv/config");
const tts_1 = __importDefault(require("./routes/tts"));
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0"; // ✅ 可用环境变量控制
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "2mb" }));
app.use("/api", tts_1.default);
app.use("/api/roles", roles_1.default);
app.use("/api/messages", messages_1.default);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});
function getLocalIPv4() {
    const nets = os_1.default.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === "IPv4" && !net.internal)
                return net.address;
        }
    }
    return "localhost";
}
(0, db_1.initDb)()
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
