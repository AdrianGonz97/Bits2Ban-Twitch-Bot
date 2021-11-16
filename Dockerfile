# pull the official base image
FROM node:16

# set working direction
WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
# ENV PATH /app/node_modules/.bin:$PATH

# install application dependencies
COPY package.json ./app
COPY yarn.lock ./app
RUN yarn

# fixes ubuntu specific mounting error 
RUN mkdir -p node_modules/.cache && chmod -R 777 node_modules/.cache

# add app
COPY . ./app

# start app
CMD ["nodemon", "src/index.js"]