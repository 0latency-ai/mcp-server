/**
 * CP9 Phase 2 Track B2 - Error Envelope Parsing Tests
 *
 * Manual test cases for error envelope parsing in api.ts
 *
 * To test manually:
 * 1. Set up invalid API key
 * 2. Make requests that trigger various error types
 * 3. Verify error messages include hint and docs_url
 */

import { api } from '../src/api.js';

/**
 * Test 1: Invalid API key should return formatted error envelope
 *
 * Expected behavior:
 * - Error message includes: Error: <message>
 * - Hint line: 💡 <hint>
 * - Docs line: 📖 <docs_url>
 */
async function testInvalidAPIKey() {
  try {
    await api({
      apiKey: 'zl_live_invalid1234567890123456789012',
      method: 'POST',
      path: '/memories/extract',
      body: {
        content: 'Test memory'
      }
    });
    console.error('❌ Test failed: Expected error but got success');
  } catch (error) {
    const errorMsg = (error as Error).message;

    // Check for error envelope structure
    const hasErrorLabel = errorMsg.includes('Error:');
    const hasHint = errorMsg.includes('💡');
    const hasDocsUrl = errorMsg.includes('📖') || errorMsg.includes('http');

    if (hasErrorLabel && hasHint && hasDocsUrl) {
      console.log('✅ Error envelope parsed correctly');
      console.log('Error message:', errorMsg);
    } else {
      console.log('⚠️  Error format incomplete:');
      console.log('  Has Error label:', hasErrorLabel);
      console.log('  Has hint:', hasHint);
      console.log('  Has docs URL:', hasDocsUrl);
      console.log('  Full message:', errorMsg);
    }
  }
}

/**
 * Test 2: Legacy plain string errors should still work
 *
 * Expected behavior:
 * - Plain string errors are displayed as-is
 * - No crash or malformed output
 */
async function testLegacyErrorFormat() {
  // This would test backward compatibility with older API versions
  // that return plain string error messages
  console.log('📝 Legacy error format test (requires older API version)');
}

/**
 * Test 3: Not found error (404) should have proper envelope
 */
async function testNotFoundError() {
  console.log('📝 Not found error test (requires valid API key)');
}

// Export test suite
export const errorParsingTests = {
  testInvalidAPIKey,
  testLegacyErrorFormat,
  testNotFoundError
};

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('='.repeat(50));
  console.log('Error Envelope Parsing Tests');
  console.log('='.repeat(50));
  console.log('');

  console.log('Test 1: Invalid API Key Error Envelope');
  await testInvalidAPIKey();
  console.log('');

  console.log('Test 2: Legacy Error Format');
  await testLegacyErrorFormat();
  console.log('');

  console.log('Test 3: Not Found Error');
  await testNotFoundError();
  console.log('');

  console.log('='.repeat(50));
  console.log('Tests Complete');
  console.log('='.repeat(50));
}
