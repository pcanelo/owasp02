FROM node:14
RUN apt update
RUN apt upgrade -y
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]

