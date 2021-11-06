import "reflect-metadata";
import "dotenv/config";
import { createConnection } from "typeorm";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { CommentResolver } from "./resolvers/comment";
import { Comment } from "./entities/Comment";
import { User } from "./entities/User";
import { UserResolver } from "./resolvers/user";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import { __prod__ } from "./constants";
import path from "path";
import { Like } from "./entities/Like";
import { Article } from "./entities/Article";
import { ArticleLike } from "./entities/ArticleLike";
import { ArticleResolver } from "./resolvers/article";

const main = async () => {
  // const conn = await createConnection({
  //   type: "postgres",
  //   url: process.env.DATABASE_URL,
  //   logging: true,
  //   // synchronize: true,
  //   migrations: [path.join(__dirname, "./migrations/*")],
  //   entities: [Comment, User, Like, Article, ArticleLike],
  // });

  // await conn.dropDatabase();
  // await conn.runMigrations();

  const app = express();

  const RedisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);

  app.set("trust proxy", 1);

  app.use(
    session({
      name: "qid",
      store: new RedisStore({ client: redis, disableTouch: true }),
      cookie: {
        httpOnly: true,
        secure: __prod__,
        sameSite: "lax",
        domain: __prod__ ? ".historiapedia.online" : undefined,
      },
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET,
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [
        HelloResolver,
        CommentResolver,
        UserResolver,
        ArticleResolver,
      ],
      validate: false,
    }),
    context: ({ req, res }) => ({ req, res, redis }),
  });

  await apolloServer.start();

  apolloServer.applyMiddleware({
    app,
    cors: {
      origin: [process.env.CORS_ORIGIN, "https://studio.apollographql.com"],
      credentials: true,
    },
  });

  app.get("/", (_, res) => {
    res.send("test");
  });

  app.listen(parseInt(process.env.PORT), () => {
    console.log("server started at localhost:4000");
  });
};

main();

console.log("test2");
