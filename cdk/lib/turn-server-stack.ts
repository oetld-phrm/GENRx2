import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { VpcStack } from "./vpc-stack";

export class TurnServerStack extends Stack {
  public readonly turnServerUrl: string;
  public readonly turnSecret: secretsmanager.Secret;
  public readonly stunServerUrl: string;

  constructor(
    scope: Construct,
    id: string,
    vpcStack: VpcStack,
    props?: StackProps
  ) {
    super(scope, id, props);

    const vpc = vpcStack.vpc;

    // 1) Shared secret for coturn time-limited credential auth (RFC 5389)
    this.turnSecret = new secretsmanager.Secret(this, "TurnSharedSecret", {
      secretName: `${id}-TurnSharedSecret`,
      description: "Shared secret for coturn TURN server time-limited credential authentication",
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // 2) Security group for TURN server
    const turnSg = new ec2.SecurityGroup(this, "TurnSecurityGroup", {
      vpc,
      description: "Security group for coturn TURN server",
      allowAllOutbound: true,
    });

    // UDP 3478 — STUN/TURN
    turnSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.udp(3478),
      "Allow UDP STUN/TURN traffic"
    );

    // TCP 3478 — TURN TCP fallback
    turnSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3478),
      "Allow TCP TURN fallback traffic"
    );

    // UDP 49152-65535 — TURN relay port range
    turnSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.udpRange(49152, 65535),
      "Allow UDP TURN relay traffic"
    );

    // 3) IAM role for the EC2 instance (needs Secrets Manager read access)
    const instanceRole = new iam.Role(this, "TurnInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    this.turnSecret.grantRead(instanceRole);

    // 4) EC2 instance running coturn
    // Control Tower hook CT.EC2.PR.8 requires public IP to be set via
    // NetworkInterfaces, not the root-level AssociatePublicIpAddress.
    const turnInstance = new ec2.Instance(this, "TurnServer", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: turnSg,
      role: instanceRole,
      associatePublicIpAddress: false, // Disabled here — set via CfnInstance override below
    });

    // Override the CloudFormation to use NetworkInterfaces with public IP
    const cfnInstance = turnInstance.instance as ec2.CfnInstance;
    cfnInstance.addPropertyOverride("NetworkInterfaces", [
      {
        DeviceIndex: "0",
        AssociatePublicIpAddress: true,
        SubnetId: vpc.publicSubnets[0].subnetId,
        GroupSet: [turnSg.securityGroupId],
      },
    ]);
    // Remove root-level properties that conflict with NetworkInterfaces
    cfnInstance.addPropertyDeletionOverride("SubnetId");
    cfnInstance.addPropertyDeletionOverride("SecurityGroupIds");

    // UserData script: install and configure coturn
    turnInstance.addUserData(
      "#!/bin/bash",
      "set -euxo pipefail",
      "",
      "# Install coturn",
      "dnf install -y coturn",
      "",
      "# Retrieve the shared secret from Secrets Manager",
      `TURN_SECRET=$(aws secretsmanager get-secret-value --secret-id "${this.turnSecret.secretName}" --region "${this.region}" --query SecretString --output text)`,
      "",
      "# Get the public IP of this instance",
      'PUBLIC_IP=$(TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600") && curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)',
      "",
      "# Write coturn configuration",
      "cat > /etc/turnserver.conf << EOF",
      "use-auth-secret",
      "static-auth-secret=$TURN_SECRET",
      "realm=turn.example.com",
      "min-port=49152",
      "max-port=65535",
      "no-tls",
      "no-dtls",
      "listening-port=3478",
      "external-ip=$PUBLIC_IP",
      "verbose",
      "EOF",
      "",
      "# Enable and start coturn",
      "systemctl enable coturn",
      "systemctl start coturn"
    );

    // 5) STUN server URL (Google's public STUN server)
    this.stunServerUrl = "stun:stun.l.google.com:19302";

    // TURN server URL uses the instance's public IP
    this.turnServerUrl = `turn:${turnInstance.instancePublicIp}:3478`;

    // 6) Outputs
    new CfnOutput(this, "TurnServerUrl", {
      value: this.turnServerUrl,
      description: "TURN server URL for WebRTC ICE configuration",
      exportName: `${id}-TurnServerUrl`,
    });

    new CfnOutput(this, "StunServerUrl", {
      value: this.stunServerUrl,
      description: "STUN server URL for WebRTC ICE configuration",
      exportName: `${id}-StunServerUrl`,
    });

    new CfnOutput(this, "TurnSecretArn", {
      value: this.turnSecret.secretArn,
      description: "ARN of the TURN shared secret in Secrets Manager",
      exportName: `${id}-TurnSecretArn`,
    });
  }
}
