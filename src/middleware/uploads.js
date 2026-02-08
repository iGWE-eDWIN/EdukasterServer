// const multer = require('multer');

// const storage = multer.memoryStorage();

// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5mb limit
//   fileFilter: (req, file, cb) => {
//     if (
//       file.mimetype === 'image/jpeg' ||
//       file.mimetype === 'image/png' ||
//       file.mimetype === 'image/jpg'
//     ) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only .jpeg, .jpg, .png allowed'), false);
//     }
//   },
// });

// module.exports = upload;

const multer = require('multer');
const path = require('path');

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/bookings');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images, PDF, and Word documents are allowed'), false);
  }
};

// Multer upload
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

module.exports = upload;

// const upload = require('../middlewares/upload');

// router.post(
//   '/bookings',
//   authMiddleware,
//   upload.single('file'),
//   bookTutor
// );
