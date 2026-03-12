# Dummy modal script
import modal

stub = modal.Stub("brain-tumor-segmentation")

@stub.function()
def perform_segmentation(dicom_zip):
    return {"status": "ok"}
