import { uploadFileToS3 } from "../services/s3Service.js";

const folderMap = {
  profile: "profiles/",
  resume: "resumes/",
  idcard: "id-cards/",
};

const resolveFolder = (type) => folderMap[String(type || "").trim().toLowerCase()] || "documents/";

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required in the "file" field.',
      });
    }

    const type = String(req.body.type || "").trim().toLowerCase();
    const folder = resolveFolder(type);
    const uploadedFile = await uploadFileToS3({
      file: req.file,
      folder,
    });

    return res.status(201).json({
      success: true,
      message: "File uploaded successfully.",
      data: {
        type: type || "default",
        folder,
        ...uploadedFile,
      },
    });
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    next(error);
  }
};
