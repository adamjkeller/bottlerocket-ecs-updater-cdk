import { App } from '@aws-cdk/core';
import { BottleRocketECS } from './bottlerocket_environment';

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();
new BottleRocketECS(app, 'BottleRocketDemo', { env: devEnv });
app.synth();
