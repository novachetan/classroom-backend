const multer = require("multer");
const { Readable } = require("stream");
const yauzl = require("yauzl");
const { TextDecoder } = require("util");

const cloudinary = require("../config/cloudinary");
const AppError = require("../utils/AppError");

// ==========================================
// 1. ALLOWED FILE TYPES
// ==========================================

const allowedMimeTypes = [
    // PDF
    "application/pdf",

    // Images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",

    // Text and CSV
    "text/plain",
    "text/csv",

    // Microsoft Word
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];


// ==========================================
// 2. MULTER CONFIGURATION
// ==========================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
        files: 1,
    },

    fileFilter: (req, file, cb) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(
                new AppError(
                    "Unsupported file type. Allowed: PDF, images, TXT, CSV, DOC, and DOCX.",
                    400
                )
            );
        }

        cb(null, true);
    },
});


// Accept one optional file from the "file" field
const receiveFile = upload.single("file");


// ==========================================
// 3. FILE SIGNATURE HELPER
// ==========================================

const startsWith = (buffer, signature) => {
    return (
        buffer.length >= signature.length &&
        buffer.subarray(0, signature.length).equals(signature)
    );
};


// ==========================================
// 4. DOCX VALIDATION
// ==========================================

const isValidDocx = (buffer) => {
    return new Promise((resolve) => {

        yauzl.fromBuffer(
            buffer,
            {
                lazyEntries: true,
                autoClose: true,
            },
            (error, zipFile) => {

                if (error || !zipFile) {
                    return resolve(false);
                }

                let hasContentTypes = false;
                let hasWordDocument = false;
                let settled = false;

                const finish = (result) => {
                    if (settled) return;

                    settled = true;
                    resolve(result);
                };

                zipFile.on("error", () => {
                    finish(false);
                });

                zipFile.on("entry", (entry) => {

                    const name = entry.fileName.replace(/\\/g, "/");

                    if (name === "[Content_Types].xml") {
                        hasContentTypes = true;
                    }

                    if (name === "word/document.xml") {
                        hasWordDocument = true;
                    }

                    if (hasContentTypes && hasWordDocument) {
                        finish(true);

                        zipFile.close();
                        return;
                    }

                    zipFile.readEntry();
                });

                zipFile.on("end", () => {
                    finish(
                        hasContentTypes && hasWordDocument
                    );
                });

                zipFile.readEntry();
            }
        );
    });
};


// ==========================================
// 5. ACTUAL FILE CONTENT VALIDATION
// ==========================================

const verifyFileSignature = async (file) => {

    const buffer = file.buffer;
    const mimeType = file.mimetype;


    // --------------------------------------
    // PDF
    // --------------------------------------

    if (mimeType === "application/pdf") {

        return startsWith(
            buffer,
            Buffer.from("%PDF-")
        );
    }


    // --------------------------------------
    // JPEG
    // --------------------------------------

    if (mimeType === "image/jpeg") {

        return startsWith(
            buffer,
            Buffer.from([0xFF, 0xD8, 0xFF])
        );
    }


    // --------------------------------------
    // PNG
    // --------------------------------------

    if (mimeType === "image/png") {

        return startsWith(
            buffer,
            Buffer.from([
                0x89, 0x50, 0x4E, 0x47,
                0x0D, 0x0A, 0x1A, 0x0A
            ])
        );
    }


    // --------------------------------------
    // WEBP
    // --------------------------------------

    if (mimeType === "image/webp") {

        return (
            buffer.length >= 12 &&
            buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP"
        );
    }


    // --------------------------------------
    // GIF
    // --------------------------------------

    if (mimeType === "image/gif") {

        const signature = buffer.toString("ascii", 0, 6);

        return (
            signature === "GIF87a" ||
            signature === "GIF89a"
        );
    }


    // --------------------------------------
    // DOC (Legacy Microsoft Word)
    // --------------------------------------

    if (mimeType === "application/msword") {

        return startsWith(
            buffer,
            Buffer.from([
                0xD0, 0xCF, 0x11, 0xE0,
                0xA1, 0xB1, 0x1A, 0xE1
            ])
        );
    }


    // --------------------------------------
    // DOCX (Microsoft Word)
    // --------------------------------------

    if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {

        return await isValidDocx(buffer);
    }


    // --------------------------------------
    // TXT AND CSV
    // --------------------------------------

    if (
        mimeType === "text/plain" ||
        mimeType === "text/csv"
    ) {

        try {

            const decoder = new TextDecoder("utf-8", {
                fatal: true,
            });

            const content = decoder.decode(buffer);

            // Reject null bytes
            if (content.includes("\0")) {
                return false;
            }

            // Reject unexpected control characters
            if (/[\x01-\x08\x0B\x0C\x0E-\x1F]/.test(content)) {
                return false;
            }

            return true;

        } catch {
            return false;
        }
    }


    // Unknown file type
    return false;
};


// ==========================================
// 6. CLOUDINARY UPLOAD
// ==========================================

const uploadToCloudinary = (req, next) => {

    const isImage = req.file.mimetype.startsWith("image/");

    let completed = false;

    const fail = (error) => {

        if (completed) return;

        completed = true;
        next(error);
    };


    const uploadStream = cloudinary.uploader.upload_stream(

        {
            resource_type: isImage ? "image" : "raw",

            folder: "classroom/assignments",

            // Let Cloudinary generate the storage public ID.
            // Do not use the original user-provided filename.
        },

        (error, result) => {

            if (error) {
                return fail(error);
            }

            if (completed) return;

            completed = true;

            req.uploadedFile = {

                publicId: result.public_id,

                url: result.secure_url,

                originalName: req.file.originalname,

                mimeType: req.file.mimetype,

                size: result.bytes,

                resourceType: result.resource_type,
            };

            return next();
        }
    );


    uploadStream.on("error", fail);


    // Send the complete Buffer as one stream chunk
    Readable.from([req.file.buffer]).pipe(uploadStream);
};


// ==========================================
// 7. MAIN UPLOAD MIDDLEWARE
// ==========================================

const uploadAssignment = (req, res, next) => {

    receiveFile(req, res, (err) => {

        // ----------------------------------
        // Multer Error Handling
        // ----------------------------------

        if (err) {

            if (err instanceof multer.MulterError) {

                if (err.code === "LIMIT_FILE_SIZE") {

                    return next(
                        new AppError(
                            "File size cannot exceed 5 MB.",
                            400
                        )
                    );
                }

                if (err.code === "LIMIT_FILE_COUNT") {

                    return next(
                        new AppError(
                            "Only one attachment is allowed.",
                            400
                        )
                    );
                }

                return next(
                    new AppError(err.message, 400)
                );
            }

            return next(err);
        }


        // ----------------------------------
        // Attachment Is Optional
        // ----------------------------------

        if (!req.file) {
            return next();
        }


        // ----------------------------------
        // Verify Actual File Contents
        // ----------------------------------

        verifyFileSignature(req.file)

            .then((isValid) => {

                if (!isValid) {

                    return next(
                        new AppError(
                            "File content does not match the selected file type.",
                            400
                        )
                    );
                }


                // ----------------------------------
                // Upload Only After Verification
                // ----------------------------------

                uploadToCloudinary(req, next);

            })

            .catch(next);
    });
};


module.exports = uploadAssignment;