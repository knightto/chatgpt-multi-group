const mongoose = require('mongoose');

function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('FATAL: MONGO_URI is not set in environment.');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  mongoose
    .connect(uri, { })
    .then(() => {
      console.log(JSON.stringify({ t: new Date().toISOString(), level: 'info', msg: 'Mongo connected' }));
    })
    .catch((err) => {
      console.error('Mongo connection error:', err);
      process.exit(1);
    });
}

module.exports = connectDB;
