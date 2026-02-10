const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5mb limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpg'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpeg, .jpg, .png allowed'), false);
    }
  },
});

const storage1 = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'bookings');
    fs.mkdirSync(uploadPath, { recursive: true }); // create folder if not exists
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});

const uploads = multer({
  storage1,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else cb(new Error('Only jpeg/jpg/png allowed'), false);
  },
});

module.exports = { upload, uploads };

// const upload = require('../middlewares/upload');

// router.post(
//   '/bookings',
//   authMiddleware,
//   upload.single('file'),
//   bookTutor
// );

// const multer = require('multer');
// const path = require('path');

// // Storage config
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/bookings');
//   },
//   filename: (req, file, cb) => {
//     const uniqueName = `${Date.now()}-${Math.round(
//       Math.random() * 1e9,
//     )}${path.extname(file.originalname)}`;
//     cb(null, uniqueName);
//   },
// });

// // File filter
// const fileFilter = (req, file, cb) => {
//   const allowedMimeTypes = [
//     'image/jpeg',
//     'image/png',
//     'image/jpg',
//     'application/pdf',
//     'application/msword',
//     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//   ];

//   if (allowedMimeTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Only images, PDF, and Word documents are allowed'), false);
//   }
// };

// // Multer upload
// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
//   fileFilter,
// });

// module.exports = upload;

// import multer from 'multer';
// import path from 'path';
// import fs from 'fs';

// const uploadDir = path.join('uploads', 'bookings');

// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
//     cb(null, uniqueName + path.extname(file.originalname));
//   },
// });

// const imageFileFilter = (req, file, cb) => {
//   const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

//   if (!allowedTypes.includes(file.mimetype)) {
//     cb(new Error('Only image files (jpg, png, webp) are allowed'), false);
//   } else {
//     cb(null, true);
//   }
// };

// const uploadBookingImage = multer({
//   storage,
//   fileFilter: imageFileFilter,
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB
//   },
// });

// export default uploadBookingImage;
