# Postman Example

**Method:** `POST`

**URL:** `http://localhost:5000/api/upload`

**Body:** `form-data`

| Key | Type | Value |
| --- | --- | --- |
| `file` | File | Select a file from your machine |
| `type` | Text | `profile` |

Supported `type` values: `profile`, `resume`, `idcard`

## Example cURL

```bash
curl --location 'http://localhost:5000/api/upload' \
--form 'file=@"/path/to/avatar.png"' \
--form 'type="profile"'
```

## Success Response

```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "data": {
    "type": "profile",
    "folder": "profiles/",
    "key": "profiles/2f3d0f56-4dd8-4c76-9cb0-1c6d7dd0f72f-avatar.png",
    "url": "https://your-public-bucket-name.s3.ap-south-1.amazonaws.com/profiles/2f3d0f56-4dd8-4c76-9cb0-1c6d7dd0f72f-avatar.png",
    "bucket": "your-public-bucket-name",
    "region": "ap-south-1",
    "originalName": "avatar.png",
    "mimeType": "image/png",
    "size": 34567
  }
}
```
