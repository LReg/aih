FROM node:22-alpine AS builder

COPY . /myapp
WORKDIR /myapp
RUN npm ci --omit=dev && npm run compile
EXPOSE 8080

CMD ["npm", "start"]