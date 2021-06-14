# https://docs.docker.com/develop/develop-images/multistage-build/

#########################
# Transpiles typescript #
#########################
FROM node:10-alpine as builder

WORKDIR /app

COPY ./package.json ./package-lock.json ./
RUN npm ci

# compile contracts and generate typescript bindings
COPY ./hardhat.config.ts ./
COPY ./contracts ./contracts
COPY ./types ./types
RUN npm run generate

# typescript transpile
COPY tsconfig.json ./
COPY ./scripts ./scripts
COPY ./ts ./ts
RUN npm run tsc

#####################################
# Installs only production npm deps #
#####################################
FROM node:10-alpine as prod-deps

WORKDIR /deps

COPY ./package.json ./package-lock.json ./
RUN npm ci --only=production

####################
# Production image #
####################
FROM node:10-alpine

ENV PORT 3000
EXPOSE ${PORT}

# common TLS certs (SSL/HTTPS)
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Bring in assets from other intermediate build stages
COPY --from=prod-deps /deps/node_modules ./node_modules
COPY --from=builder /app/build ./build

ENTRYPOINT ["node", "/app/build/ts/client"]
