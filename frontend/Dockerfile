FROM node:22-slim

WORKDIR /app

# 强制 Linux 平台并清除缓存
ENV npm_config_platform=linux \
    npm_config_arch=x64 \
    npm_config_target_platform=linux

COPY package.json ./
RUN npm cache clean --force && npm install --install-strategy=hoisted
COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
