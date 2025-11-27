const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET = process.env.S3_BUCKET_NAME;

async function uploadBuffer(buffer, key, contentType) {
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read'
  };
  const res = await s3.upload(params).promise();
  return res.Location;
}

function getSignedUrl(key, expiresSeconds = 60 * 5) {
  return s3.getSignedUrl('getObject', {
    Bucket: BUCKET,
    Key: key,
    Expires: expiresSeconds
  });
}

module.exports = { uploadBuffer, getSignedUrl };