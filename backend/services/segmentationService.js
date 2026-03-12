const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const SEGMENTATION_API_URL =
  process.env.SEGMENTATION_API_URL || 'http://127.0.0.1:8000/segment';

exports.runSegmentation = async (filePath) => {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    const timeout =
      Number(process.env.SEGMENTATION_TIMEOUT_MS) || 120000; // 2 minutes

    const response = await axios.post(SEGMENTATION_API_URL, formData, {
      headers: formData.getHeaders(),
      timeout,
    });

    return response.data;
  } catch (error) {
    console.error('Segmentation error:', error.message || error);
    throw new Error('Segmentation service failed');
  }
};
