import {} from 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';

import models from './models';
import schema from './schema';
import resolvers from './resolvers';
import { createApolloServer } from './utils/apollo-server';

// Connect to database
mongoose
  .connect(process.env.MONGO_URL, { useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false, useCreateIndex: true})
  .then(() => console.log('DB connected'))
  .catch(err => console.error('DB Connection error: ' + err));
mongoose.set('useCreateIndex', true);

// Initializes application
const app = express();

// Enable cors
const corsOptions = {
  origin: "*",
  credentials: true,
};
app.use(cors(corsOptions));

app.get('/', function(req, res) {
  res.redirect('/graphql');
});
// Create a Apollo Server
const server = createApolloServer(schema, resolvers, models);
server.applyMiddleware({ app, path: '/graphql' });


// Create http server and add subscriptions to it
const httpServer = createServer(app);
server.installSubscriptionHandlers(httpServer);

// Listen to HTTP and WebSocket server
const PORT = process.env.PORT || process.env.API_PORT;
httpServer.listen({ port: PORT }, () => {
  console.log(`server ready at http://localhost:${PORT}${server.graphqlPath}`);
  console.log(
    `Subscriptions ready at ws://localhost:${PORT}${server.subscriptionsPath}`
  );
});
