import chalk from 'chalk';
import morgan from 'morgan';

/**
 * @class Logger
 * @description This class is responsible for handling output to console.
 * It provides methods for logging messages at different levels (debug, info, warn, error)
 * with appropriate formatting and timestamps.
 * @example
 * const logger = new Logger();
 * logger.info('Server started successfully');
 * logger.error('An error occurred', { errorCode: 500 });
 */
class Logger {
  private get getTimeStamp() : string {
    const now = new Date();
    return chalk.dim.gray(`[${ now.toISOString() }]`);
  }

  public debug(message : string, data? : unknown) {
    console.log(chalk.dim.hex('#c6a0f6')('[DEBUG]'), chalk.hex('#c6a0f6')(message), this.getData(data), this.getTimeStamp);
  }

  public info(message : string, data? : unknown) {
    console.log(chalk.dim.blue('[INFO]'), chalk.blue(message), this.getData(data), this.getTimeStamp);
  }

  public warn(message : string, data? : unknown) {
    console.warn(chalk.dim.yellow('[WARN]'), chalk.yellow(message), this.getData(data), this.getTimeStamp);
  }

  public error(message : string, data? : unknown) {
    console.error(chalk.dim.red('[ERROR]'), chalk.red(message), this.getData(data), this.getTimeStamp);
  }


  private getData(data : unknown) : string {
    return chalk.reset(data ? JSON.stringify(data, null, 2) : '');
  }
}

const logger = new Logger();


morgan.token('method', (req) => {
  const types : Record<string, string> = {
    'GET'     : chalk.green('GET'),
    'POST'    : chalk.blue('POST'),
    'PUT'     : chalk.yellow('PUT'),
    'DELETE'  : chalk.red('DELETE'),
    'PATCH'   : chalk.magenta('PATCH'),
    'HEAD'    : chalk.cyan('HEAD'),
    'OPTIONS' : chalk.gray('OPTIONS'),
    'TRACE'   : chalk.white('TRACE'),
    'CONNECT' : chalk.whiteBright('CONNECT'),
  }
  return types[req.method!] || chalk.white(req.method);
});

morgan.token('status', (_req, res) => {
  const status = res.statusCode;
  if (status >= 200 && status < 300)
    return chalk.green(status);

  if (status >= 300 && status < 400)
    return chalk.cyan(status);

  if (status >= 400 && status < 500)
    return chalk.yellow(status);

  if (status >= 500)
    return chalk.red(status);

  return chalk.white(status);
})

export default logger;