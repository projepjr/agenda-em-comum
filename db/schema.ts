import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(),
  initials: text('initials').notNull(),
  tone: text('tone').notNull(),
});

export const availability = sqliteTable('availability', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
});

export const meetings = sqliteTable('meetings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizerId: text('organizer_id').notNull().references(() => users.id),
  participantId: text('participant_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  startMinute: integer('start_minute').notNull(),
  duration: integer('duration').notNull(),
});
