import { Field, Int, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ArticleLike } from "./ArticleLike";
import { Comment } from "./Comment";
import { Like } from "./Like";
import { User } from "./User";

@ObjectType()
@Entity()
export class Article extends BaseEntity {
  @Field(() => Int)
  id!: number;

  @Field()
  title!: string;

  @Field()
  text!: string;

  @Field()
  points!: number;

  @Field(() => Int, { nullable: true })
  voteStatus: number | null;

  @Field()
  creatorId: number;

  @Field(() => User)
  creator: User;

  @Field(() => [Comment])
  comments: Comment[];

  @Field(() => String)
  createdAt: Date;

  @Field(() => String)
  updatedAt: Date;
}
