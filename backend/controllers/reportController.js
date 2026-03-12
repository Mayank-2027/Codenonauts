const Report = require('../models/Report');
const Scan = require('../models/Scan');
const { generateReports } = require('../services/geminiService');

// @desc      Generate and save report
// @route     POST /api/reports/generate
// @access    Private (Doctor only)
exports.generateReport = async (req, res, next) => {
  try {
    const { scanId } = req.body;

    // Verify scan exists
    const scan = await Scan.findById(scanId);

    if (!scan) {
      return res.status(404).json({ success: false, error: 'Scan not found' });
    }

    // Require segmentation data rather than strict status check,
    // in case status didn't update but data is present.
    if (!scan.segmentationData || !scan.segmentationData.tumorVolume) {
      return res.status(400).json({
        success: false,
        error: 'Scan segmentation data not available yet. Please wait for processing to finish.',
      });
    }
    
    // Call Gemini API
    const reports = await generateReports(scan.segmentationData);

    // Save to DB
    const report = await Report.create({
      scan: scanId,
      user: scan.user,
      doctorReport: reports.doctorReport,
      patientReport: reports.patientReport
    });

    res.status(201).json({
      success: true,
      data: report
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc      Get report
// @route     GET /api/reports/:id
// @access    Private
exports.getReport = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // Authorization checks could be added here
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
