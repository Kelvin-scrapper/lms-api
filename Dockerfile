FROM node:22-alpine

# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY db/schema.prisma ./db/schema.prisma
RUN npm ci --omit=dev

COPY src ./src
COPY db ./db

ENV PORT=4000
EXPOSE 4000

# Apply the schema, seed, then start the API. Both DB steps are idempotent, so
# this is safe on every restart. A failed seed is logged but doesn't stop the API.
CMD ["sh", "-c", "node db/setup.js && { node db/seed.js || echo 'Seed failed - see the error above. Starting the API anyway.'; } && exec node src/index.js"]
