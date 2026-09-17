import serverless from 'serverless-http';
import { createApp } from '../../server/app.js';

const app = createApp();
const serverlessHandler = serverless(app);

// Serverless handler for Netlify Functions wrapping the existing Express application
export const handler = async (event: any, context: any) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }
  return await serverlessHandler(event, context);
};

