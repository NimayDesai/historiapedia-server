import { article, Prisma } from "@prisma/client";
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
import { Article } from "../entities/Article";
import { ArticleLike } from "../entities/ArticleLike";
import { Comment } from "../entities/Comment";
import { Like } from "../entities/Like";
import { isAuth } from "../middleware/isAuth";
import { prisma } from "../prisma";
import { MyContext } from "../types";

@InputType()
class ArticleInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedArticles {
  @Field(() => [Article])
  articles: article[];
  @Field()
  hasMore: boolean;
}

@Resolver(Article)
export class ArticleResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: article) {
    return root.text.slice(0, 50);
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async articleVote(
    @Arg("articleId", () => Int) articleId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isLike = value !== -1;
    const realValue = isLike ? 1 : -1;
    const { userId } = req.session;

    const like = await prisma.article_like.findUnique({
      where: { userId_articleId: { articleId, userId: userId as number } },
    });

    if (like && like.value !== realValue) {
      await prisma.$transaction([
        prisma.$executeRaw`
        update "article_like"
        set value = ${realValue}
        where "articleId" = ${articleId} and "userId" = ${userId}
        `,
        prisma.$executeRaw`
        update article
        set points = points + ${2 * realValue}
        where id = ${articleId};
        `,
      ]);
    } else if (!like) {
      await prisma.$transaction([
        prisma.$executeRaw`
        insert into "article_like" ("userId", "articleId", value)
        values (${userId}, ${articleId}, ${realValue});
        `,
        prisma.$executeRaw`
        update article
        set points = points + ${realValue}
        where id = ${articleId};
        `,
      ]);
    }

    return true;
  }

  @Query(() => PaginatedArticles)
  async articles(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedArticles> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;

    const articles = await prisma.$queryRawUnsafe<article[]>(`
    select a.*,
    json_build_object(
      'id', u.id,
      'username', u.username,
      'email', u.email,
      'createdAt', u."createdAt",
      'updatedAt', u."updatedAt"
      ) creator,
    ${
      req.session.userId
        ? `(select value from "article_like" where "userId" = ${req.session.userId} and "articleId" = a.id) "voteStatus"`
        : `null as "voteStatus"`
    }
    from article a

    inner join public.user u on u.id = a."creatorId"
    
    ${cursor ? `where a."createdAt" < ${new Date(parseInt(cursor))}` : ``}
    order by a."createdAt" DESC
    limit ${realLimitPlusOne}
    `);

    return {
      articles: articles.slice(0, realLimit),
      hasMore: articles.length === realLimitPlusOne,
    };
  }

  @Query(() => Article, { nullable: true })
  article(@Arg("id", () => Int) id: number): Promise<article | null> {
    return prisma.article.findUnique({
      where: { id },
      include: { creator: true, comments: { include: { creator: true } } },
    });
  }

  @UseMiddleware(isAuth)
  @Mutation(() => Article)
  createArticle(
    @Arg("input") input: ArticleInput,
    @Ctx() { req }: MyContext
  ): Promise<article> {
    return prisma.article.create({
      data: {
        ...input,
        creatorId: req.session.userId as number,
      },
    });
  }

  @Mutation(() => Article, { nullable: true })
  async updateArticle(
    @Arg("id") id: number,
    @Arg("title", () => String, { nullable: true }) title: string
  ): Promise<article | null> {
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      return null;
    }
    if (typeof title !== "undefined") {
      await Article.update({ id }, { title });
      await prisma.article.update({ where: { id }, data: { title } });
    }
    return article;
  }

  @Mutation(() => Boolean)
  async deleteArticle(@Arg("id") id: number): Promise<boolean> {
    await prisma.article.delete({ where: { id } });
    return true;
  }
}
