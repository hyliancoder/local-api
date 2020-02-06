import {} from 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import Honeybadger from 'honeybadger';
import models from './models';
import schema from './schema';
import resolvers from './resolvers';
import { createApolloServer } from './utils/apollo-server';

// Connect to database
mongoose
  .connect(process.env.MONGO_URL, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true,
  })
  .then(() => console.log('DB connected'))
  .catch(err => console.error('DB Connection error: ' + err));

  Honeybadger.configure({
    apiKey: '51c8590b'
  });

// Initializes application
const app = express();
const path = '/graphql';

// Enable cors
const corsOptions = {
  origin: '*',
  credentials: true,
};
app.use(Honeybadger.requestHandler);

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(Honeybadger.errorHandler); 

// Create a Apollo Server
const server = createApolloServer(schema, resolvers, models);
server.applyMiddleware({ app, path, cors: false });

// Create http server and add subscriptions to it
const httpServer = createServer(app);
server.installSubscriptionHandlers(httpServer);

// Listen to HTTP and WebSocket server
const PORT = process.env.PORT || 4000;
httpServer.listen({ port: PORT }, () => {
  console.log(`server ready at http://localhost:${PORT}${server.graphqlPath}`);
  console.log(
    `Subscriptions ready at ws://localhost:${PORT}${server.subscriptionsPath}`
  );
});
