const mongoose = require('mongoose');
const MONGODB_URI = 'MONGODB_URI=mongodb+srv://Ugobueze:Ugobueze001@cluster0.zgzsvmw.mongodb.net/ugobtc?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('Connection error:', err));