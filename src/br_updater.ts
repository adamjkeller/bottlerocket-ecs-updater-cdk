import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import { Rule, Schedule } from '@aws-cdk/aws-events';
import { EcsTask } from '@aws-cdk/aws-events-targets';

import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as ssm from '@aws-cdk/aws-ssm';
import * as cdk from '@aws-cdk/core';

/**
 * This construct will deploy the Bottlerocket OS updater for Amazon ECS.
 * Note that while we built this construct, the CDK does offer the ability
 * to import existing CFN templates. See the documentation for more info.
 * https://docs.aws.amazon.com/cdk/latest/guide/use_cfn_template.html
 */

/**
 * This construct will deploy the Bottlerocket OS updater for Amazon ECS.
 * Note that while we built this construct, the CDK does offer the ability
 * to import existing CFN templates. See the documentation for more info.
 * https://docs.aws.amazon.com/cdk/latest/guide/use_cfn_template.html
 */

/**
 * The properties for the BottleRocketUpdater
 */
export interface BottleRocketUpdaterProps {
  /**
   * The ECS Cluster to deploy the updater controller to
   */
  readonly cluster: ecs.ICluster;
  /**
   * VPC Subnet(s) to deploy the controller into
   */
  readonly subnets: Array<ec2.ISubnet>;
  /**
   * Name of Cloudwatch log group for controller
   */
  readonly logGroupName: string;
  /**
   * Enable/Disable scheduled event
   */
  readonly scheduleState?: boolean;
  /**
   * Docker image used for the updater task
   */
  readonly updaterImage?: string;
}

/**
 * The Bottle Rocket Updater
 */
export class BottleRocketUpdater extends cdk.Construct {
  readonly cluster: ecs.ICluster;
  readonly subnets: Array<ec2.ISubnet>;
  readonly logGroupName: string;
  readonly scheduleState?: boolean;
  readonly updaterImage?: string;

  constructor(
    scope: cdk.Construct,
    id: string,
    props: BottleRocketUpdaterProps,
  ) {
    super(scope, id);

    this.cluster = props.cluster;
    this.subnets = props.subnets;
    this.logGroupName = props.logGroupName;
    this.scheduleState = props.scheduleState ?? true;
    this.updaterImage =
      props.updaterImage ??
      'public.ecr.aws/bottlerocket/bottlerocket-ecs-updater:v0.1.0';

    const UpdateCheckCommand = new ssm.CfnDocument(this, 'UpdateCheckCommand', {
      content: {
        schemaVersion: '2.2',
        description: 'Bottlerocket - Check available updates',
        mainSteps: [
          {
            action: 'aws:runShellScript',
            name: 'CheckUpdate',
            precondition: {
              StringEquals: ['platformType', 'Linux'],
            },
            inputs: {
              timeoutSeconds: '1800',
              runCommand: ['apiclient update check'],
            },
          },
        ],
      },
      name: `UpdateCheckCommand${cdk.Stack.of(this).stackName}`,
      documentType: 'Command',
    });

    const UpdateApplyCommand = new ssm.CfnDocument(this, 'UpdateApplyCommand', {
      content: {
        schemaVersion: '2.2',
        description: 'Bottlerocket - Apply update',
        mainSteps: [
          {
            action: 'aws:runShellScript',
            name: 'ApplyUpdate',
            precondition: {
              StringEquals: ['platformType', 'Linux'],
            },
            inputs: {
              timeoutSeconds: '1800',
              runCommand: ['apiclient update apply'],
            },
          },
        ],
      },
      name: `UpdateApplyCommand${cdk.Stack.of(this).stackName}`,
      documentType: 'Command',
    });

    const RebootCommand = new ssm.CfnDocument(this, 'RebootCommand', {
      content: {
        schemaVersion: '2.2',
        description: 'Bottlerocket - Reboot',
        mainSteps: [
          {
            action: 'aws:runShellScript',
            name: 'Reboot',
            precondition: {
              StringEquals: ['platformType', 'Linux'],
            },
            inputs: {
              timeoutSeconds: '1800',
              runCommand: ['apiclient reboot'],
            },
          },
        ],
      },
      name: `RebootCommand${cdk.Stack.of(this).stackName}`,
      documentType: 'Command',
    });

    const policyStatementWildcards = new iam.PolicyStatement({
      actions: [
        'ecs:DescribeContainerInstances',
        'ecs:ListTasks',
        'ecs:UpdateContainerInstancesState',
        'ecs:DescribeTasks',
        'ec2:DescribeInstanceStatus',
      ],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
    });

    const policyStatementCluster = new iam.PolicyStatement({
      actions: ['ecs:ListContainerInstances'],
      effect: iam.Effect.ALLOW,
      resources: [this.cluster.clusterArn],
    });

    const policyStatementClusterConditional = new iam.PolicyStatement({
      actions: [
        'ecs:DescribeContainerInstances',
        'ecs:ListTasks',
        'ecs:UpdateContainerInstancesState',
        'ecs:DescribeTasks',
      ],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      conditions: {
        ArnEquals: {
          'ecs:cluster': this.cluster.clusterArn,
        },
      },
    });

    const policyStatementSSMSendCommand = new iam.PolicyStatement({
      actions: ['ssm:SendCommand'],
      effect: iam.Effect.ALLOW,
      resources: [
        `arn:${cdk.Stack.of(this).partition}:ssm:${cdk.Stack.of(this).region}:${
          cdk.Stack.of(this).account
        }:document/${UpdateCheckCommand.name}`,
        `arn:${cdk.Stack.of(this).partition}:ssm:${cdk.Stack.of(this).region}:${
          cdk.Stack.of(this).account
        }:document/${UpdateApplyCommand.name}`,
        `arn:${cdk.Stack.of(this).partition}:ssm:${cdk.Stack.of(this).region}:${
          cdk.Stack.of(this).account
        }:document/${RebootCommand.name}`,
        `arn:${cdk.Stack.of(this).partition}:ec2:${cdk.Stack.of(this).region}:${
          cdk.Stack.of(this).account
        }:instance/*`,
      ],
    });

    const policyStatementSSMGetCommand = new iam.PolicyStatement({
      actions: ['ssm:GetCommandInvocation'],
      effect: iam.Effect.ALLOW,
      resources: [
        `arn:${cdk.Stack.of(this).partition}:ssm:${cdk.Stack.of(this).region}:${
          cdk.Stack.of(this).account
        }:*`,
      ],
    });

    const logGroup = new logs.LogGroup(this, 'UpdaterLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
    });

