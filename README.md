# Amazon ECS Bottlerocket OS Demo

### Purpose

The purpose of this repository is to deploy a demo container to Amazon ECS using Bottlerocket OS for the compute.
In addition, a construct was created for the Bottlerocket [updater](https://github.com/bottlerocket-os/bottlerocket-ecs-updater/) based off of the [CFN template](https://github.com/bottlerocket-os/bottlerocket-ecs-updater/blob/develop/stacks/bottlerocket-ecs-updater.yaml) required to deploy it.

### Demo

To walkthrough a demonstration of how the Bottlerocket updater works, run a git checkout on the `demo` branch.

#### Walkthrough the demo

1) Deploy the stack (This assumes you have already bootstrapped your account and region)

```bash
cdk deploy --require-approval never
```

2) O