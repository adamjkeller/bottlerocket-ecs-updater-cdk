import '@aws-cdk/assert/jest';
import { App } from '@aws-cdk/core';
import { BottleRocketECS } from '../src/bottlerocket_environment';

test('Snapshot', () => {
  const app = new App();
  const stack = new BottleRocketECS(app, 'test');

  expect(
    app.synth().getStackArtifact(stack.artifactId).template,
  ).toMatchSnapshot();
});