    const updaterTaskDef = new ecs.FargateTaskDefinition(
      this,
      'UpdaterTaskDef',
      {
        cpu: 256,
        memoryLimitMiB: 512,
      },
    );

    updaterTaskDef.addToTaskRolePolicy(policyStatementCluster);
    updaterTaskDef.addToTaskRolePolicy(policyStatementClusterConditional);
    updaterTaskDef.addToTaskRolePolicy(policyStatementSSMGetCommand);
    updaterTaskDef.addToTaskRolePolicy(policyStatementWildcards);
    updaterTaskDef.addToTaskRolePolicy(policyStatementSSMSendCommand);

    updaterTaskDef.addContainer('UpdaterContainer', {
      image: ecs.ContainerImage.fromRegistry(this.updaterImage),
      command: [
        '-cluster',
        `${this.cluster.clusterName}`,
        '-region',
        `${cdk.Stack.of(this).region}`,
        '-check-document',
        `${UpdateCheckCommand.name}`,
        '-apply-document',
        `${UpdateApplyCommand.name}`,
        '-reboot-document',
        `${RebootCommand.name}`,
      ],
      logging: ecs.LogDriver.awsLogs({
        logGroup: logGroup,
        streamPrefix: 'brUpdaterEcsTask',
      }),
    });

    new cdk.CfnOutput(this, 'BottleRocketUpdateLG', {
      value: logGroup.logGroupName,
      exportName: 'BrUpdaterLogGroupName',
    });

    const ecsTaskTarget = new EcsTask({
      cluster: this.cluster,
      taskDefinition: updaterTaskDef,
    });

    if (this.scheduleState) {
      new Rule(this, 'ScheduleRule', {
        /**
         * Note that the schedule is for demo purposes only, this should run every 12 hours
         * schedule: Schedule.rate(cdk.Duration.hours(12)),
         **/
        schedule: Schedule.rate(cdk.Duration.minutes(5)),
        targets: [ecsTaskTarget],
      });
    }
  }
}
