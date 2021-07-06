# Amazon ECS Bottlerocket OS Demo

### Purpose

The purpose of this repository is to deploy a demo container to Amazon ECS using Bottlerocket OS for the compute.
In addition, a construct was created for the Bottlerocket [updater](https://github.com/bottlerocket-os/bottlerocket-ecs-updater/) based off of the [CFN template](https://github.com/bottlerocket-os/bottlerocket-ecs-updater/blob/develop/stacks/bottlerocket-ecs-updater.yaml) required to deploy it.

### Demo

To walkthrough a demonstration of how the Bottlerocket updater works, run a git checkout on the `demo` branch.

#### Walkthrough

1) Create an SSH key and deploy the stack (This assumes you have already bootstrapped your account and region)

```bash
aws ec2 create-key-pair --key-name bottlerocketdemo --query KeyMaterial --output text | tee -a brdemo.pem
cdk deploy --require-approval never
```

2) Once the stack is deployed, the name of the Cloudwatch Logs group will be displayed. 
Copy this name and navigate to the Cloudwatch Logs console in AWS. 
Example of output:

```
Outputs:
BottleRocketDemo.BRUpdaterBottleRocketUpdateLG86D2BED1 = BottleRocketDemo-BRUpdaterUpdaterLogGroup920D5B89-eDQb4CrtQgw5
```

3) Monitor the logs. 
In realtime you will see the updater take action.
It will start by putting the host into a `DRAINING` state.
Next, the scheduler will schedule those tasks to a new host which will come up because of capacity providers and cluster autoscaling.
Finally, once the tasks are rescheduled the OS update will take place and when the update is complete it will reboot and register back into the cluster.

### Testing

#### Instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filter "Name=tag-value,Values=BottleRocketDemo/BRASG" \
  --query 'Reservations[].Instances[].InstanceId' \
  --output text)

#### Enter a shell into the host
aws ssm start-session --target $INSTANCE_ID  

##### Initiate the SSH tunnel over SSM
aws ssm start-session --target $INSTANCE_ID \
                       --document-name AWS-StartPortForwardingSession \
                       --parameters '{"portNumber":["22"],"localPortNumber":["9999"]}'

##### SSH into the instance over the SSM tunnel                    
ssh -L 9999:localhost:22 ec2-user@$INSTANCE_ID -i ./brdemo.pem

