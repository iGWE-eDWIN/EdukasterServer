const multer = require('multer');

const storage = multer.diskStorage({
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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else cb(new Error('Only jpeg/jpg/png allowed'), false);
  },
});

module.exports = upload;
