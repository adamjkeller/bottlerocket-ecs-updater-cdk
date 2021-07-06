import { Construct, Stack, StackProps } from "@aws-cdk/core";
import { BottleRocketUpdater } from "./br_updater";

import * as autoscaling from "@aws-cdk/aws-autoscaling";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";

export class BottleRocketECS extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "DemoVPC");

    const ecsCluster = new ecs.Cluster(this, "DemoECSCluster", {
      vpc: vpc,
    });

    const bottlerocketAsg = new autoscaling.AutoScalingGroup(this, "BRASG", {
      vpc: vpc,
      instanceType: new ec2.InstanceType("t3.micro"),
      machineImage: new ecs.BottleRocketImage(),
      minCapacity: 0,
      maxCapacity: 10,
    });

    const capacityProviderBr = new ecs.AsgCapacityProvider(this, "ASGCPBR", {
      autoScalingGroup: bottlerocketAsg,
      machineImageType: ecs.MachineImageType.BOTTLEROCKET,
      enableManagedTerminationProtection: false,
    });

    ecsCluster.addAsgCapacityProvider(capacityProviderBr, {
      machineImageType: ecs.MachineImageType.BOTTLEROCKET,
    });

    const ecsTaskDef = new ecs.Ec2TaskDefinition(this, "ECSTaskDef");

    ecsTaskDef.addContainer("Demo", {
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/nginx/nginx:latest"
      ),
      cpu: 100,
      memoryLimitMiB: 100,
    });

    new ecs.Ec2Service(this, "BRService", {
      cluster: ecsCluster,
      taskDefinition: ecsTaskDef,
      desiredCount: 6,
      placementStrategies: [
        ecs.PlacementStrategy.packedByMemory(),
        ecs.PlacementStrategy.packedByCpu(),
      ],
      capacityProviderStrategies: [
        {
          capacityProvider: capacityProviderBr.capacityProviderName,
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
