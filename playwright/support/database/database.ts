import 'dotenv/config'
import pg from 'pg'
import { Kysely, PostgresDialect } from 'kysely'
import { Database } from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is missing or empty. ' +
    'E2E tests require a valid database connection string pointing to Supabase Preview. ' +
    'Set DATABASE_URL in your .env file for local runs or inject it via CI secrets.'
  )
}

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  })
})

export const db = new Kysely<Database>({
  dialect,
})
