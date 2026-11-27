import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const rayVisitors=sqliteTable('ray_visitors',{id:text('id').primaryKey(),csrf:text('csrf').notNull(),expiresAt:integer('expires_at').notNull()});
export const rayPresets=sqliteTable('ray_presets',{code:text('code').primaryKey(),ownerId:text('owner_id').notNull(),recipe:text('recipe').notNull(),createdAt:integer('created_at').notNull()});
export const rayLimits=sqliteTable('ray_limits',{id:text('id').notNull(),bucket:integer('bucket').notNull(),count:integer('count').notNull()},t=>[primaryKey({columns:[t.id,t.bucket]})]);
export const rayEntitlements=sqliteTable('ray_entitlements',{userId:text('user_id').primaryKey(),expiresAt:integer('expires_at').notNull(),provider:text('provider').notNull(),receiptId:text('receipt_id').notNull(),revoked:integer('revoked').notNull().default(0)});
