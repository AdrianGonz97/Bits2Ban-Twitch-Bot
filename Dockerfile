### Project needs to be built with 'yarn build' before creating this image ###

# Installs the production packages only
FROM node:16-alpine

WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
ENV PATH /usr/src/app/node_modules/.bin:$PATH
ENV NODE_ENV=production

COPY package*.json ./
COPY yarn.lock ./
RUN yarn --prod

COPY ./dist .
