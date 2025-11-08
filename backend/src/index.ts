import express = require('express');
import cors = require('cors');
import logger from "./config/console";
import morgan from 'morgan';
import router from "./routes";

const app = express();

app.use(cors());
app.use(express.json());

app.use(morgan(':method :url :status :response-time ms', {
  stream : {
    write : (message) => {
      logger.debug(message.trim());
    }
  }
}));

app.use('/api', router);

logger.info('Environment: ', process.env);

app.listen(process.env.PORT, () => {
  logger.info(`Server is running on port ${ process.env.PORT }`);
})

export default app;