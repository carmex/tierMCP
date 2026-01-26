import { generateTierListImage } from './drawer';
import { TierListConfig } from './types';
import * as fs from 'fs';

async function testGeneration() {
    console.log('Generating test tier list...');

    const config: TierListConfig = {
        title: 'My Favorite Fruits',
        items: [
            { id: '1', tier: 'S', text: 'Apple' },
            { id: '2', tier: 'S', text: 'Banana' },
            { id: '3', tier: 'A', text: 'Orange' },
            { id: '4', tier: 'B', text: 'Grape' },
            { id: '5', tier: 'F', text: 'Tomato' },
            // Test unknown tier
            { id: '6', tier: 'NonExistent', text: 'Ghost' }
        ]
    };

    try {
        const buffer = await generateTierListImage(config);
        console.log(`Generated image buffer of size: ${buffer.length}`);
        fs.writeFileSync('test_output.png', buffer);
        console.log('Saved to test_output.png');
    } catch (err) {
        console.error('Error generating image:', err);
    }
}

testGeneration();
