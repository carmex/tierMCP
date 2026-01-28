import { createCanvas, loadImage, registerFont, CanvasRenderingContext2D } from 'canvas';
import { TierListConfig, DEFAULT_TIERS, TierItem, Tier } from './types';
import { ClientError } from './errors';
import axios from 'axios';

// Constants
import { lookup } from 'dns/promises';
import { URL } from 'url';

// Constants
const TIER_LABEL_WIDTH = 100; // Width of the colored box "S", "A", etc.
const ITEM_SIZE = 80;         // Size of each item image
const PADDING = 5;            // Padding around items
const ROW_MIN_HEIGHT = 100;   // Minimum height of a tier row
const LIST_WIDTH = 800;       // Total width of the image
const HEADER_HEIGHT = 60;     // Height for the title area
const FONT_FAMILY = 'Arial';  // Fallback font

// Security Constants
const MAX_ITEMS = 50;
const MAX_CANVAS_HEIGHT = 5000;
const IMAGE_TIMEOUT_MS = 5000;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

async function validateUrl(inputUrl: string): Promise<string> {
    const parsed = new URL(inputUrl);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new ClientError('Invalid protocol: must be http or https');
    }

    // Resolve hostname to IP to check for private addresses
    const { address } = await lookup(parsed.hostname);

    // Simple private IP check (IPv4)
    const parts = address.split('.').map(Number);
    if (parts.length === 4) {
        if (
            parts[0] === 10 ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168) ||
            (parts[0] === 127) ||
            (parts[0] === 0)
        ) {
            throw new ClientError(`Access to private IP ${address} is forbidden`);
        }
    } else if (address.includes(':')) {
        // Basic IPv6 check for localhost/private (not exhaustive but covers ::1 and fc00::)
        if (address === '::1' || address.toLowerCase().startsWith('fc') || address.toLowerCase().startsWith('fe80')) {
            throw new ClientError(`Access to private IP ${address} is forbidden`);
        }
    }

    return inputUrl;
}

async function loadItemImage(url: string): Promise<any | null> {
    try {
        const validatedUrl = await validateUrl(url);

        const response = await axios.get(validatedUrl, {
            responseType: 'arraybuffer',
            timeout: IMAGE_TIMEOUT_MS,
            maxContentLength: MAX_IMAGE_SIZE_BYTES,
            maxRedirects: 0, // Prevent redirecting to localhost
            headers: {
                'User-Agent': 'TierListMCP/1.0 (https://github.com/creationix/tierMCP; non-commercial tool)',
                'Accept': 'image/*'
            }
        });
        return await loadImage(Buffer.from(response.data));
    } catch (e) {
        // Validation errors (Security/ClientError) should definitely be thrown to the user
        if (e instanceof ClientError) {
            throw e;
        }

        // Other errors (network, 404, etc.) we can just log and skip the image
        // so the whole tier list doesn't fail just because one image is missing.
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`Failed to load image from ${url}: ${msg}`);
        return null;
    }
}

