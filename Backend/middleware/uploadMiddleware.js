import multer from "multer";

// Configure multer for memory storage (we'll upload to Cloudinary from buffer)
const storage = multer.memoryStorage();

// Employee/CNIC uploads are image-only; guarantor documents may also be PDFs.
const fileFilter = (req, file, cb) => {
  const imageMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
  ];
  const documentMimeTypes = [...imageMimeTypes, "application/pdf"];
  const allowedMimeTypes =
    file.fieldname === "guarantorDocuments" ? documentMimeTypes : imageMimeTypes;

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const allowedLabel =
      file.fieldname === "guarantorDocuments"
        ? "JPEG, PNG, JPG, WebP, and PDF"
        : "JPEG, PNG, JPG, and WebP";

    cb(
      new Error(
        `Invalid file type. Only ${allowedLabel} are allowed.`
      ),
      false
    );
  }
};

// Create multer instance with configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB limit per file
  },
});

// Middleware for uploading employee images (picture and CNIC front/back)
export const uploadEmployeeImages = upload.fields([
  { name: "employeePicture", maxCount: 1 },
  { name: "cnicFront", maxCount: 1 },
  { name: "cnicBack", maxCount: 1 },
  { name: "guarantorDocuments", maxCount: 10 },
]);

// Error handling middleware for multer
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File size too large. Maximum size is 1MB.",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        message:
          "Unexpected file field. Only employeePicture, cnicFront, cnicBack and guarantorDocuments are allowed.",
      });
    }
    return res.status(400).json({
      message: `Upload error: ${err.message}`,
    });
  }

  if (err) {
    return res.status(400).json({
      message: err.message,
    });
  }

  next();
};

export default upload;
