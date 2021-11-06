import { Field, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Article } from "./Article";
import { Comment } from "./Comment";
import { User } from "./User";

@ObjectType()
@Entity()
export class Like extends BaseEntity {
  @Field()
  value: number;

  @Field()
  userId: number;

  @Field(() => User)
  user: User;

  @Field()
  commentId: number;

  @Field(() => Comment)
  comment: Comment;
}
