FROM apify/actor-node:24

WORKDIR /home/myuser

COPY --chown=myuser:myuser package*.json ./
RUN npm --quiet set progress=false \
    && npm install --include=dev \
    && npm cache clean --force

COPY --chown=myuser:myuser . ./
RUN npm run build

CMD ["npm", "start", "--silent"]
