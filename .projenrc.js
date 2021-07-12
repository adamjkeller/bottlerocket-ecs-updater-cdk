const { AwsCdkTypeScriptApp } = require('projen');
const project = new AwsCdkTypeScriptApp({
  cdkVersion: '1.112.0',
  defaultReleaseBranch: 'main',
  name: 'bottlerocket-cdk',
  gitignore: ['cdk.context.json'],
  cdkDependencies: [
    '@aws-cdk/core',
    '@aws-cdk/aws-cloudwatch',
    '@aws-cdk/aws-ecs',
    '@aws-cdk/aws-ecs-patterns',
    '@aws-cdk/aws-ec2',
    '@aws-cdk/aws-ssm',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-autoscaling',
    '@aws-cdk/aws-events',
    '@aws-cdk/aws-events-targets',
    '@aws-cdk/aws-logs',
  ],
});
project.synth();
