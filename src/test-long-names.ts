import { generateTierListImage } from './drawer';
import { TierListConfig } from './types';
import * as fs from 'fs';

async function testLongNames() {
    console.log('Generating tier list with long names...');

    const config: TierListConfig = {
        title: 'The Ultimate Fruit Tier List with Long Names',
        tiers: [
            { id: 'S', label: 'God Tier (Unbeatable)', color: '#ff7f7f' },
            { id: 'A', label: 'A (Great & Delicious)', color: '#ffbf7f' },
            { id: 'B', label: 'B (Good Enough)', color: '#ffff7f' },
            { id: 'C', label: 'Average (Mediocre)', color: '#7fff7f' },
            { id: 'D', label: 'Below Average', color: '#7fbfff' },
            { id: 'F', label: 'F (Bad & Terrible)', color: '#7f7fff' },
        ],
        items: [
            { id: '1', tier: 'S', text: 'Strawberry Fields Forever' }, // Long text
            { id: '2', tier: 'S', text: 'Mango' },
            { id: '3', tier: 'A', text: 'Watermelon Sugar High' }, // Long text
            { id: '4', tier: 'A', text: 'Banana' },
            { id: '5', tier: 'B', text: 'Apple of my Eye' }, // Long text
            { id: '6', tier: 'B', text: 'Orange' },
            { id: '7', tier: 'C', text: 'Pear' },
            { id: '8', tier: 'C', text: 'Kiwi' },
            { id: '9', tier: 'D', text: 'Cantaloupe' },
            { id: '10', tier: 'F', text: 'Durian The Smelly One' } // Long text
        ]
    };

    try {
        const buffer = await generateTierListImage(config);
        console.log(`Generated image buffer of size: ${buffer.length}`);
        fs.writeFileSync('test_long_names.png', buffer);
        console.log('Saved to test_long_names.png');
    } catch (err) {
        console.error('Error generating image:', err);
    }
}

testLongNames();
