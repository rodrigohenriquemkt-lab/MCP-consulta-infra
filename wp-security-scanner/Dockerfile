FROM ruby:3.2-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcurl4-openssl-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    git \
    curl \
    ca-certificates \
    nodejs \
    npm \
  && rm -rf /var/lib/apt/lists/*

RUN gem install wpscan --no-document

WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
COPY fix-htaccess.js .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
