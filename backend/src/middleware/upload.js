import multer from 'multer';

const MB = 1024 * 1024;
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif|avif)$/;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * MB, files: 10 },
  fileFilter: (_req, file, cb) => {
    if ((file.fieldname === 'thumbnail' || file.fieldname === 'screenshots') && !IMAGE_TYPES.test(file.mimetype)) {
      return cb(Object.assign(new Error('Thumbnails and screenshots must be PNG, JPG, WebP, GIF or AVIF images.'), { status: 400 }));
    }
    cb(null, true);
  },
});
