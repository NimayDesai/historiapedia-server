import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { User } from "../entities/User";
import argon2 from "argon2";
import { getConnection } from "typeorm";
import { MyContext } from "../types";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { user } from "@prisma/client";
import { prisma } from "../prisma";

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
  @Field(() => User, { nullable: true })
  user?: user | null;
}

@Resolver(User)
export class UserResolver {
  @Mutation(() => UserResponse)
  async changeUser(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    let newEmail;
    let newUsername;
    let newPassword;
    const userId = req.session.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!userId) {
      return {
        errors: [
          {
            field: "username",
            message: "You are not logged in",
          },
        ],
      };
    }
    if (!options.email) {
      newEmail = user?.email;
    } else if (options.email.length <= 2 && options.email.length >= 1) {
      return {
        errors: [
          {
            field: "email",
            message: "Length of email must be at least 3 characters",
          },
        ],
      };
    } else {
      newEmail = options.email;
    }

    if (!options.username) {
      newUsername = user?.username;
    } else if (options.username.length <= 2 && options.username.length >= 1) {
      return {
        errors: [
          {
            field: "username",
            message: "Length of username must be at least 3 characters",
          },
        ],
      };
    } else {
      newUsername = options.username;
    }

    if (!options.password) {
      newPassword = user?.password;
    } else if (options.password.length <= 2 && options.password.length >= 1) {
      return {
        errors: [
          {
            field: "username",
            message: "Length of username must be at least 3 characters",
          },
        ],
      };
    } else {
      const hashedNewPassword = await argon2.hash(options.password);
      newPassword = hashedNewPassword;
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { email: newEmail, password: newPassword, username: newUsername },
      });
    } catch (err) {
      if (err.code === "23505") {
        return {
          errors: [
            {
              field: "username",
              message: "Username already exists",
            },
          ],
        };
      }
    }

    return { user };
  }

  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    if (req.session.userId === user.id) {
      return user.email;
    }

    return "";
  }

  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    if (!req.session.userId) {
      return null;
    }

    return prisma.user.findUnique({ where: { id: req.session.userId } });
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options", () => UsernamePasswordInput) options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const response = validateRegister(options);
    if (response) {
      return response;
    }

    const hashedPassword = await argon2.hash(options.password);
    let user;
    try {
      user = await prisma.user.create({
        data: {
          username: options.username,
          password: hashedPassword,
          email: options.email,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        return {
          errors: [
            {
              field: "username",
              message: "username already taken",
            },
          ],
        };
      }
      console.log("message", err.message);
      console.log("data", err);
    }

    req.session.userId = user?.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: usernameOrEmail.includes("@")
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail },
    });
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "Could not find that username",
          },
        ],
      };
    }
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "invalid password",
          },
        ],
      };
    }

    req.session.userId = user.id;

    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err: any) => {
        res.clearCookie("qid");
        if (err) {
          resolve(false);
          return;
        }

        resolve(true);
      })
    );
  }
}
