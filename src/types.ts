import { Request, Response } from "express";
import { Redis } from "ioredis";
import { Session } from "express-session";

export type MyContext = {
  req: Request & { session: Session & { userId?: number } };
  res: Response;
  redis: Redis;
};
