# ==========================================
# 多阶段构建：前端 + 后端
# ==========================================

FROM node:20-alpine AS base
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ==========================================
# 阶段 1: 安装依赖
# ==========================================
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# ==========================================
# 阶段 2: 构建前端
# ==========================================
FROM base AS web-builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web ./apps/web
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/apps/web
RUN pnpm build

# ==========================================
# 阶段 3: 构建后端
# ==========================================
FROM base AS api-builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api ./apps/api
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/apps/api
RUN pnpm build

# ==========================================
# 阶段 4: 生产环境运行时
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# 安装 nginx 用于托管前端静态文件
RUN apk add --no-cache nginx supervisor

# 创建必要的目录
RUN mkdir -p /app/data \
    /app/uploads/avatars \
    /run/nginx \
    /var/log/supervisor

# 复制后端构建产物
COPY --from=api-builder /app/apps/api/dist ./api
COPY --from=api-builder /app/apps/api/package.json ./api/
COPY --from=deps /app/apps/api/node_modules ./api/node_modules

# 复制前端构建产物
COPY --from=web-builder /app/apps/web/dist ./web

# 配置 nginx
COPY <<EOF /etc/nginx/http.d/default.conf
server {
    listen 80;
    server_name _;
    
    # 前端静态文件
    location / {
        root /app/web;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # API 代理
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    
    # Avatar 静态文件
    location /avatars/ {
        alias /app/uploads/avatars/;
        add_header Cache-Control "public, max-age=31536000";
    }
}
EOF

# 配置 supervisor
COPY <<EOF /etc/supervisord.conf
[supervisord]
nodaemon=true
user=root
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid

[program:api]
command=node /app/api/index.js
directory=/app/api
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/api.err.log
stdout_logfile=/var/log/supervisor/api.out.log
environment=PORT=3001,HOST=0.0.0.0,AVATAR_DIR=/app/uploads/avatars,DB_PATH=/app/data/letta.db

[program:nginx]
command=nginx -g 'daemon off;'
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/nginx.err.log
stdout_logfile=/var/log/supervisor/nginx.out.log
EOF

# 暴露端口
EXPOSE 80

# 启动命令
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]