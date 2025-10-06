// const mongoose = require('mongoose');
// const GridFSBucket = require('mongodb').GridFSBucket;

// let gfs, gridfsBucket;

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGODB_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });

//     console.log(`MongoDB Connected: ${conn.connection.host}`);

//     // Initialize GridFS
//     gridfsBucket = new GridFSBucket(conn.connection.db, {
//       bucketName: 'uploads',
//     });

//     // For backward compatibility
//     gfs = gridfsBucket;

//     return conn;
//   } catch (error) {
//     console.error('Database connection error:', error);
//     process.exit(1);
//   }
// };

// module.exports = {
//   connectDB,
//   getGridFSBucket: () => gridfsBucket,
//   getGFS: () => gfs,
// };

const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let gfs, gridfsBucket;

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGODB_URI);
//     console.log(`MongoDB Connected: ${conn.connection.host}`);

//     // Init GridFS after connection opens
//     mongoose.connection.once('open', () => {
//       gridfsBucket = new GridFSBucket(mongoose.connection.db, {
//         bucketName: 'uploads',
//       });
//       gfs = gridfsBucket; // backward compatibility
//       console.log('GridFS initialized');
//     });

//     return conn;
//   } catch (error) {
//     console.error('Database connection error:', error);
//     process.exit(1);
//   }
// };

// const getGridFSBucket = () => {
//   if (!gridfsBucket) throw new Error('GridFS not initialized yet');
//   return gridfsBucket;
// };

// const getGFS = () => {
//   if (!gfs) throw new Error('GFS not initialized yet');
//   return gfs;
// };

const connectDB = async () => {
  try {
    // Set up the 'open' listener BEFORE connecting
    mongoose.connection.once('open', () => {
      gridfsBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads',
      });
      gfs = gridfsBucket;
      console.log('✅ GridFS initialized');
    });

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // If connection is already open (can happen), initialize immediately
    if (mongoose.connection.readyState === 1 && !gridfsBucket) {
      gridfsBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads',
      });
      gfs = gridfsBucket;
      console.log('✅ GridFS initialized (immediate)');
    }

    return conn;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

const getGridFSBucket = () => {
  if (!gridfsBucket) throw new Error('GridFS not initialized yet');
  return gridfsBucket;
};

const getGFS = () => {
  if (!gfs) throw new Error('GFS not initialized yet');
  return gfs;
};

module.exports = {
  connectDB,
  getGridFSBucket,
  getGFS,
};
