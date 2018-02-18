FROM node:9.5.0

LABEL com.aipu.version="0.10"

# Create app directory
run ["mkdir", "-p", "/usr/src/app"]
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json /usr/src/app/

RUN npm install

# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . /usr/src/app/

EXPOSE 4000
CMD [ "npm", "start" ]