export async function generateTierListImage(config: TierListConfig): Promise<Buffer> {
    const tiers = config.tiers || DEFAULT_TIERS;
    const items = config.items;

    // DoS Protection: Item Limit
    if (items.length > MAX_ITEMS) {
        throw new ClientError(`Too many items. Max allowed is ${MAX_ITEMS}.`);
    }

    // 1. Group items by tier
    const itemsByTier: Record<string, TierItem[]> = {};
    tiers.forEach(t => itemsByTier[t.id] = []);

    // Also support matching by label if id not found, or "Unranked"
    items.forEach(item => {
        let tierId = item.tier;
        // Try to match by label if simple string provided
        if (!itemsByTier[tierId]) {
            const found = tiers.find(t => t.label === tierId || t.id === tierId);
            if (found) tierId = found.id;
        }

        if (itemsByTier[tierId]) {
            itemsByTier[tierId].push(item);
        } else {
            // If unknown tier, maybe add to a specific "Unknown" tier or ignore?
            // For now, let's skip or log.
            console.warn(`Item ${item.text || item.imageUrl} has unknown tier: ${item.tier}`);
        }
    });

    // 2. Calculate Layout
    // We need to know how many rows each tier takes to calculate total height.
    const rowHeights: number[] = [];
    const contentWidth = LIST_WIDTH - TIER_LABEL_WIDTH;
    const itemsPerRow = Math.floor(contentWidth / (ITEM_SIZE + PADDING));

    let totalHeight = config.title ? HEADER_HEIGHT : 0;

    tiers.forEach((tier, index) => {
        const count = itemsByTier[tier.id].length;
        const rowsNeeded = Math.max(1, Math.ceil(count / itemsPerRow));
        const height = Math.max(ROW_MIN_HEIGHT, rowsNeeded * (ITEM_SIZE + PADDING) + PADDING); // Ensure min height
        rowHeights[index] = height;
        totalHeight += height + 2; // +2 for separator/border
    });

    // DoS Protection: Height Limit
    if (totalHeight > MAX_CANVAS_HEIGHT) {
        throw new ClientError(`Generated image is too tall (${totalHeight}px). Limit is ${MAX_CANVAS_HEIGHT}px.`);
    }

    // 3. Setup Canvas
    const canvas = createCanvas(LIST_WIDTH, totalHeight);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = config.backgroundColor || '#1e1e1e';
    ctx.fillRect(0, 0, LIST_WIDTH, totalHeight);

    let currentY = 0;

    // Draw Title
    if (config.title) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 30px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.title, LIST_WIDTH / 2, HEADER_HEIGHT / 2);
        currentY += HEADER_HEIGHT;
    }

    // 4. Draw Rows
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const rowHeight = rowHeights[i];
        const tierItems = itemsByTier[tier.id];

        // Draw Tier Label (Left Box)
        ctx.fillStyle = tier.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.fillRect(0, currentY, TIER_LABEL_WIDTH, rowHeight);
        ctx.strokeRect(0, currentY, TIER_LABEL_WIDTH, rowHeight);

        // Tier Label Text
        ctx.fillStyle = '#000000';
        ctx.font = `bold 24px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tier.label, TIER_LABEL_WIDTH / 2, currentY + rowHeight / 2);

        // Draw Row Background (Space for items)
        ctx.fillStyle = '#2d2d2d'; // Darker gray for item area
        ctx.fillRect(TIER_LABEL_WIDTH, currentY, LIST_WIDTH - TIER_LABEL_WIDTH, rowHeight);
        ctx.strokeRect(TIER_LABEL_WIDTH, currentY, LIST_WIDTH - TIER_LABEL_WIDTH, rowHeight); // Border

        // Draw Items
        let itemX = TIER_LABEL_WIDTH + PADDING;
        let itemY = currentY + PADDING;

        for (const item of tierItems) {
            // Check overflow
            if (itemX + ITEM_SIZE > LIST_WIDTH) {
                itemX = TIER_LABEL_WIDTH + PADDING;
                itemY += ITEM_SIZE + PADDING;
            }

            if (item.imageUrl) {
                const img = await loadItemImage(item.imageUrl);
                if (img) {
                    ctx.drawImage(img, itemX, itemY, ITEM_SIZE, ITEM_SIZE);
                } else {
                    // Fallback if image fails
                    drawTextItem(ctx, item.text || '?', itemX, itemY);
                }
            } else {
                drawTextItem(ctx, item.text || 'Item', itemX, itemY);
            }

            itemX += ITEM_SIZE + PADDING;
        }

        currentY += rowHeight + 2; // Spacing
    }

    return canvas.toBuffer('image/png');
}

function drawTextItem(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
    ctx.fillStyle = '#444444';
    ctx.fillRect(x, y, ITEM_SIZE, ITEM_SIZE);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, ITEM_SIZE, ITEM_SIZE);

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px ' + FONT_FAMILY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Very basic wrapping or truncation could go here
    const cleanText = text.substring(0, 10); // Simple truncation
    ctx.fillText(cleanText, x + ITEM_SIZE / 2, y + ITEM_SIZE / 2);
}
