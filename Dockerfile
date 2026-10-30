# Schlankes Abbild: HomeIQ hat keine Abhängigkeiten, also reicht
# die reine Laufzeit. Kein npm install, kein Build-Schritt.

FROM node:20-slim

# Nicht als root laufen lassen.
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "server.js"]
