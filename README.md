# Amazon ECS Bottlerocket OS Demo

### Purpose

The purpose of this repository is to deploy a demo container to Amazon ECS using Bottlerocket OS for the compute.
In addition, a construct was created for the Bottlerocket [updater](https://github.com/bottlerocket-os/bottlerocket-ecs-updater/) based off of the [CFN template](https://github.com/bottlerocket-os/bottlerocket-ecs-updater/blob/develop/stacks/bottlerocket-ecs-updater.yaml) required to deploy it.

### Demo

To walkthrough a demonstration of how the Bottlerocket updater works, run a git checkout on the `demo` branch.

#### Walkthrough

1. Create an SSH key and deploy the stack (This assumes you have already bootstrapped your account and region)

```bash
aws ec2 create-key-pair --key-name bottlerocketdemo --query KeyMaterial --output text | tee -a brdemo.pem
cdk deploy --require-approval never
```

2. Once the stack is deployed, the name of the Cloudwatch Logs group will be displayed.
   Copy this name and navigate to the Cloudwatch Logs console in AWS.
   Example of output:

```
Outputs:
BottleRocketDemo.BRUpdaterBottleRocketUpdateLG86D2BED1 = BottleRocketDemo-BRUpdaterUpdaterLogGroup920D5B89-eDQb4CrtQgw5
```

3. Monitor the environment:

   ### The updater controller

   To watch the updater in realtime, we will tail the logs to gain insight into what's happening.

   To tail the logs via the AWS CLI, run the following command:

   ```bash
   aws logs tail --since 1h --follow <LOG_GROUP_NAME_HERE>
   ```

   What is happening in realtime is the updater monitors for any hosts that are on an older version of the OS.
   When it finds hosts that are outdated, it will begin to work in waves.
   It will determine which host to update, and begins by putting the host into a `DRAINING` state.
   Next, the scheduler will schedule those tasks to a new host which will come up because of capacity providers and cluster autoscaling.
   Finally, once the tasks are rescheduled the OS update will take place and when the update is complete it will reboot and register back into the cluster.

   ### The Cluster

   Navigate to the ECS Console, and drill down into the ECS Instances.  
   When the updater begins the update process, it will first set the instance to `DRAINING` as mentioned above.
   When this happens, pay attention as the scheduler will begin the process of rescheduling the tasks to a new instance.
   This will take a couple of minutes as cluster autoscaling will kick in to bring up a new host to run the tasks.

4. Cleanup resources by running the following commands:

   ```bash
   cdk destroy -f
   ```
