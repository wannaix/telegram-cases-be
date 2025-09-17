# Деплой на Render.com

## Настройки для Render

1. **Root Directory**: `backend`
2. **Build Command**: `npm ci && npm run build && npx prisma generate`  
3. **Start Command**: `npm start`
4. **Node Version**: 18+ (по умолчанию последняя LTS)

## Переменные окружения

Добавьте следующие переменные в настройках Render:

- `NODE_ENV=production`
- `DATABASE_URL` - строка подключения к PostgreSQL
- `JWT_SECRET` - секретный ключ для JWT токенов
- `PORT` - порт (обычно Render устанавливает автоматически)

## Проблемы и решения

### Ошибка "Cannot find module '/opt/render/project/src/dist/server.js'"

Эта ошибка означает, что:
1. Не установлен правильный Root Directory: `backend`
2. Или не запущена команда сборки перед стартом

Убедитесь что:
- Root Directory установлен как `backend`
- Build Command содержит `npm run build`
- Start Command это просто `npm start`