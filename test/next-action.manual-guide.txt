/**
 * CP9 Phase 2 Track B3 - Next Action Tests
 *
 * Manual test cases for next_action field support in memory_add and memory_write
 *
 * To test manually:
 * 1. Set up fresh API key for new tenant
 * 2. Call memory_add with first memory
 * 3. Verify response includes next_action suggestion
 * 4. Call memory_add again
 * 5. Verify second call does NOT include next_action
 */

import { memoryAdd, memoryWrite } from '../src/tools.js';

/**
 * Test 1: First memory_add should return next_action
 *
 * Expected behavior:
 * - Response contains base JSON result
 * - Second content block includes: 💡 Try recalling: Use the memory_recall tool with query: '<query>'
 * - Query should contain relevant keywords from the memory
 */
async function testFirstMemoryAddNextAction() {
  console.log('📝 First memory_add next_action test');
  console.log('');
  console.log('Prerequisites:');
  console.log('- Fresh API key for new tenant (or reset onboarding state)');
  console.log('- ZERO_LATENCY_API_KEY environment variable set');
  console.log('');
  console.log('Steps:');
  console.log('1. Call memory_add with first conversation turn');
  console.log('2. Check if result.content has 2 blocks');
  console.log('3. Verify second block contains next_action suggestion');
  console.log('');
  console.log('Example call:');
  console.log('  const result = await memoryAdd(');
  console.log('    { apiKey: process.env.ZERO_LATENCY_API_KEY },');
  console.log('    {');
  console.log('      human_message: "I met Sarah at Starbucks yesterday",');
  console.log('      agent_message: "Got it! I will remember that."');
  console.log('    }');
  console.log('  );');
  console.log('');
  console.log('Expected result.content length: 2');
  console.log('Expected second block to include: "💡 Try recalling:"');
}

/**
 * Test 2: Second memory_add should NOT return next_action
 *
 * Expected behavior:
 * - Response contains only base JSON result
 * - No second content block
 */
async function testSecondMemoryAddNoNextAction() {
  console.log('📝 Second memory_add (no next_action) test');
  console.log('');
  console.log('Prerequisites:');
  console.log('- Same tenant from Test 1');
  console.log('- First memory already added');
  console.log('');
  console.log('Steps:');
  console.log('1. Call memory_add with second conversation turn');
  console.log('2. Check if result.content has 1 block (not 2)');
  console.log('3. Verify no next_action suggestion present');
  console.log('');
  console.log('Expected result.content length: 1');
}

/**
 * Test 3: memory_write should also support next_action
 *
 * Expected behavior:
 * - First memory_write returns next_action
 * - Subsequent calls do not
 */
async function testMemoryWriteNextAction() {
  console.log('📝 memory_write next_action test');
  console.log('');
  console.log('Prerequisites:');
  console.log('- Fresh API key for new tenant');
  console.log('');
  console.log('Steps:');
  console.log('1. Call memory_write with first memory');
  console.log('2. Check if result.content includes next_action suggestion');
  console.log('3. Call memory_write again');
  console.log('4. Verify no next_action in second call');
}

/**
 * Test 4: Keyword extraction quality
 *
 * Expected behavior:
 * - suggested_query should contain relevant keywords
 * - Should prioritize proper nouns and meaningful terms
 * - Should be concise (not entire conversation)
 */
async function testKeywordExtraction() {
  console.log('📝 Keyword extraction quality test');
  console.log('');
  console.log('Test cases:');
  console.log('');
  console.log('Input: "I met Sarah at Starbucks yesterday"');
  console.log('Expected keywords: "Sarah Starbucks" or similar');
  console.log('');
  console.log('Input: "My favorite color is blue"');
  console.log('Expected keywords: "favorite color blue" or similar');
  console.log('');
  console.log('Input: "The project deadline is next Friday"');
  console.log('Expected keywords: "project deadline Friday" or similar');
}

// Export test suite
export const nextActionTests = {
  testFirstMemoryAddNextAction,
  testSecondMemoryAddNoNextAction,
  testMemoryWriteNextAction,
  testKeywordExtraction
};

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('='.repeat(60));
  console.log('Next Action Tests');
  console.log('='.repeat(60));
  console.log('');

  console.log('Test 1: First memory_add Returns next_action');
  console.log('-'.repeat(60));
  await testFirstMemoryAddNextAction();
  console.log('');

  console.log('Test 2: Second memory_add Does NOT Return next_action');
  console.log('-'.repeat(60));
  await testSecondMemoryAddNoNextAction();
  console.log('');

  console.log('Test 3: memory_write next_action Support');
  console.log('-'.repeat(60));
  await testMemoryWriteNextAction();
  console.log('');

  console.log('Test 4: Keyword Extraction Quality');
  console.log('-'.repeat(60));
  await testKeywordExtraction();
  console.log('');

  console.log('='.repeat(60));
  console.log('Manual Testing Guide Complete');
  console.log('='.repeat(60));
  console.log('');
  console.log('To run actual tests with API:');
  console.log('1. Export ZERO_LATENCY_API_KEY=your_test_key');
  console.log('2. Modify tests to make actual API calls');
  console.log('3. Run: node --loader ts-node/esm test/next-action.test.ts');
}
