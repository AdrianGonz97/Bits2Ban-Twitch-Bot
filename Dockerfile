# pull the official base image
FROM node:15
# set working direction
WORKDIR /app
# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH
# install application dependencies
COPY package.json ./
COPY package-lock.json ./
RUN npm install
# fixes ubuntu specific mounting error 
RUN mkdir -p node_modules/.cache && chmod -R 777 node_modules/.cache
# add app
COPY . ./
# start app
CMD ["node", "src/index.js"]