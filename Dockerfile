FROM node:12

RUN apt-get update && apt-get install -y libx11-xcb1 libxtst6 libasound2 libnss3 libgtk-3-0 libxss1 && rm -rf /var/lib/apt/lists/*

COPY package.json /package.json
RUN npm install 2>&1 > /dev/null

COPY index.js /index.js

ENTRYPOINT ["node", "/index.js"]

CMD []