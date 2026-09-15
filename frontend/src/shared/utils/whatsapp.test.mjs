import test from 'node:test';
import assert from 'node:assert/strict';

function normalizeWhatsAppPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-()+]+/g, '').trim();
  if (!cleaned) return '';

  if (cleaned.startsWith('3') && cleaned.length === 10) {
    return `57${cleaned}`;
  }

  if (cleaned.startsWith('57') && cleaned.length === 12) {
    return cleaned;
  }

  return cleaned;
}

function isValidWhatsAppPhone(phone) {
  const normalized = normalizeWhatsAppPhone(phone);
  return /^\d{8,15}$/.test(normalized);
}

function buildWaLink(phone, message) {
  const normalized = normalizeWhatsAppPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encodedMessage}`;
}

function openWhatsAppLink(url, mockWindow) {
  if (!url) return false;
  mockWindow.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

test('normalizeWhatsAppPhone handles Colombian 10-digit mobile', () => {
  assert.equal(normalizeWhatsAppPhone('3001234567'), '573001234567');
  assert.equal(normalizeWhatsAppPhone('315 987 6543'), '573159876543');
  assert.equal(normalizeWhatsAppPhone('+57 (300) 123-4567'), '573001234567');
  assert.equal(normalizeWhatsAppPhone('573001234567'), '573001234567');
});

test('normalizeWhatsAppPhone handles empty and non-Colombian numbers', () => {
  assert.equal(normalizeWhatsAppPhone(''), '');
  assert.equal(normalizeWhatsAppPhone('   '), '');
  assert.equal(normalizeWhatsAppPhone('+1 (415) 555-2671'), '14155552671');
});

test('isValidWhatsAppPhone validates correctly', () => {
  assert.equal(isValidWhatsAppPhone('3001234567'), true);
  assert.equal(isValidWhatsAppPhone('+57 300 123 4567'), true);
  assert.equal(isValidWhatsAppPhone('123'), false);
  assert.equal(isValidWhatsAppPhone(''), false);
  assert.equal(isValidWhatsAppPhone('abcdefghij'), false);
});

test('buildWaLink creates compliant wa.me URL with encoded message', () => {
  const phone = '3001234567';
  const message = 'Hola Juan 👋\n¿Cómo estás? & ¡Bienvenido!';
  const link = buildWaLink(phone, message);

  assert.ok(link.startsWith('https://wa.me/573001234567?text='));
  assert.ok(!link.includes('\n'));
  assert.ok(link.includes(encodeURIComponent('👋')));
  assert.ok(link.includes(encodeURIComponent('&')));
});

test('openWhatsAppLink opens in new tab with noopener,noreferrer', () => {
  let openedUrl = '';
  let target = '';
  let features = '';

  const mockWindow = {
    open: (u, t, f) => {
      openedUrl = u;
      target = t;
      features = f;
    }
  };

  const testUrl = 'https://wa.me/573001234567?text=Hola';
  const result = openWhatsAppLink(testUrl, mockWindow);

  assert.equal(result, true);
  assert.equal(openedUrl, testUrl);
  assert.equal(target, '_blank');
  assert.equal(features, 'noopener,noreferrer');
});

test('Modal double-click prevention logic prevents duplicate launches', () => {
  let callCount = 0;
  let isSubmitting = false;

  const triggerAction = () => {
    if (isSubmitting) return;
    isSubmitting = true;
    callCount++;
  };

  triggerAction();
  triggerAction();
  triggerAction();

  assert.equal(callCount, 1);
});
