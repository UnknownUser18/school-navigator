import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import logger from './console';
import { QueryError, QueryResult } from "mysql2";


dotenv.configDotenv({
  quiet    : true,
  override : true,
});

function existsEnv(name : string) : boolean {
  return process.env[name] !== undefined;
}

if (!existsEnv('DB_HOST')) {
  logger.error('Missing DB_HOST environment variable');
  process.exit(1);
}

if (!existsEnv('DB_USER')) {
  logger.error('Missing DB_USER environment variable');
  process.exit(1);
}

if (!existsEnv('DB_PASSWORD')) {
  logger.error('Missing DB_PASSWORD environment variable');
  process.exit(1);
}

if (!existsEnv('DB_NAME')) {
  logger.error('Missing DB_NAME environment variable');
  process.exit(1);
}

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

const pool = mysql.createPool({
  host               : DB_HOST,
  user               : DB_USER,
  password           : DB_PASSWORD,
  database           : DB_NAME,
  waitForConnections : true,
  namedPlaceholders  : true,
  connectionLimit    : 10,
  queueLimit         : 0,
});

pool.on('connection', (connection) => {
  logger.info('New database connection established with id ' + connection.threadId);
})

/**
 * @method executeQuery
 * @param query{string} - SQL query to execute
 * @param params{any[]} - Optional parameters for the query
 * @returns {Promise<QueryResult>} - Promise resolving to the query result
 * @description Executes a SQL query using the established database connection.
 * @throws - Throws an error type QueryError if the query execution fails.
 */
export async function executeQuery(query : string, params? : {}) : Promise<QueryResult | QueryError | null> {
  try {
    const result = await pool.query(query, params);
    logger.debug('Query executed successfully', { query, params });
    return result[0]; // MySQL2 returns an array with results and fields
  } catch (error) {
    logger.error('Error executing query', error);
    return error as QueryError; // Return the error as QueryError type
  }
}