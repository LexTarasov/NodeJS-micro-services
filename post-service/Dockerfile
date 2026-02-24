#use this node version with alpine linux as base image 
FROM node:18-alpine

WORKDIR /user/src/app

COPY package*.jason ./

RUN npm ci --only=production

COPY . .

EXPOSE 3002

CMD ["node", "src/server.js"]