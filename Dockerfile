FROM node:22-alpine

WORKDIR /workspace

RUN apk add --no-cache php83 php83-phar php83-tokenizer php83-iconv curl
RUN curl -LsS https://github.com/phpstan/phpstan/releases/latest/download/phpstan.phar -o /usr/local/bin/phpstan.phar

COPY package.json ./
COPY tsconfig.json ./
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY docs ./docs
COPY examples ./examples
COPY data ./data
COPY scripts/phpsage.sh /usr/local/bin/phpsage
COPY scripts/phpstan.sh /usr/local/bin/phpstan

RUN npm install
RUN chmod +x /usr/local/bin/phpsage
RUN chmod +x /usr/local/bin/phpstan /usr/local/bin/phpstan.phar

CMD ["npm", "run", "build"]
