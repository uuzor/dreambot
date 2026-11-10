# One image for both the bot and the worker; the command picks which.
FROM node:22-slim

WORKDIR /app

# The workspaces are TypeScript run through tsx, so no build step is needed.
# tsx is a devDependency, so the install must include dev dependencies.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci --ignore-scripts

ENV NODE_ENV=production

# Overridden per service in docker-compose.
CMD ["npm", "run", "start", "-w", "@dreampilot/bot"]
