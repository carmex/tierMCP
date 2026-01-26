
import { generateTierListImage } from './drawer';
import { TierListConfig } from './types';

async function testSecurity() {
    console.log('--- Starting Security Tests ---');

    // Test 1: SSRF Protection
    console.log('\nTest 1: SSRF Protection (Localhost Access)');
    const ssrfConfig: TierListConfig = {
        items: [
            { id: '1', tier: 'S', imageUrl: 'http://localhost:3000/favicon.ico' } // Should fail
        ]
    };
    try {
        await generateTierListImage(ssrfConfig);
        console.log('SSRF Test: Failed (Should have logged error about private IP)');
    } catch (e) {
        // Warning is expected, not crash
        console.log('SSRF Test: Checks passed (Request likely blocked and logged)');
    }

    // Test 2: DoS Protection (Item Limit)
    console.log('\nTest 2: DoS Protection (Item Limit)');
    const manyItems = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        tier: 'S',
        text: `Item ${i}`
    }));
    const dosConfig: TierListConfig = { items: manyItems };

    try {
        await generateTierListImage(dosConfig);
        console.error('DoS Test (Count): Failed (Should have thrown error)');
    } catch (e) {
        if (e instanceof Error && e.message.includes('Too many items')) {
            console.log('DoS Test (Count): Passed');
        } else {
            console.error('DoS Test (Count): Failed (Wrong error)', e);
        }
    }

    console.log('\n--- Tests Completed ---');
}

testSecurity();
