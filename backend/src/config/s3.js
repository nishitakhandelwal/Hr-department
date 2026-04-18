import { S3Client } from "@aws-sdk/client-s3";

const requiredAwsEnvVars = ["AWS_ACCESS_KEY", "AWS_SECRET_KEY", "AWS_REGION", "AWS_BUCKET_NAME"];

export const validateAwsConfig = () => {
  const missingAwsEnvVars = requiredAwsEnvVars.filter((key) => !process.env[key]);

  if (missingAwsEnvVars.length > 0) {
    const error = new Error(`Missing required AWS environment variables: ${missingAwsEnvVars.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }
};

export const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY || "",
    secretAccessKey: process.env.AWS_SECRET_KEY || "",
  },
});

export const s3BucketName = process.env.AWS_BUCKET_NAME;
export const s3Region = process.env.AWS_REGION;
