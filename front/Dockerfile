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

# Expose the port app runs on
EXPOSE 7220

# Set the VITE_ROOT environment variable to point to the dist directory
ENV VITE_ROOT=/usr/src/app/dist

# Run the application
#CMD [ "npm", "run", "serve", "--", "--host", "--open"]
CMD [ "npm", "run", "build-preview"]