const Scan = require('../models/Scan');
const { runSegmentation } = require('../services/segmentationService');
const { generateMockSegmentation } = require('../services/mockSegmentationService');

// @desc      Upload DICOM and start processing
// @route     POST /api/scans/upload
// @access    Private
exports.uploadScan = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file received. Please upload a DICOM .zip file using field name "dicom".' });
    }

    // Create scan record immediately (status: processing)
    const scan = await Scan.create({
      user: req.user.id,
      fileName: req.file.originalname || req.file.filename,
      status: 'processing'
    });

    // Fire-and-forget async segmentation (doesn't block the HTTP response)
    processScan(scan._id, req.file.path).catch(err =>
      console.error(`Background processScan error for scan ${scan._id}:`, err)
    );

    res.status(202).json({
      success: true,
      message: 'Scan uploaded successfully. Processing has started.',
      data: scan
    });
  } catch (err) {
    console.error('uploadScan error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc      Upload DICOM and return immediate mock segmentation
// @route     POST /api/scans/mock-upload
// @access    Private
exports.uploadMockScan = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error:
          'No file received. Please upload a DICOM file (or ZIP) using field name "dicom".',
      });
    }

    const mockResult = await generateMockSegmentation(req.file.path);

    res.status(200).json({
      success: true,
      ...mockResult,
    });
  } catch (err) {
    console.error('uploadMockScan error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate mock segmentation.',
    });
  }
};

// @desc      Get all scans for current user
// @route     GET /api/scans
// @access    Private
exports.getScans = async (req, res, next) => {
  try {
    // Doctors can see all scans, patients only see their own
    const filter = req.user.role === 'patient' ? { user: req.user.id } : {};
    const scans = await Scan.find(filter).sort('-uploadDate').populate('user', 'name email');

    res.status(200).json({
      success: true,
      count: scans.length,
      data: scans
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc      Get single scan
// @route     GET /api/scans/:id
// @access    Private
exports.getScan = async (req, res, next) => {
  try {
    const scan = await Scan.findById(req.params.id).populate('user', 'name email');

    if (!scan) {
      return res.status(404).json({ success: false, error: 'Scan not found' });
    }

    res.status(200).json({
      success: true,
      data: scan
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc      Poll scan status
// @route     GET /api/scans/:id/status
// @access    Private
exports.getScanStatus = async (req, res, next) => {
  try {
    const scan = await Scan.findById(req.params.id, 'status segmentationData meshFiles uploadDate fileName');

    if (!scan) {
      return res.status(404).json({ success: false, error: 'Scan not found' });
    }

    res.status(200).json({
      success: true,
      status: scan.status,
      data: scan
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────
//  Background processing pipeline
// ─────────────────────────────────────────────
async function processScan(scanId, filePath) {
  console.log(`[Segmentation] Starting for scan ${scanId}`);
  try {
    const scan = await Scan.findById(scanId);
    if (!scan) {
      console.error(`[Segmentation] Scan ${scanId} not found in DB`);
      return;
    }

    // Run AI segmentation (mocked / real Modal call)
    const result = await runSegmentation(filePath);

    // Destructure meshFiles out separately
    const { meshFiles, ...segmentationData } = result;

    scan.status = 'completed';
    scan.segmentationData = segmentationData;
    scan.meshFiles = meshFiles;

    await scan.save();
    console.log(`[Segmentation] Scan ${scanId} completed. Volume: ${segmentationData.tumorVolume} cm³`);
  } catch (error) {
    console.error(`[Segmentation] Failed for scan ${scanId}:`, error.message);
    await Scan.findByIdAndUpdate(scanId, { status: 'failed' });
  }
}
