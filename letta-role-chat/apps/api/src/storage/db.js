"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = promise_1.default.createPool({
    host: process.env.DB_HOST ?? "host.docker.internal",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "200106",
    database: process.env.DB_NAME ?? "letta_chat",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
exports.default = pool;
const initDb = async () => {
    const connection = await pool.getConnection();
    try {
        // 创建 agents 表
        await connection.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        persona TEXT,
        human TEXT,
        agent_id VARCHAR(255) UNIQUE,
        avatar VARCHAR(255) DEFAULT NULL,
        voice VARCHAR(255) DEFAULT 'ja-JP-MayuNeural',
        speed FLOAT DEFAULT 1.0,
        pitch VARCHAR(50) DEFAULT '15',
        style VARCHAR(100) DEFAULT 'chat',
        created_at BIGINT
      )
    `);
        // 创建 chats 表 (新增)
        await connection.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        letta_conversation_id VARCHAR(255),
        title VARCHAR(255) DEFAULT '新对话',
        created_at BIGINT,
        updated_at BIGINT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        INDEX idx_agent_updated (agent_id, updated_at DESC),
        INDEX idx_letta_conversation (letta_conversation_id)
      )
    `);
        // 创建 messages 表 (添加 chat_id 外键)
        await connection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255),
        chat_id VARCHAR(255),
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        timestamp BIGINT,
        images LONGTEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        INDEX idx_chat_timestamp (chat_id, timestamp)
      )
    `);
        console.log('Database initialized successfully');
    }
    catch (error) {
        console.error('Failed to initialize database:', error);
    }
    finally {
        connection.release();
    }
};
exports.initDb = initDb;
