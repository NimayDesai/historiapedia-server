import { Field, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Article } from "./Article";
import { Comment } from "./Comment";
import { User } from "./User";

@ObjectType()
export class ArticleLike extends BaseEntity {
  @Field()
  value: number;

  @Field()
  userId: number;

  @Field(() => User)
  user: User;

  @Field()
  articleId: number;

  @Field(() => Article)
  article: Comment;
}
