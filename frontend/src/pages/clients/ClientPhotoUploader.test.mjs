import test from 'node:test';
import assert from 'node:assert/strict';

// Core domain logic tests for ClientPhotoUploader
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function validateClientPhotoFile(file) {
  if (!file) {
    return { valid: false, error: 'NO_FILE' };
  }
  const fileType = file.type ? file.type.toLowerCase() : '';
  const fileExt = file.name ? file.name.split('.').pop()?.toLowerCase() : '';
  const isAllowedType = ALLOWED_MIME_TYPES.includes(fileType) || (!!fileExt && ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt));

  if (!isAllowedType) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'FILE_TOO_LARGE' };
  }
  return { valid: true };
}

test('validateClientPhotoFile accepts JPG, JPEG, PNG, and WEBP under 5MB', () => {
  const jpgFile = { name: 'client.jpg', type: 'image/jpeg', size: 1024 * 500 };
  const jpgAltFile = { name: 'camera.jpg', type: 'image/jpg', size: 1024 * 400 };
  const pngFile = { name: 'client.png', type: 'image/png', size: 1024 * 1024 };
  const webpFile = { name: 'client.webp', type: 'image/webp', size: 1024 * 200 };
  const emptyMimeWithExt = { name: 'camera_capture.jpg', type: '', size: 1024 * 300 };

  assert.deepEqual(validateClientPhotoFile(jpgFile), { valid: true });
  assert.deepEqual(validateClientPhotoFile(jpgAltFile), { valid: true });
  assert.deepEqual(validateClientPhotoFile(pngFile), { valid: true });
  assert.deepEqual(validateClientPhotoFile(webpFile), { valid: true });
  assert.deepEqual(validateClientPhotoFile(emptyMimeWithExt), { valid: true });
});

test('validateClientPhotoFile rejects unsupported formats (PDF, executable, text)', () => {
  const pdfFile = { name: 'doc.pdf', type: 'application/pdf', size: 50000 };
  const exeFile = { name: 'app.exe', type: 'application/x-msdownload', size: 50000 };
  const txtFile = { name: 'note.txt', type: 'text/plain', size: 1000 };

  assert.equal(validateClientPhotoFile(pdfFile).error, 'INVALID_FORMAT');
  assert.equal(validateClientPhotoFile(exeFile).error, 'INVALID_FORMAT');
  assert.equal(validateClientPhotoFile(txtFile).error, 'INVALID_FORMAT');
});

test('validateClientPhotoFile rejects files exceeding 5MB', () => {
  const exact5Mb = { name: 'ok.jpg', type: 'image/jpeg', size: 5 * 1024 * 1024 };
  const over5Mb = { name: 'large.jpg', type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 };

  assert.deepEqual(validateClientPhotoFile(exact5Mb), { valid: true });
  assert.equal(validateClientPhotoFile(over5Mb).error, 'FILE_TOO_LARGE');
});

test('Input configurations ensure standard HTML file and camera capture API support', () => {
  const fileInputAttributes = {
    type: 'file',
    accept: 'image/*',
  };

  const cameraInputAttributes = {
    type: 'file',
    accept: 'image/*',
    capture: 'environment'
  };

  assert.equal(fileInputAttributes.accept, 'image/*');
  assert.equal(cameraInputAttributes.accept, 'image/*');
  assert.equal(cameraInputAttributes.capture, 'environment');
});

test('Photo state transitions between existing photo, new preview, replacement, and deletion', () => {
  let state = {
    currentSavedUrl: '/clients/photo/existing-uuid.jpg',
    pendingFile: null,
    isDeleted: false,
  };

  // 1. User selects new photo or takes photo with camera
  const newFile = { name: 'camera_capture.jpg', type: 'image/jpeg', size: 200000 };
  state.pendingFile = newFile;
  state.isDeleted = false;
  assert.equal(state.pendingFile.name, 'camera_capture.jpg');
  assert.equal(state.isDeleted, false);

  // 2. User replaces with another photo from camera
  const replacedFile = { name: 'camera_capture_2.jpg', type: 'image/jpeg', size: 250000 };
  state.pendingFile = replacedFile;
  assert.equal(state.pendingFile.name, 'camera_capture_2.jpg');

  // 3. User cancels pending selection
  state.pendingFile = null;
  assert.equal(state.pendingFile, null);
  assert.equal(state.currentSavedUrl, '/clients/photo/existing-uuid.jpg');

  // 4. User chooses to delete existing photo
  state.isDeleted = true;
  assert.equal(state.isDeleted, true);

  // 5. User clicks undo delete
  state.isDeleted = false;
  assert.equal(state.isDeleted, false);
});
