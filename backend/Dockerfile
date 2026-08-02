FROM node:22-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# 强制 Linux 平台并清除缓存，确保安装原生 Linux 二进制包
ENV npm_config_platform=linux \
    npm_config_arch=x64 \
    npm_config_target_platform=linux

COPY package.json ./
# 删除本地 npm 缓存并强制重新安装
RUN npm cache clean --force && npm install --install-strategy=hoisted
COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npm run build && node dist/main"]
