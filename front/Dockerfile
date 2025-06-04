# We are using the node base image
FROM node:latest

# Create a directory for your application
WORKDIR /usr/src/app

# Copy package.json and package-lock.json files to your app directory
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the application to the app directory
COPY . .

# Set the VITE_ROOT environment variable to point to the dist directory
ENV VITE_ROOT=/usr/src/app/dist

# Use an entrypoint script to determine which command to run
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]