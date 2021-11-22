# Builder stage.
# This state compile our TypeScript to get the JavaScript code
FROM node:16 AS builder

WORKDIR /usr/src/app

# add `/app/node_modules/.bin` to $PATH
ENV PATH /usr/src/app/node_modules/.bin:$PATH

COPY package*.json ./
COPY tsconfig*.json ./
COPY yarn.lock ./
COPY ./src ./src
RUN yarn && yarn build


# Production stage.
# This state compile get back the JavaScript code from builder stage
# It will also install the production package only
FROM node:16-alpine

WORKDIR /app
# add `/app/node_modules/.bin` to $PATH
ENV PATH /usr/src/app/node_modules/.bin:$PATH
ENV NODE_ENV=production

COPY package*.json ./
COPY yarn.lock ./
RUN yarn --prod

## We just need the build to execute the command
COPY --from=builder /usr/src/app/dist .
