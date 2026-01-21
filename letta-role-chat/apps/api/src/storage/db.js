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
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'letta_chat',
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
        voice VARCHAR(255) DEFAULT 'ja-JP-MayuNeural',
        speed FLOAT DEFAULT 1.0,
        pitch VARCHAR(50) DEFAULT '15',
        style VARCHAR(100) DEFAULT 'chat',
        created_at BIGINT
      )
    `);
        // 创建 messages 表
        await connection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255),
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        timestamp BIGINT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
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
