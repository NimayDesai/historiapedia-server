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
import { isAuth } from "../middleware/isAuth";
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

  @Query(() => PaginatedComments)
  async comments(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedComments> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;

    const replacements: any[] = [realLimitPlusOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
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
      ) creator
    from comment p
    inner join public.user u on u.id = p."creatorId"
    ${cursor ? `where p."createdAt" < $2` : ""}
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
    @Arg("input") input: CommentInput,
    @Ctx() { req }: MyContext
  ): Promise<Comment> {
    return Comment.create({
      ...input,
      creatorId: req.session.userId,
    }).save();
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
