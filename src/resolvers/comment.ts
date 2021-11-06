import { comment } from ".prisma/client";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Info,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { getConnection } from "typeorm";
import { Comment } from "../entities/Comment";
import { Like } from "../entities/Like";
import { isAuth } from "../middleware/isAuth";
import { prisma } from "../prisma";
import { MyContext } from "../types";

@InputType()
class CommentInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedComments {
  @Field(() => [Comment])
  comments: Comment[];
  @Field()
  hasMore: boolean;
}

@Resolver(Comment)
export class CommentResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Comment) {
    return root.text.slice(0, 50);
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("commentId", () => Int) commentId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isLike = value !== -1;
    const realValue = isLike ? 1 : -1;
    const { userId } = req.session;

    const like = await prisma.like.findUnique({
      where: { userId_commentId: { commentId, userId: userId as number } },
    });

    if (like && like.value !== realValue) {
      await prisma.$transaction([
        prisma.$executeRaw`
        update "like"
        set value = ${realValue}
        where "commentId" = ${commentId} and "userId" = ${userId}
        `,
        prisma.$executeRaw`
        update comment
        set points = points + ${2 * realValue}
        where id = ${commentId};
        `,
      ]);
    } else if (!like) {
      await prisma.$transaction([
        prisma.$executeRaw`
        insert into "like" ("userId", "commentId", value)
        values (${userId}, ${commentId}, ${realValue});
        `,
        prisma.$executeRaw`
        update comment
        set points = points + ${realValue}
        where id = ${commentId};
        `,
      ]);
    }

    return true;
  }

  @Query(() => PaginatedComments)
  async comments(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedComments> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;

    const replacements: any[] = [realLimitPlusOne];

    if (req.session.userId) {
      replacements.push(req.session.userId);
    }

    let cursorIdx = 3;
    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
      cursorIdx = replacements.length;
    }

    const comments = await getConnection().query(
      `
    select p.*,
    json_build_object(
      'id', u.id,
      'username', u.username,
      'email', u.email,
      'createdAt', u."createdAt",
      'updatedAt', u."updatedAt"
      ) creator,
    ${
      req.session.userId
        ? '(select value from "like" where "userId" = $2 and "commentId" = p.id) "voteStatus"'
        : 'null as "voteStatus"'
    }
    from comment p
    
    inner join public.user u on u.id = p."creatorId" 

    ${cursor ? `where p."createdAt" < $${cursorIdx}` : ""}
    order by p."createdAt" DESC
    limit $1
    `,
      replacements
    );

    return {
      comments: comments.slice(0, realLimit),
      hasMore: comments.length === realLimitPlusOne,
    };
  }

  @Query(() => Comment, { nullable: true })
  comment(@Arg("id", () => Int) id: number): Promise<Comment | undefined> {
    return Comment.findOne(id);
  }

  @UseMiddleware(isAuth)
  @Mutation(() => Comment)
  createComment(
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Arg("articleId", () => Int) articleId: number,
    @Ctx() { req }: MyContext
  ): Promise<comment> {
    return prisma.comment.create({
      data: { title, text, creatorId: req.session.userId as number, articleId },
    });
  }

  @Mutation(() => Comment, { nullable: true })
  async updateComment(
    @Arg("id") id: number,
    @Arg("title", () => String, { nullable: true }) title: string
  ): Promise<Comment | null> {
    const comment = await Comment.findOne(id);
    if (!comment) {
      return null;
    }
    if (typeof title !== "undefined") {
      await Comment.update({ id }, { title });
    }
    return comment;
  }

  @Mutation(() => Boolean)
  async deleteComment(@Arg("id") id: number): Promise<boolean> {
    await Comment.delete({ id });
    return true;
  }
}
