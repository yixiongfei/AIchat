import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'letta_chat',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;

export const initDb = async () => {
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
  } catch (error) {
    console.error('Failed to initialize database:', error);
  } finally {
    connection.release();
  }
};
