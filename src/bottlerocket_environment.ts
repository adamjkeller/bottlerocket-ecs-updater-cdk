import { Construct, Stack, StackProps, RemovalPolicy } from "@aws-cdk/core";
import { BottleRocketUpdater } from "./br_updater";

import * as autoscaling from "@aws-cdk/aws-autoscaling";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as kms from "@aws-cdk/aws-kms";
import * as logs from "@aws-cdk/aws-logs";
import * as s3 from "@aws-cdk/aws-s3";
//import { ParameterType } from "@aws-cdk/aws-ssm";

export class BottleRocketECS extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "DemoVPC");

    const execKmsKey = new kms.Key(this, "ExecKMS");

    const execBucket = new s3.Bucket(this, "ExecBucketLogs", {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const execLogGroup = new logs.LogGroup(this, "ExecLogGrp");

    const ecsCluster = new ecs.Cluster(this, "DemoECSCluster", {
      vpc: vpc,
      executeCommandConfiguration: {
        kmsKey: execKmsKey,
        logConfiguration: {
          cloudWatchLogGroup: execLogGroup,
          s3Bucket: execBucket,
          s3KeyPrefix: "exec_logs",
        },
        logging: ecs.ExecuteCommandLogging.OVERRIDE,
      },
    });

    const bottlerocketAsg = new autoscaling.AutoScalingGroup(this, "BRASG", {
      vpc: vpc,
      instanceType: new ec2.InstanceType("t3.medium"),
      // machineImage: new ecs.BottleRocketImage(),
      machineImage: ec2.MachineImage.fromSSMParameter(
        "/aws/service/bottlerocket/aws-ecs-1/x86_64/1.1.0/image_id",
        ec2.OperatingSystemType.UNKNOWN,
        ec2.UserData.custom("")
      ),
      minCapacity: 0,
      maxCapacity: 10,
      keyName: "brtest",
    });

    const capacityProviderBr = new ecs.AsgCapacityProvider(this, "ASGCPBR", {
      autoScalingGroup: bottlerocketAsg,
      machineImageType: ecs.MachineImageType.BOTTLEROCKET,
    });

    ecsCluster.addAsgCapacityProvider(capacityProviderBr, {
      machineImageType: ecs.MachineImageType.BOTTLEROCKET,
    });

    const ecsTaskDef = new ecs.Ec2TaskDefinition(this, "ECSTaskDef");

    ecsTaskDef.addContainer("Demo", {
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/nginx/nginx:latest"
      ),
      cpu: 256,
      memoryLimitMiB: 512,
    });

    new ecs.Ec2Service(this, "BRService", {
      cluster: ecsCluster,
      taskDefinition: ecsTaskDef,
      desiredCount: 3,
      enableExecuteCommand: false,
      placementStrategies: [
        ecs.PlacementStrategy.packedByMemory(),
        ecs.PlacementStrategy.packedByCpu(),
      ],
      capacityProviderStrategies: [
        {
          capacityProvider: capacityProviderBr.capacityProviderName,
          base: 1,
          weight: 1,
        },
      ],
    });

    new BottleRocketUpdater(this, "BRUpdater", {
      cluster: ecsCluster,
      subnets: vpc.privateSubnets,
      logGroupName: "BRUpdater",
    });
  }
}
